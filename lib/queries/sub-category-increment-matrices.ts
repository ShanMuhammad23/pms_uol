import "server-only";

import { db } from "../db";
import type {
  CreateSubCategoryIncrementMatrixInput,
  SubCategoryIncrementMatrixRecord,
  UpdateSubCategoryIncrementMatrixInput,
  IncrementMatrixAssignmentRecord,
} from "@/types/sub-category-increment-matrices";

interface IncrementMatrixRow {
  id: string;
  financial_year_id: number;
  matrix_label: string;
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
    matrixLabel: row.matrix_label,
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
    sim.matrix_label,
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
       sim.matrix_label,
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
         matrix_label,
         performance_quartile_id,
         increment_percentage
       ) VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        input.financialYearId,
        input.matrixLabel.trim(),
        input.performanceQuartileId,
        Math.round(Number(input.incrementPercentage) * 100) / 100,
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
        "An increment matrix entry already exists for this matrix label and quartile combination.",
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
       SET matrix_label = $1,
           performance_quartile_id = $2,
           increment_percentage = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [
        input.matrixLabel.trim(),
        input.performanceQuartileId,
        Math.round(Number(input.incrementPercentage) * 100) / 100,
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
        "An increment matrix entry already exists for this matrix label and quartile combination.",
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

export async function listIncrementMatrixLabels(
  financialYearId: number,
): Promise<string[]> {
  const result = await db.query<{ matrix_label: string }>(
    `SELECT DISTINCT matrix_label
     FROM sub_category_increment_matrices
     WHERE financial_year_id = $1
     ORDER BY matrix_label ASC`,
    [financialYearId],
  );
  return result.rows.map((row) => row.matrix_label);
}

export async function listEmployeeIncrementMatrixAssignments(
  financialYearId: number,
): Promise<IncrementMatrixAssignmentRecord[]> {
  const result = await db.query<{
    employee_id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    matrix_label: string;
  }>(
    `SELECT
       eima.employee_id::text,
       u.employee_id AS employee_code,
       u.first_name,
       u.last_name,
       eima.matrix_label
     FROM employee_increment_matrix_assignments eima
     INNER JOIN users u ON u.id = eima.employee_id
     WHERE eima.financial_year_id = $1
     ORDER BY u.employee_id ASC`,
    [financialYearId],
  );

  return result.rows.map((row) => ({
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    firstName: row.first_name,
    lastName: row.last_name,
    matrixLabel: row.matrix_label,
    financialYearId,
  }));
}

export async function assignIncrementMatrixToEmployees(
  financialYearId: number,
  matrixLabel: string,
  employeeCodes: string[],
): Promise<{ assignedCount: number; financialYearId: number; matrixLabel: string }> {
  const normalizedCodes = [...new Set(employeeCodes.map((c) => c.trim()).filter(Boolean))];
  const trimmedLabel = matrixLabel.trim();

  if (!trimmedLabel) {
    throw new SubCategoryIncrementMatrixError("Matrix label is required.", 400);
  }
  if (normalizedCodes.length === 0) {
    throw new SubCategoryIncrementMatrixError("At least one employee is required.", 400);
  }

  const matrixExists = await db.query<{ id: string }>(
    `SELECT id
     FROM sub_category_increment_matrices
     WHERE financial_year_id = $1 AND matrix_label = $2
     LIMIT 1`,
    [financialYearId, trimmedLabel],
  );
  if (!matrixExists.rows[0]) {
    throw new SubCategoryIncrementMatrixError(
      "Selected increment matrix does not exist.",
      404,
    );
  }

  // Check if any selected employees are already assigned to a DIFFERENT matrix
  const conflicts = await db.query<{
    employee_code: string;
    first_name: string;
    last_name: string;
    matrix_label: string;
  }>(
    `SELECT u.employee_id AS employee_code, u.first_name, u.last_name, eima.matrix_label
     FROM employee_increment_matrix_assignments eima
     INNER JOIN users u ON u.id = eima.employee_id
     WHERE eima.financial_year_id = $1
       AND u.employee_id = ANY($2::text[])
       AND eima.matrix_label <> $3`,
    [financialYearId, normalizedCodes, trimmedLabel],
  );

  if (conflicts.rows.length > 0) {
    const names = conflicts.rows.map(
      (r) => `${r.employee_code} (${r.first_name} ${r.last_name}) — assigned to "${r.matrix_label}"`,
    );
    throw new SubCategoryIncrementMatrixError(
      `Cannot assign: the following employee(s) are already assigned to a different increment matrix. Unassign them first:\n${names.join("\n")}`,
      409,
    );
  }

  // Insert new assignments (or update if same matrix — idempotent re-assignment)
  const result = await db.query<{ employee_id: string }>(
    `WITH selected_users AS (
       SELECT id
       FROM users
       WHERE employee_id = ANY($1::text[])
         AND is_active = TRUE
     ),
     upserted AS (
       INSERT INTO employee_increment_matrix_assignments (
         employee_id, financial_year_id, matrix_label
       )
       SELECT id, $2, $3
       FROM selected_users
       ON CONFLICT (employee_id, financial_year_id) DO UPDATE
         SET matrix_label = EXCLUDED.matrix_label,
             updated_at = CURRENT_TIMESTAMP
       RETURNING employee_id
     )
     SELECT employee_id FROM upserted`,
    [normalizedCodes, financialYearId, trimmedLabel],
  );

  return {
    assignedCount: result.rows.length,
    financialYearId,
    matrixLabel: trimmedLabel,
  };
}

export async function unassignIncrementMatrixFromEmployees(
  financialYearId: number,
  employeeCodes: string[],
): Promise<{ unassignedCount: number; financialYearId: number }> {
  const normalizedCodes = [...new Set(employeeCodes.map((c) => c.trim()).filter(Boolean))];

  if (normalizedCodes.length === 0) {
    throw new SubCategoryIncrementMatrixError("At least one employee is required.", 400);
  }

  const result = await db.query(
    `DELETE FROM employee_increment_matrix_assignments
     WHERE financial_year_id = $1
       AND employee_id IN (
         SELECT id FROM users WHERE employee_id = ANY($2::text[])
       )`,
    [financialYearId, normalizedCodes],
  );

  return {
    unassignedCount: result.rowCount ?? 0,
    financialYearId,
  };
}
