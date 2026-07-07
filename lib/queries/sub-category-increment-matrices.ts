import "server-only";

import { db } from "../db";
import type { EmployeeCategory, SubCategory } from "@/types/forms";
import type {
  CreateSubCategoryIncrementMatrixInput,
  SubCategoryIncrementMatrixRecord,
  UpdateSubCategoryIncrementMatrixInput,
} from "@/types/sub-category-increment-matrices";

interface IncrementMatrixRow {
  id: string;
  financial_year_id: number;
  target_category: EmployeeCategory;
  target_sub_category: SubCategory;
  performance_level_id: string;
  performance_level_name: string;
  performance_level_sort_order: number;
  performance_quartile_id: string;
  performance_quartile_name: string;
  performance_quartile_sort_order: number;
  increment_percentage: string;
  created_at: string;
  updated_at: string;
}

export class SubCategoryIncrementMatrixError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "SubCategoryIncrementMatrixError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

function mapRow(row: IncrementMatrixRow): SubCategoryIncrementMatrixRecord {
  return {
    id: Number(row.id),
    financialYearId: row.financial_year_id,
    targetCategory: row.target_category,
    targetSubCategory: row.target_sub_category,
    performanceLevelId: Number(row.performance_level_id),
    performanceLevelName: row.performance_level_name,
    performanceQuartileId: Number(row.performance_quartile_id),
    performanceQuartileName: row.performance_quartile_name,
    incrementPercentage: Number(row.increment_percentage),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const LIST_QUERY = `
  SELECT
    sim.id,
    sim.financial_year_id,
    sim.target_category,
    sim.target_sub_category,
    pl.id AS performance_level_id,
    pl.name AS performance_level_name,
    pl.sort_order AS performance_level_sort_order,
    pq.id AS performance_quartile_id,
    pq.name AS performance_quartile_name,
    pq.sort_order AS performance_quartile_sort_order,
    sim.increment_percentage,
    sim.created_at::text,
    sim.updated_at::text
  FROM sub_category_increment_matrices sim
  INNER JOIN performance_quartiles pq ON pq.id = sim.performance_quartile_id
  INNER JOIN performance_levels pl ON pl.id = pq.performance_level_id
`;

async function assertQuartileBelongsToLevel(
  performanceLevelId: number,
  performanceQuartileId: number,
  financialYearId: number,
): Promise<void> {
  const result = await db.query<{ id: string }>(
    `SELECT pq.id
     FROM performance_quartiles pq
     INNER JOIN performance_levels pl ON pl.id = pq.performance_level_id
     WHERE pq.id = $1
       AND pq.performance_level_id = $2
       AND pl.financial_year_id = $3`,
    [performanceQuartileId, performanceLevelId, financialYearId],
  );

  if (result.rows.length === 0) {
    throw new SubCategoryIncrementMatrixError(
      "Selected quartile does not belong to the chosen performance level for this financial year.",
      400,
    );
  }
}

async function getIncrementMatrixById(
  id: number,
): Promise<SubCategoryIncrementMatrixRecord | null> {
  const result = await db.query<IncrementMatrixRow>(
    `${LIST_QUERY}
     WHERE sim.id = $1`,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRow(result.rows[0]);
}

export async function listSubCategoryIncrementMatrices(
  financialYearId: number,
): Promise<SubCategoryIncrementMatrixRecord[]> {
  const result = await db.query<IncrementMatrixRow>(
    `${LIST_QUERY}
     WHERE sim.financial_year_id = $1
     ORDER BY
       sim.target_category,
       sim.target_sub_category,
       pl.sort_order,
       pq.sort_order`,
    [financialYearId],
  );

  return result.rows.map(mapRow);
}

export async function createSubCategoryIncrementMatrix(
  input: CreateSubCategoryIncrementMatrixInput,
): Promise<SubCategoryIncrementMatrixRecord> {
  await assertQuartileBelongsToLevel(
    input.performanceLevelId,
    input.performanceQuartileId,
    input.financialYearId,
  );

  try {
    const result = await db.query<{ id: string }>(
      `INSERT INTO sub_category_increment_matrices (
         financial_year_id,
         target_category,
         target_sub_category,
         performance_quartile_id,
         increment_percentage
       ) VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        input.financialYearId,
        input.targetCategory,
        input.targetSubCategory,
        input.performanceQuartileId,
        input.incrementPercentage,
      ],
    );

    const created = await getIncrementMatrixById(Number(result.rows[0].id));
    if (!created) {
      throw new SubCategoryIncrementMatrixError(
        "Failed to load created increment matrix entry.",
        500,
      );
    }

    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new SubCategoryIncrementMatrixError(
        "An increment matrix entry already exists for this category, sub-category, and quartile combination.",
        409,
      );
    }

    throw error;
  }
}

export async function updateSubCategoryIncrementMatrix(
  id: number,
  financialYearId: number,
  input: UpdateSubCategoryIncrementMatrixInput,
): Promise<SubCategoryIncrementMatrixRecord> {
  const existing = await getIncrementMatrixById(id);

  if (!existing) {
    throw new SubCategoryIncrementMatrixError(
      "Increment matrix entry not found.",
      404,
    );
  }

  if (existing.financialYearId !== financialYearId) {
    throw new SubCategoryIncrementMatrixError(
      "Financial year cannot be changed for an existing entry.",
      400,
    );
  }

  await assertQuartileBelongsToLevel(
    input.performanceLevelId,
    input.performanceQuartileId,
    financialYearId,
  );

  try {
    const result = await db.query(
      `UPDATE sub_category_increment_matrices
       SET target_category = $1,
           target_sub_category = $2,
           performance_quartile_id = $3,
           increment_percentage = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [
        input.targetCategory,
        input.targetSubCategory,
        input.performanceQuartileId,
        input.incrementPercentage,
        id,
      ],
    );

    if (result.rowCount === 0) {
      throw new SubCategoryIncrementMatrixError(
        "Increment matrix entry not found.",
        404,
      );
    }

    const updated = await getIncrementMatrixById(id);
    if (!updated) {
      throw new SubCategoryIncrementMatrixError(
        "Failed to load updated increment matrix entry.",
        500,
      );
    }

    return updated;
  } catch (error) {
    if (error instanceof SubCategoryIncrementMatrixError) {
      throw error;
    }

    if (isUniqueViolation(error)) {
      throw new SubCategoryIncrementMatrixError(
        "An increment matrix entry already exists for this category, sub-category, and quartile combination.",
        409,
      );
    }

    throw error;
  }
}

export async function deleteSubCategoryIncrementMatrix(id: number): Promise<void> {
  const result = await db.query(
    `DELETE FROM sub_category_increment_matrices WHERE id = $1`,
    [id],
  );

  if (result.rowCount === 0) {
    throw new SubCategoryIncrementMatrixError(
      "Increment matrix entry not found.",
      404,
    );
  }
}
