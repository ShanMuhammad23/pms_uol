import "server-only";

import { db } from "../db";
import type {
  CreatePerformanceQuartileInput,
  PerformanceQuartileRecord,
  UpdatePerformanceQuartileInput,
} from "@/types/performance-matrices";

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

export class PerformanceQuartileError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "PerformanceQuartileError";
  }
}

function mapPerformanceQuartileRow(
  row: PerformanceQuartileRow,
): PerformanceQuartileRecord {
  return {
    id: row.id,
    performanceLevelId: row.performance_level_id,
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

function isCheckViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23514"
  );
}

export async function listPerformanceQuartilesByLevelId(
  performanceLevelId: number,
): Promise<PerformanceQuartileRecord[]> {
  const result = await db.query<PerformanceQuartileRow>(
    `SELECT id, performance_level_id, name, score_min, score_max, sort_order, created_at::text, updated_at::text
     FROM performance_quartiles
     WHERE performance_level_id = $1
     ORDER BY sort_order ASC, name ASC`,
    [performanceLevelId],
  );

  return result.rows.map(mapPerformanceQuartileRow);
}

export async function getPerformanceQuartileById(
  id: number,
): Promise<PerformanceQuartileRecord | null> {
  const result = await db.query<PerformanceQuartileRow>(
    `SELECT id, performance_level_id, name, score_min, score_max, sort_order, created_at::text, updated_at::text
     FROM performance_quartiles
     WHERE id = $1`,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapPerformanceQuartileRow(result.rows[0]);
}

export async function createPerformanceQuartile(
  input: CreatePerformanceQuartileInput,
): Promise<PerformanceQuartileRecord> {
  try {
    const result = await db.query<PerformanceQuartileRow>(
      `INSERT INTO performance_quartiles (performance_level_id, name, score_min, score_max, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, performance_level_id, name, score_min, score_max, sort_order, created_at::text, updated_at::text`,
      [
        input.performanceLevelId,
        input.name.trim(),
        input.scoreMin,
        input.scoreMax,
        input.sortOrder ?? 0,
      ],
    );

    return mapPerformanceQuartileRow(result.rows[0]);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new PerformanceQuartileError("Performance level not found.", 404);
    }

    if (isUniqueViolation(error)) {
      throw new PerformanceQuartileError(
        `Quartile "${input.name.trim()}" already exists for this performance level.`,
        409,
      );
    }

    if (isCheckViolation(error)) {
      throw new PerformanceQuartileError(
        "Minimum score must be less than maximum score.",
        400,
      );
    }

    throw error;
  }
}

export async function updatePerformanceQuartile(
  id: number,
  input: UpdatePerformanceQuartileInput,
): Promise<PerformanceQuartileRecord> {
  try {
    const result = await db.query<PerformanceQuartileRow>(
      `UPDATE performance_quartiles
       SET name = $1, score_min = $2, score_max = $3, sort_order = COALESCE($4, sort_order), updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, performance_level_id, name, score_min, score_max, sort_order, created_at::text, updated_at::text`,
      [
        input.name.trim(),
        input.scoreMin,
        input.scoreMax,
        input.sortOrder ?? null,
        id,
      ],
    );

    if (result.rows.length === 0) {
      throw new PerformanceQuartileError("Performance quartile not found.", 404);
    }

    return mapPerformanceQuartileRow(result.rows[0]);
  } catch (error) {
    if (error instanceof PerformanceQuartileError) {
      throw error;
    }

    if (isUniqueViolation(error)) {
      throw new PerformanceQuartileError(
        `Quartile "${input.name.trim()}" already exists for this performance level.`,
        409,
      );
    }

    if (isCheckViolation(error)) {
      throw new PerformanceQuartileError(
        "Minimum score must be less than maximum score.",
        400,
      );
    }

    throw error;
  }
}

export async function deletePerformanceQuartile(id: number): Promise<void> {
  const result = await db.query(`DELETE FROM performance_quartiles WHERE id = $1`, [
    id,
  ]);

  if (result.rowCount === 0) {
    throw new PerformanceQuartileError("Performance quartile not found.", 404);
  }
}
