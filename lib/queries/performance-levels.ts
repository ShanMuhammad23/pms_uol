import "server-only";

import { db } from "../db";
import type {
  CreatePerformanceLevelInput,
  PerformanceLevelRecord,
  PerformanceLevelWithQuartiles,
  PerformanceMatrixAssignmentRecord,
  PerformanceQuartileRecord,
  UpdatePerformanceLevelInput,
} from "@/types/performance-matrices";

interface PerformanceLevelRow {
  id: number;
  financial_year_id: number;
  matrix_label: string;
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
    id: Number(row.id),
    financialYearId: row.financial_year_id,
    matrixLabel: row.matrix_label,
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
    id: Number(row.id),
    performanceLevelId: Number(row.performance_level_id),
    name: row.name,
    scoreMin: Number(row.score_min),
    scoreMax: Number(row.score_max),
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
  matrixLabel?: string,
): Promise<PerformanceLevelRecord[]> {
  const hasMatrixLabel = Boolean(matrixLabel?.trim());
  const result = await db.query<PerformanceLevelRow>(
    `SELECT id, financial_year_id, matrix_label, name, sort_order, created_at::text, updated_at::text
     FROM performance_levels
     WHERE financial_year_id = $1
       ${hasMatrixLabel ? "AND matrix_label = $2" : ""}
     ORDER BY sort_order ASC, name ASC`,
    hasMatrixLabel ? [financialYearId, matrixLabel!.trim()] : [financialYearId],
  );

  return result.rows.map(mapPerformanceLevelRow);
}

export async function getPerformanceLevelById(
  id: number,
): Promise<PerformanceLevelRecord | null> {
  const result = await db.query<PerformanceLevelRow>(
    `SELECT id, financial_year_id, matrix_label, name, sort_order, created_at::text, updated_at::text
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
  matrixLabel?: string,
): Promise<PerformanceLevelWithQuartiles[]> {
  const levels = await listPerformanceLevelsByFinancialYearId(
    financialYearId,
    matrixLabel,
  );

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
      `INSERT INTO performance_levels (financial_year_id, matrix_label, name, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, financial_year_id, matrix_label, name, sort_order, created_at::text, updated_at::text`,
      [
        input.financialYearId,
        input.matrixLabel.trim(),
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
       SET matrix_label = $1,
           name = $2,
           sort_order = COALESCE($3, sort_order),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, financial_year_id, matrix_label, name, sort_order, created_at::text, updated_at::text`,
      [input.matrixLabel.trim(), input.name.trim(), input.sortOrder ?? null, id],
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

export async function listPerformanceMatrixLabelsByFinancialYearId(
  financialYearId: number,
): Promise<string[]> {
  const result = await db.query<{ matrix_label: string }>(
    `SELECT DISTINCT matrix_label
     FROM performance_levels
     WHERE financial_year_id = $1
     ORDER BY matrix_label ASC`,
    [financialYearId],
  );
  return result.rows.map((row) => row.matrix_label);
}

export async function assignPerformanceMatrixToEmployees(
  financialYearId: number,
  matrixLabel: string,
  employeeIds: string[],
): Promise<{ updatedCount: number; financialYearId: number; matrixLabel: string }> {
  const normalizedCodes = [...new Set(employeeIds.map((item) => item.trim()).filter(Boolean))];
  const trimmedLabel = matrixLabel.trim();

  if (!trimmedLabel) {
    throw new PerformanceLevelError("Matrix label is required.", 400);
  }
  if (normalizedCodes.length === 0) {
    throw new PerformanceLevelError("At least one employee is required.", 400);
  }

  const matrixExists = await db.query<{ id: string }>(
    `SELECT id
     FROM performance_levels
     WHERE financial_year_id = $1 AND matrix_label = $2
     LIMIT 1`,
    [financialYearId, trimmedLabel],
  );
  if (!matrixExists.rows[0]) {
    throw new PerformanceLevelError("Selected performance matrix does not exist.", 404);
  }

  const conflicts = await db.query<{
    employee_code: string;
    first_name: string;
    last_name: string;
    matrix_label: string;
  }>(
    `SELECT u.employee_id AS employee_code, u.first_name, u.last_name, epma.matrix_label
     FROM employee_performance_matrix_assignments epma
     INNER JOIN users u ON u.id = epma.employee_id
     WHERE epma.financial_year_id = $1
       AND u.employee_id = ANY($2::text[])
       AND epma.matrix_label <> $3`,
    [financialYearId, normalizedCodes, trimmedLabel],
  );

  if (conflicts.rows.length > 0) {
    const names = conflicts.rows.map(
      (row) =>
        `${row.employee_code} (${row.first_name} ${row.last_name}) — assigned to "${row.matrix_label}"`,
    );
    throw new PerformanceLevelError(
      `Cannot assign: the following employee(s) are already assigned to a different performance matrix. Unassign them first:\n${names.join("\n")}`,
      409,
    );
  }

  const result = await db.query<{ employee_id: string }>(
    `WITH selected_users AS (
       SELECT id
       FROM users
       WHERE employee_id = ANY($1::text[])
         AND is_active = TRUE
     ),
     upserted AS (
       INSERT INTO employee_performance_matrix_assignments (
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
    updatedCount: result.rows.length,
    financialYearId,
    matrixLabel: trimmedLabel,
  };
}

export async function listEmployeePerformanceMatrixAssignments(
  financialYearId: number,
): Promise<PerformanceMatrixAssignmentRecord[]> {
  const result = await db.query<{
    employee_id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    matrix_label: string;
  }>(
    `SELECT
       epma.employee_id::text,
       u.employee_id AS employee_code,
       u.first_name,
       u.last_name,
       epma.matrix_label
     FROM employee_performance_matrix_assignments epma
     INNER JOIN users u ON u.id = epma.employee_id
     WHERE epma.financial_year_id = $1
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

export async function unassignPerformanceMatrixFromEmployees(
  financialYearId: number,
  employeeIds: string[],
  matrixLabel?: string,
): Promise<{ unassignedCount: number; financialYearId: number }> {
  const normalizedCodes = [
    ...new Set(employeeIds.map((item) => item.trim()).filter(Boolean)),
  ];

  if (normalizedCodes.length === 0) {
    throw new PerformanceLevelError("At least one employee is required.", 400);
  }

  const trimmedLabel = matrixLabel?.trim();
  const result = await db.query(
    `DELETE FROM employee_performance_matrix_assignments
     WHERE financial_year_id = $1
       AND employee_id IN (
         SELECT id FROM users WHERE employee_id = ANY($2::text[])
       )
       ${trimmedLabel ? "AND matrix_label = $3" : ""}`,
    trimmedLabel
      ? [financialYearId, normalizedCodes, trimmedLabel]
      : [financialYearId, normalizedCodes],
  );

  return {
    unassignedCount: result.rowCount ?? 0,
    financialYearId,
  };
}
