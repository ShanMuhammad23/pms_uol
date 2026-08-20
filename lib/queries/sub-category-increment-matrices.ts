import "server-only";

import { db } from "../db";
import { getDbClient, withTransaction } from "@/lib/db-context";
import type {
  CopyIncrementMatrixInput,
  CreateIncrementMatrixInput,
  CreateSubCategoryIncrementMatrixInput,
  IncrementMatrixAssignmentRecord,
  IncrementMatrixSummary,
  SubCategoryIncrementMatrixRecord,
  UpdateIncrementMatrixIdentityInput,
  UpdateSubCategoryIncrementMatrixInput,
} from "@/types/sub-category-increment-matrices";

interface IncrementMatrixRow {
  id: string;
  financial_year_id: number;
  matrix_label: string;
  performance_matrix_label: string;
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

function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23503"
  );
}

function mapRow(row: IncrementMatrixRow): SubCategoryIncrementMatrixRecord {
  return {
    id: Number(row.id),
    financialYearId: row.financial_year_id,
    matrixLabel: row.matrix_label,
    performanceMatrixLabel: row.performance_matrix_label,
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
    pl.matrix_label AS performance_matrix_label,
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
  const result = await getDbClient().query<{ id: string }>(
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
  const result = await getDbClient().query<IncrementMatrixRow>(
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
  const result = await getDbClient().query<IncrementMatrixRow>(
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
    const result = await getDbClient().query<{ id: string }>(
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
    const result = await getDbClient().query(
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
  const result = await getDbClient().query(
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
  const result = await getDbClient().query<{ matrix_label: string }>(
    `SELECT matrix_label
     FROM increment_matrix_defs
     WHERE financial_year_id = $1
     ORDER BY title ASC, matrix_label ASC`,
    [financialYearId],
  );
  return result.rows.map((row) => row.matrix_label);
}

export async function listIncrementMatrixSummaries(): Promise<
  IncrementMatrixSummary[]
> {
  const result = await getDbClient().query<{
    financial_year_id: number;
    financial_year_label: string;
    is_active: boolean;
    matrix_label: string;
    title: string;
    cell_count: string;
    assigned_employee_count: string;
    updated_at: string;
  }>(
    `SELECT
       d.financial_year_id,
       fy.label AS financial_year_label,
       fy.is_active,
       d.matrix_label,
       d.title,
       COUNT(sim.id)::text AS cell_count,
       (
         SELECT COUNT(*)::text
         FROM employee_increment_matrix_assignments eima
         WHERE eima.financial_year_id = d.financial_year_id
           AND eima.matrix_label = d.matrix_label
       ) AS assigned_employee_count,
       d.updated_at::text AS updated_at
     FROM increment_matrix_defs d
     INNER JOIN financial_years fy ON fy.id = d.financial_year_id
     LEFT JOIN sub_category_increment_matrices sim
       ON sim.financial_year_id = d.financial_year_id
      AND sim.matrix_label = d.matrix_label
     GROUP BY d.financial_year_id, fy.label, fy.is_active, d.matrix_label, d.title, d.updated_at
     ORDER BY fy.is_active DESC, fy.label DESC, d.title ASC, d.matrix_label ASC`,
  );

  return result.rows.map((row) => ({
    financialYearId: Number(row.financial_year_id),
    financialYearLabel: row.financial_year_label,
    isActiveYear: row.is_active,
    matrixLabel: row.matrix_label,
    title: row.title,
    cellCount: Number(row.cell_count),
    assignedEmployeeCount: Number(row.assigned_employee_count),
    updatedAt: row.updated_at,
  }));
}

export async function createIncrementMatrix(
  input: CreateIncrementMatrixInput,
): Promise<IncrementMatrixSummary> {
  const trimmedLabel = input.matrixLabel.trim();
  const trimmedTitle = input.title.trim() || trimmedLabel;

  if (!trimmedLabel) {
    throw new SubCategoryIncrementMatrixError("Matrix label is required.", 400);
  }

  try {
    await getDbClient().query(
      `INSERT INTO increment_matrix_defs (financial_year_id, matrix_label, title)
       VALUES ($1, $2, $3)`,
      [input.financialYearId, trimmedLabel, trimmedTitle],
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new SubCategoryIncrementMatrixError(
        `Increment matrix "${trimmedLabel}" already exists for this financial year.`,
        409,
      );
    }
    throw error;
  }

  const summaries = await listIncrementMatrixSummaries();
  const created = summaries.find(
    (item) =>
      item.financialYearId === input.financialYearId &&
      item.matrixLabel === trimmedLabel,
  );
  if (!created) {
    throw new SubCategoryIncrementMatrixError(
      "Failed to load created increment matrix.",
      500,
    );
  }
  return created;
}

export async function updateIncrementMatrixIdentity(
  input: UpdateIncrementMatrixIdentityInput,
): Promise<IncrementMatrixSummary> {
  const currentLabel = input.matrixLabel.trim();
  const nextLabel = input.newMatrixLabel.trim();
  const nextTitle = input.title.trim() || nextLabel;

  if (!currentLabel || !nextLabel) {
    throw new SubCategoryIncrementMatrixError("Matrix label is required.", 400);
  }

  await withTransaction(async () => {
    const client = getDbClient();

    const existing = await client.query<{ id: string }>(
      `SELECT id
       FROM increment_matrix_defs
       WHERE financial_year_id = $1 AND matrix_label = $2
       LIMIT 1`,
      [input.financialYearId, currentLabel],
    );
    if (!existing.rows[0]) {
      throw new SubCategoryIncrementMatrixError("Increment matrix not found.", 404);
    }

    if (nextLabel !== currentLabel) {
      const conflict = await client.query<{ id: string }>(
        `SELECT id
         FROM increment_matrix_defs
         WHERE financial_year_id = $1 AND matrix_label = $2
         LIMIT 1`,
        [input.financialYearId, nextLabel],
      );
      if (conflict.rows[0]) {
        throw new SubCategoryIncrementMatrixError(
          `Increment matrix "${nextLabel}" already exists for this financial year.`,
          409,
        );
      }

      await client.query(
        `UPDATE sub_category_increment_matrices
         SET matrix_label = $1, updated_at = CURRENT_TIMESTAMP
         WHERE financial_year_id = $2 AND matrix_label = $3`,
        [nextLabel, input.financialYearId, currentLabel],
      );
      await client.query(
        `UPDATE employee_increment_matrix_assignments
         SET matrix_label = $1, updated_at = CURRENT_TIMESTAMP
         WHERE financial_year_id = $2 AND matrix_label = $3`,
        [nextLabel, input.financialYearId, currentLabel],
      );
    }

    await client.query(
      `UPDATE increment_matrix_defs
       SET matrix_label = $1,
           title = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE financial_year_id = $3 AND matrix_label = $4`,
      [nextLabel, nextTitle, input.financialYearId, currentLabel],
    );
  });

  const summaries = await listIncrementMatrixSummaries();
  const updated = summaries.find(
    (item) =>
      item.financialYearId === input.financialYearId &&
      item.matrixLabel === nextLabel,
  );
  if (!updated) {
    throw new SubCategoryIncrementMatrixError(
      "Failed to load updated increment matrix.",
      500,
    );
  }
  return updated;
}

export async function copyIncrementMatrix(
  input: CopyIncrementMatrixInput,
): Promise<IncrementMatrixSummary> {
  const sourceLabel = input.sourceMatrixLabel.trim();
  const nextLabel = input.newMatrixLabel.trim();
  const nextTitle = input.title.trim() || nextLabel;
  const sourceYearId = input.sourceFinancialYearId;
  const targetYearId = input.targetFinancialYearId;

  if (!sourceLabel || !nextLabel) {
    throw new SubCategoryIncrementMatrixError("Matrix label is required.", 400);
  }
  if (
    sourceYearId === targetYearId &&
    sourceLabel.toLowerCase() === nextLabel.toLowerCase()
  ) {
    throw new SubCategoryIncrementMatrixError(
      "Choose a new label when copying within the same financial year.",
      400,
    );
  }

  await withTransaction(async () => {
    const client = getDbClient();

    const source = await client.query<{ id: string }>(
      `SELECT id
       FROM increment_matrix_defs
       WHERE financial_year_id = $1 AND matrix_label = $2
       LIMIT 1`,
      [sourceYearId, sourceLabel],
    );
    if (!source.rows[0]) {
      throw new SubCategoryIncrementMatrixError("Increment matrix not found.", 404);
    }

    await client.query(
      `INSERT INTO increment_matrix_defs (financial_year_id, matrix_label, title)
       VALUES ($1, $2, $3)`,
      [targetYearId, nextLabel, nextTitle],
    );

    if (sourceYearId === targetYearId) {
      await client.query(
        `INSERT INTO sub_category_increment_matrices (
           financial_year_id,
           matrix_label,
           performance_quartile_id,
           increment_percentage
         )
         SELECT $1, $2, performance_quartile_id, increment_percentage
         FROM sub_category_increment_matrices
         WHERE financial_year_id = $3 AND matrix_label = $4`,
        [targetYearId, nextLabel, sourceYearId, sourceLabel],
      );
    } else {
      const unmapped = await client.query<{
        performance_matrix_label: string;
        level_name: string;
        quartile_name: string;
      }>(
        `SELECT
           spl.matrix_label AS performance_matrix_label,
           spl.name AS level_name,
           spq.name AS quartile_name
         FROM sub_category_increment_matrices sim
         INNER JOIN performance_quartiles spq ON spq.id = sim.performance_quartile_id
         INNER JOIN performance_levels spl ON spl.id = spq.performance_level_id
         LEFT JOIN performance_levels tpl
           ON tpl.financial_year_id = $1
          AND tpl.matrix_label = spl.matrix_label
          AND tpl.name = spl.name
         LEFT JOIN performance_quartiles tpq
           ON tpq.performance_level_id = tpl.id
          AND tpq.name = spq.name
         WHERE sim.financial_year_id = $2
           AND sim.matrix_label = $3
           AND tpq.id IS NULL
         ORDER BY spl.matrix_label, spl.name, spq.name`,
        [targetYearId, sourceYearId, sourceLabel],
      );

      if (unmapped.rows.length > 0) {
        const first = unmapped.rows[0];
        throw new SubCategoryIncrementMatrixError(
          `Cannot copy increment percentages: "${first.performance_matrix_label}" / ${first.level_name} / ${first.quartile_name} does not exist in the target cycle. Copy the matching performance matrix first.`,
          400,
        );
      }

      await client.query(
        `INSERT INTO sub_category_increment_matrices (
           financial_year_id,
           matrix_label,
           performance_quartile_id,
           increment_percentage
         )
         SELECT $1, $2, tpq.id, sim.increment_percentage
         FROM sub_category_increment_matrices sim
         INNER JOIN performance_quartiles spq ON spq.id = sim.performance_quartile_id
         INNER JOIN performance_levels spl ON spl.id = spq.performance_level_id
         INNER JOIN performance_levels tpl
           ON tpl.financial_year_id = $1
          AND tpl.matrix_label = spl.matrix_label
          AND tpl.name = spl.name
         INNER JOIN performance_quartiles tpq
           ON tpq.performance_level_id = tpl.id
          AND tpq.name = spq.name
         WHERE sim.financial_year_id = $3 AND sim.matrix_label = $4`,
        [targetYearId, nextLabel, sourceYearId, sourceLabel],
      );
    }
  }).catch((error) => {
    if (error instanceof SubCategoryIncrementMatrixError) {
      throw error;
    }
    if (isForeignKeyViolation(error)) {
      throw new SubCategoryIncrementMatrixError("Financial year not found.", 404);
    }
    if (isUniqueViolation(error)) {
      throw new SubCategoryIncrementMatrixError(
        `Increment matrix "${nextLabel}" already exists for this financial year.`,
        409,
      );
    }
    throw error;
  });

  const summaries = await listIncrementMatrixSummaries();
  const copied = summaries.find(
    (item) =>
      item.financialYearId === targetYearId && item.matrixLabel === nextLabel,
  );
  if (!copied) {
    throw new SubCategoryIncrementMatrixError(
      "Failed to load copied increment matrix.",
      500,
    );
  }
  return copied;
}

export async function deleteIncrementMatrix(
  financialYearId: number,
  matrixLabel: string,
): Promise<void> {
  const trimmedLabel = matrixLabel.trim();
  if (!trimmedLabel) {
    throw new SubCategoryIncrementMatrixError("Matrix label is required.", 400);
  }

  await withTransaction(async () => {
    const client = getDbClient();

    const existing = await client.query<{ id: string }>(
      `SELECT id
       FROM increment_matrix_defs
       WHERE financial_year_id = $1 AND matrix_label = $2
       LIMIT 1`,
      [financialYearId, trimmedLabel],
    );

    if (!existing.rows[0]) {
      throw new SubCategoryIncrementMatrixError(
        "Increment matrix not found.",
        404,
      );
    }

    await client.query(
      `DELETE FROM employee_increment_matrix_assignments
       WHERE financial_year_id = $1 AND matrix_label = $2`,
      [financialYearId, trimmedLabel],
    );

    await client.query(
      `DELETE FROM sub_category_increment_matrices
       WHERE financial_year_id = $1 AND matrix_label = $2`,
      [financialYearId, trimmedLabel],
    );

    await client.query(
      `DELETE FROM increment_matrix_defs
       WHERE financial_year_id = $1 AND matrix_label = $2`,
      [financialYearId, trimmedLabel],
    );
  });
}

export async function listEmployeeIncrementMatrixAssignments(
  financialYearId: number,
): Promise<IncrementMatrixAssignmentRecord[]> {
  const result = await getDbClient().query<{
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

  const matrixExists = await getDbClient().query<{ id: string }>(
    `SELECT id
     FROM increment_matrix_defs
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
  const conflicts = await getDbClient().query<{
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
  const result = await getDbClient().query<{ employee_id: string }>(
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
  matrixLabel?: string,
): Promise<{ unassignedCount: number; financialYearId: number }> {
  const normalizedCodes = [...new Set(employeeCodes.map((c) => c.trim()).filter(Boolean))];

  if (normalizedCodes.length === 0) {
    throw new SubCategoryIncrementMatrixError("At least one employee is required.", 400);
  }

  const trimmedLabel = matrixLabel?.trim();
  const result = await getDbClient().query(
    `DELETE FROM employee_increment_matrix_assignments
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
