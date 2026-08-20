import "server-only";

import { db } from "@/lib/db";
import { getDbClient, withTransaction } from "@/lib/db-context";
import {
  PERFORMANCE_RATINGS,
  RATING_LABELS,
  type PerformanceRating,
} from "@/types/forms";
import type {
  InstitutionalQuotaChartRow,
  InstitutionalQuotaRecord,
  UpsertInstitutionalQuotasInput,
} from "@/types/institutional-quotas";

interface InstitutionalQuotaRow {
  id: string;
  financial_year_id: number;
  rating: PerformanceRating;
  quota_percent: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export class InstitutionalQuotaError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "InstitutionalQuotaError";
  }
}

function mapRow(row: InstitutionalQuotaRow): InstitutionalQuotaRecord {
  return {
    id: Number(row.id),
    financialYearId: row.financial_year_id,
    rating: row.rating,
    quotaPercent: Number(row.quota_percent),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertFinancialYearExists(financialYearId: number): Promise<void> {
  const result = await getDbClient().query(`SELECT id FROM financial_years WHERE id = $1`, [
    financialYearId,
  ]);

  if (result.rows.length === 0) {
    throw new InstitutionalQuotaError("Financial year not found.", 404);
  }
}

export async function listInstitutionalQuotas(
  financialYearId: number,
): Promise<InstitutionalQuotaRecord[]> {
  await assertFinancialYearExists(financialYearId);

  const result = await getDbClient().query<InstitutionalQuotaRow>(
    `SELECT id, financial_year_id, rating, quota_percent::text, sort_order,
            created_at::text, updated_at::text
     FROM institutional_quotas
     WHERE financial_year_id = $1
     ORDER BY sort_order ASC, id ASC`,
    [financialYearId],
  );

  return result.rows.map(mapRow);
}

/**
 * Quotas for the Performance Rating Curve — always returns one row per rating
 * from DB for the given financial year (missing ratings = 0).
 */
export async function listInstitutionalQuotaChartRows(
  financialYearId: number,
): Promise<InstitutionalQuotaChartRow[]> {
  const quotas = await listInstitutionalQuotas(financialYearId);
  const byRating = new Map(quotas.map((row) => [row.rating, row]));

  return PERFORMANCE_RATINGS.map((rating, index) => {
    const stored = byRating.get(rating);
    return {
      rating: RATING_LABELS[rating],
      quota: stored?.quotaPercent ?? 0,
      sortOrder: stored?.sortOrder ?? index,
    };
  });
}

export async function listInstitutionalQuotaChartRowsForActiveYear(): Promise<{
  financialYearId: number | null;
  rows: InstitutionalQuotaChartRow[];
}> {
  const yearResult = await getDbClient().query<{ id: number }>(
    `SELECT id
     FROM financial_years
     WHERE is_active = TRUE
     ORDER BY year DESC
     LIMIT 1`,
  );

  const activeId = yearResult.rows[0]?.id ?? null;
  if (!activeId) {
    return { financialYearId: null, rows: [] };
  }

  const rows = await listInstitutionalQuotaChartRows(activeId);
  return { financialYearId: activeId, rows };
}

export async function upsertInstitutionalQuotas(
  input: UpsertInstitutionalQuotasInput,
): Promise<InstitutionalQuotaRecord[]> {
  await assertFinancialYearExists(input.financialYearId);

  await withTransaction(async () => {
    const client = getDbClient();

    for (const [index, row] of input.quotas.entries()) {
      await client.query(
        `INSERT INTO institutional_quotas (
           financial_year_id, rating, quota_percent, sort_order
         )
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (financial_year_id, rating)
         DO UPDATE SET
           quota_percent = EXCLUDED.quota_percent,
           sort_order = EXCLUDED.sort_order,
           updated_at = CURRENT_TIMESTAMP`,
        [
          input.financialYearId,
          row.rating,
          row.quotaPercent,
          row.sortOrder ?? index,
        ],
      );
    }
  });

  return listInstitutionalQuotas(input.financialYearId);
}
