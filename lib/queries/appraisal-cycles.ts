import "server-only";

import { db } from "../db";
import type {
  AppraisalCycleRecord,
  CreateAppraisalCycleInput,
} from "@/types/forms";

interface AppraisalCycleRow {
  id: number;
  fiscal_year: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

function mapCycleRow(row: AppraisalCycleRow): AppraisalCycleRecord {
  return {
    id: row.id,
    fiscalYear: row.fiscal_year,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function listAppraisalCycles(): Promise<AppraisalCycleRecord[]> {
  const result = await db.query<AppraisalCycleRow>(
    `SELECT id, fiscal_year, start_date::text, end_date::text, is_active, created_at::text
     FROM appraisal_cycles
     ORDER BY fiscal_year DESC`,
  );

  return result.rows.map(mapCycleRow);
}

export async function createAppraisalCycle(
  input: CreateAppraisalCycleInput,
): Promise<AppraisalCycleRecord> {
  const result = await db.query<AppraisalCycleRow>(
    `INSERT INTO appraisal_cycles (fiscal_year, start_date, end_date, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING id, fiscal_year, start_date::text, end_date::text, is_active, created_at::text`,
    [
      input.fiscalYear,
      input.startDate,
      input.endDate,
      input.isActive ?? false,
    ],
  );

  return mapCycleRow(result.rows[0]);
}

export async function getDefaultAppraisalCycle(): Promise<AppraisalCycleRecord | null> {
  const result = await db.query<AppraisalCycleRow>(
    `SELECT id, fiscal_year, start_date::text, end_date::text, is_active, created_at::text
     FROM appraisal_cycles
     ORDER BY is_active DESC, fiscal_year DESC
     LIMIT 1`,
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapCycleRow(result.rows[0]);
}

export async function ensureDefaultAppraisalCycle(): Promise<AppraisalCycleRecord> {
  const existing = await getDefaultAppraisalCycle();
  if (existing) {
    return existing;
  }

  const currentYear = new Date().getFullYear();

  await db.query(
    `INSERT INTO appraisal_cycles (fiscal_year, start_date, end_date, is_active)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (fiscal_year) DO NOTHING`,
    [
      currentYear,
      `${currentYear}-01-01`,
      `${currentYear}-12-31`,
    ],
  );

  const created = await getDefaultAppraisalCycle();
  if (!created) {
    throw new Error("Failed to initialize the default appraisal cycle.");
  }

  return created;
}

export async function getAppraisalCycleById(
  id: number,
): Promise<AppraisalCycleRecord | null> {
  const result = await db.query<AppraisalCycleRow>(
    `SELECT id, fiscal_year, start_date::text, end_date::text, is_active, created_at::text
     FROM appraisal_cycles
     WHERE id = $1`,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapCycleRow(result.rows[0]);
}
