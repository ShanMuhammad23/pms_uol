import "server-only";

import { db } from "../db";
import type {
  CreatePerformanceLevelInput,
  PerformanceLevelRecord,
  PerformanceLevelWithQuartiles,
  PerformanceQuartileRecord,
  UpdatePerformanceLevelInput,
} from "@/types/performance-matrices";

interface PerformanceLevelRow {
  id: number;
  financial_year_id: number;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface PerformanceQuartileRow {
  id: number;
  performance_level_id: number;
  name: string;
  score_min: number;
  score_max: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export class PerformanceLevelError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "PerformanceLevelError";
  }
}

function mapPerformanceLevelRow(
  row: PerformanceLevelRow,
): PerformanceLevelRecord {
  return {
    id: row.id,
    financialYearId: row.financial_year_id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPerformanceQuartileRow(
  row: PerformanceQuartileRow,
): PerformanceQuartileRecord {
  return {
    id: row.id,
    performanceLevelId: row.performance_level_id,
    name: row.name,
    scoreMin: row.score_min,
    scoreMax: row.score_max,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23503"
  );
}

export async function listPerformanceLevelsByFinancialYearId(
  financialYearId: number,
): Promise<PerformanceLevelRecord[]> {
  const result = await db.query<PerformanceLevelRow>(
    `SELECT id, financial_year_id, name, sort_order, created_at::text, updated_at::text
     FROM performance_levels
     WHERE financial_year_id = $1
     ORDER BY sort_order ASC, name ASC`,
    [financialYearId],
  );

  return result.rows.map(mapPerformanceLevelRow);
}

export async function getPerformanceLevelById(
  id: number,
): Promise<PerformanceLevelRecord | null> {
  const result = await db.query<PerformanceLevelRow>(
    `SELECT id, financial_year_id, name, sort_order, created_at::text, updated_at::text
     FROM performance_levels
     WHERE id = $1`,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapPerformanceLevelRow(result.rows[0]);
}

export async function getPerformanceMatrixByFinancialYearId(
  financialYearId: number,
): Promise<PerformanceLevelWithQuartiles[]> {
  const levels = await listPerformanceLevelsByFinancialYearId(financialYearId);

  if (levels.length === 0) {
    return [];
  }

  const levelIds = levels.map((level) => level.id);
  const result = await db.query<PerformanceQuartileRow>(
    `SELECT id, performance_level_id, name, score_min, score_max, sort_order, created_at::text, updated_at::text
     FROM performance_quartiles
     WHERE performance_level_id = ANY($1::bigint[])
     ORDER BY sort_order ASC, name ASC`,
    [levelIds],
  );

  const quartilesByLevel = new Map<number, PerformanceQuartileRecord[]>();

  for (const row of result.rows) {
    const quartile = mapPerformanceQuartileRow(row);
    const existing = quartilesByLevel.get(quartile.performanceLevelId) ?? [];
    existing.push(quartile);
    quartilesByLevel.set(quartile.performanceLevelId, existing);
  }

  return levels.map((level) => ({
    ...level,
    quartiles: quartilesByLevel.get(level.id) ?? [],
  }));
}

export async function createPerformanceLevel(
  input: CreatePerformanceLevelInput,
): Promise<PerformanceLevelRecord> {
  try {
    const result = await db.query<PerformanceLevelRow>(
      `INSERT INTO performance_levels (financial_year_id, name, sort_order)
       VALUES ($1, $2, $3)
       RETURNING id, financial_year_id, name, sort_order, created_at::text, updated_at::text`,
      [
        input.financialYearId,
        input.name.trim(),
        input.sortOrder ?? 0,
      ],
    );

    return mapPerformanceLevelRow(result.rows[0]);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new PerformanceLevelError("Financial year not found.", 404);
    }

    if (isUniqueViolation(error)) {
      throw new PerformanceLevelError(
        `Performance level "${input.name.trim()}" already exists for this financial year.`,
        409,
      );
    }

    throw error;
  }
}

export async function updatePerformanceLevel(
  id: number,
  input: UpdatePerformanceLevelInput,
): Promise<PerformanceLevelRecord> {
  try {
    const result = await db.query<PerformanceLevelRow>(
      `UPDATE performance_levels
       SET name = $1, sort_order = COALESCE($2, sort_order), updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, financial_year_id, name, sort_order, created_at::text, updated_at::text`,
      [input.name.trim(), input.sortOrder ?? null, id],
    );

    if (result.rows.length === 0) {
      throw new PerformanceLevelError("Performance level not found.", 404);
    }

    return mapPerformanceLevelRow(result.rows[0]);
  } catch (error) {
    if (error instanceof PerformanceLevelError) {
      throw error;
    }

    if (isUniqueViolation(error)) {
      throw new PerformanceLevelError(
        `Performance level "${input.name.trim()}" already exists for this financial year.`,
        409,
      );
    }

    throw error;
  }
}

export async function deletePerformanceLevel(id: number): Promise<void> {
  try {
    const result = await db.query(`DELETE FROM performance_levels WHERE id = $1`, [
      id,
    ]);

    if (result.rowCount === 0) {
      throw new PerformanceLevelError("Performance level not found.", 404);
    }
  } catch (error) {
    if (error instanceof PerformanceLevelError) {
      throw error;
    }

    if (isForeignKeyViolation(error)) {
      throw new PerformanceLevelError(
        "Cannot delete a performance level that has quartiles assigned.",
        409,
      );
    }

    throw error;
  }
}
