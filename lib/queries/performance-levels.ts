import "server-only";

import { db } from "../db";
import type {
  CopyPerformanceMatrixInput,
  CreatePerformanceLevelInput,
  CreatePerformanceMatrixInput,
  PerformanceLevelRecord,
  PerformanceLevelWithQuartiles,
  PerformanceMatrixAssignmentRecord,
  PerformanceMatrixSummary,
  PerformanceQuartileRecord,
  UpdatePerformanceLevelInput,
  UpdatePerformanceMatrixIdentityInput,
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

export async function listPerformanceMatrixSummaries(): Promise<
  PerformanceMatrixSummary[]
> {
  const result = await db.query<{
    financial_year_id: number;
    financial_year_label: string;
    is_active: boolean;
    matrix_label: string;
    title: string;
    level_count: string;
    quartile_count: string;
    assigned_employee_count: string;
    updated_at: string;
  }>(
    `SELECT
       d.financial_year_id,
       fy.label AS financial_year_label,
       fy.is_active,
       d.matrix_label,
       d.title,
       COUNT(DISTINCT pl.id)::text AS level_count,
       COUNT(pq.id)::text AS quartile_count,
       (
         SELECT COUNT(*)::text
         FROM employee_performance_matrix_assignments epma
         WHERE epma.financial_year_id = d.financial_year_id
           AND epma.matrix_label = d.matrix_label
       ) AS assigned_employee_count,
       d.updated_at::text AS updated_at
     FROM performance_matrix_defs d
     INNER JOIN financial_years fy ON fy.id = d.financial_year_id
     LEFT JOIN performance_levels pl
       ON pl.financial_year_id = d.financial_year_id
      AND pl.matrix_label = d.matrix_label
     LEFT JOIN performance_quartiles pq ON pq.performance_level_id = pl.id
     GROUP BY d.financial_year_id, fy.label, fy.is_active, d.matrix_label, d.title, d.updated_at
     ORDER BY fy.is_active DESC, fy.label DESC, d.title ASC, d.matrix_label ASC`,
  );

  return result.rows.map((row) => ({
    financialYearId: Number(row.financial_year_id),
    financialYearLabel: row.financial_year_label,
    isActiveYear: row.is_active,
    matrixLabel: row.matrix_label,
    title: row.title,
    levelCount: Number(row.level_count),
    quartileCount: Number(row.quartile_count),
    assignedEmployeeCount: Number(row.assigned_employee_count),
    updatedAt: row.updated_at,
  }));
}

export async function deletePerformanceMatrix(
  financialYearId: number,
  matrixLabel: string,
): Promise<void> {
  const trimmedLabel = matrixLabel.trim();
  if (!trimmedLabel) {
    throw new PerformanceLevelError("Matrix label is required.", 400);
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query<{ id: string }>(
      `SELECT id
       FROM performance_matrix_defs
       WHERE financial_year_id = $1 AND matrix_label = $2
       LIMIT 1`,
      [financialYearId, trimmedLabel],
    );

    if (!existing.rows[0]) {
      throw new PerformanceLevelError("Performance matrix not found.", 404);
    }

    await client.query(
      `DELETE FROM employee_performance_matrix_assignments
       WHERE financial_year_id = $1 AND matrix_label = $2`,
      [financialYearId, trimmedLabel],
    );

    await client.query(
      `DELETE FROM performance_quartiles
       WHERE performance_level_id IN (
         SELECT id
         FROM performance_levels
         WHERE financial_year_id = $1 AND matrix_label = $2
       )`,
      [financialYearId, trimmedLabel],
    );

    await client.query(
      `DELETE FROM performance_levels
       WHERE financial_year_id = $1 AND matrix_label = $2`,
      [financialYearId, trimmedLabel],
    );

    await client.query(
      `DELETE FROM performance_matrix_defs
       WHERE financial_year_id = $1 AND matrix_label = $2`,
      [financialYearId, trimmedLabel],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof PerformanceLevelError) {
      throw error;
    }
    if (isForeignKeyViolation(error)) {
      throw new PerformanceLevelError(
        "Cannot delete this performance matrix because it is still in use.",
        409,
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function createPerformanceMatrix(
  input: CreatePerformanceMatrixInput,
): Promise<PerformanceMatrixSummary> {
  const trimmedLabel = input.matrixLabel.trim();
  const trimmedTitle = input.title.trim() || trimmedLabel;

  if (!trimmedLabel) {
    throw new PerformanceLevelError("Matrix label is required.", 400);
  }

  try {
    await db.query(
      `INSERT INTO performance_matrix_defs (financial_year_id, matrix_label, title)
       VALUES ($1, $2, $3)`,
      [input.financialYearId, trimmedLabel, trimmedTitle],
    );
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new PerformanceLevelError("Financial year not found.", 404);
    }
    if (isUniqueViolation(error)) {
      throw new PerformanceLevelError(
        `Performance matrix "${trimmedLabel}" already exists for this financial year.`,
        409,
      );
    }
    throw error;
  }

  const summaries = await listPerformanceMatrixSummaries();
  const created = summaries.find(
    (item) =>
      item.financialYearId === input.financialYearId &&
      item.matrixLabel === trimmedLabel,
  );
  if (!created) {
    throw new PerformanceLevelError("Failed to load created performance matrix.", 500);
  }
  return created;
}

export async function updatePerformanceMatrixIdentity(
  input: UpdatePerformanceMatrixIdentityInput,
): Promise<PerformanceMatrixSummary> {
  const currentLabel = input.matrixLabel.trim();
  const nextLabel = input.newMatrixLabel.trim();
  const nextTitle = input.title.trim() || nextLabel;

  if (!currentLabel || !nextLabel) {
    throw new PerformanceLevelError("Matrix label is required.", 400);
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query<{ id: string }>(
      `SELECT id
       FROM performance_matrix_defs
       WHERE financial_year_id = $1 AND matrix_label = $2
       LIMIT 1`,
      [input.financialYearId, currentLabel],
    );
    if (!existing.rows[0]) {
      throw new PerformanceLevelError("Performance matrix not found.", 404);
    }

    if (nextLabel !== currentLabel) {
      const conflict = await client.query<{ id: string }>(
        `SELECT id
         FROM performance_matrix_defs
         WHERE financial_year_id = $1 AND matrix_label = $2
         LIMIT 1`,
        [input.financialYearId, nextLabel],
      );
      if (conflict.rows[0]) {
        throw new PerformanceLevelError(
          `Performance matrix "${nextLabel}" already exists for this financial year.`,
          409,
        );
      }

      await client.query(
        `UPDATE performance_levels
         SET matrix_label = $1, updated_at = CURRENT_TIMESTAMP
         WHERE financial_year_id = $2 AND matrix_label = $3`,
        [nextLabel, input.financialYearId, currentLabel],
      );
      await client.query(
        `UPDATE employee_performance_matrix_assignments
         SET matrix_label = $1, updated_at = CURRENT_TIMESTAMP
         WHERE financial_year_id = $2 AND matrix_label = $3`,
        [nextLabel, input.financialYearId, currentLabel],
      );
    }

    await client.query(
      `UPDATE performance_matrix_defs
       SET matrix_label = $1,
           title = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE financial_year_id = $3 AND matrix_label = $4`,
      [nextLabel, nextTitle, input.financialYearId, currentLabel],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof PerformanceLevelError) {
      throw error;
    }
    if (isUniqueViolation(error)) {
      throw new PerformanceLevelError(
        `Performance matrix "${nextLabel}" already exists for this financial year.`,
        409,
      );
    }
    throw error;
  } finally {
    client.release();
  }

  const summaries = await listPerformanceMatrixSummaries();
  const updated = summaries.find(
    (item) =>
      item.financialYearId === input.financialYearId &&
      item.matrixLabel === nextLabel,
  );
  if (!updated) {
    throw new PerformanceLevelError("Failed to load updated performance matrix.", 500);
  }
  return updated;
}

export async function copyPerformanceMatrix(
  input: CopyPerformanceMatrixInput,
): Promise<PerformanceMatrixSummary> {
  const sourceLabel = input.sourceMatrixLabel.trim();
  const nextLabel = input.newMatrixLabel.trim();
  const nextTitle = input.title.trim() || nextLabel;
  const sourceYearId = input.sourceFinancialYearId;
  const targetYearId = input.targetFinancialYearId;

  if (!sourceLabel || !nextLabel) {
    throw new PerformanceLevelError("Matrix label is required.", 400);
  }
  if (
    sourceYearId === targetYearId &&
    sourceLabel.toLowerCase() === nextLabel.toLowerCase()
  ) {
    throw new PerformanceLevelError(
      "Choose a new label when copying within the same financial year.",
      400,
    );
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const source = await client.query<{ id: string }>(
      `SELECT id
       FROM performance_matrix_defs
       WHERE financial_year_id = $1 AND matrix_label = $2
       LIMIT 1`,
      [sourceYearId, sourceLabel],
    );
    if (!source.rows[0]) {
      throw new PerformanceLevelError("Performance matrix not found.", 404);
    }

    await client.query(
      `INSERT INTO performance_matrix_defs (financial_year_id, matrix_label, title)
       VALUES ($1, $2, $3)`,
      [targetYearId, nextLabel, nextTitle],
    );

    const levels = await client.query<{
      id: string;
      name: string;
      sort_order: number;
    }>(
      `SELECT id, name, sort_order
       FROM performance_levels
       WHERE financial_year_id = $1 AND matrix_label = $2
       ORDER BY sort_order ASC, name ASC`,
      [sourceYearId, sourceLabel],
    );

    for (const level of levels.rows) {
      const insertedLevel = await client.query<{ id: string }>(
        `INSERT INTO performance_levels (financial_year_id, matrix_label, name, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [targetYearId, nextLabel, level.name, level.sort_order],
      );
      const newLevelId = insertedLevel.rows[0]?.id;
      if (!newLevelId) {
        throw new PerformanceLevelError("Failed to copy a performance level.", 500);
      }

      await client.query(
        `INSERT INTO performance_quartiles (
           performance_level_id, name, score_min, score_max, sort_order
         )
         SELECT $1, name, score_min, score_max, sort_order
         FROM performance_quartiles
         WHERE performance_level_id = $2`,
        [newLevelId, level.id],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof PerformanceLevelError) {
      throw error;
    }
    if (isForeignKeyViolation(error)) {
      throw new PerformanceLevelError("Financial year not found.", 404);
    }
    if (isUniqueViolation(error)) {
      throw new PerformanceLevelError(
        `Performance matrix "${nextLabel}" already exists for this financial year.`,
        409,
      );
    }
    throw error;
  } finally {
    client.release();
  }

  const summaries = await listPerformanceMatrixSummaries();
  const copied = summaries.find(
    (item) =>
      item.financialYearId === targetYearId && item.matrixLabel === nextLabel,
  );
  if (!copied) {
    throw new PerformanceLevelError("Failed to load copied performance matrix.", 500);
  }
  return copied;
}

export async function listPerformanceMatrixLabelsByFinancialYearId(
  financialYearId: number,
): Promise<string[]> {
  const result = await db.query<{ matrix_label: string }>(
    `SELECT matrix_label
     FROM performance_matrix_defs
     WHERE financial_year_id = $1
     ORDER BY title ASC, matrix_label ASC`,
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
     FROM performance_matrix_defs
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
