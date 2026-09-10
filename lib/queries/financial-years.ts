import "server-only";

import { getDbClient, withTransaction } from "@/lib/db-context";
import type {
  CreateFinancialYearInput,
  FinancialYearRecord,
  UpdateFinancialYearInput,
} from "@/types/financial-years";

interface FinancialYearRow {
  id: number;
  year: number;
  label: string;
  is_active: boolean;
  cycle_start_date: string;
  ineligibility_date: string;
  created_at: string;
  updated_at: string;
}

export class FinancialYearError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "FinancialYearError";
  }
}

function toIsoDate(value: string | Date | null | undefined): string {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return String(value).slice(0, 10);
}

function mapFinancialYearRow(row: FinancialYearRow): FinancialYearRecord {
  return {
    id: row.id,
    year: row.year,
    label: row.label,
    isActive: row.is_active,
    cycleStartDate: toIsoDate(row.cycle_start_date),
    ineligibilityDate: toIsoDate(row.ineligibility_date),
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

async function deactivateOtherYears(excludeId?: number): Promise<void> {
  if (excludeId) {
    await getDbClient().query(
      `UPDATE financial_years SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id <> $1`,
      [excludeId],
    );
    return;
  }

  await getDbClient().query(
    `UPDATE financial_years SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP`,
  );
}

const FINANCIAL_YEAR_SELECT = `
  SELECT id, year, label, is_active,
         cycle_start_date::text, ineligibility_date::text,
         created_at::text, updated_at::text
  FROM financial_years
`;

export async function listFinancialYears(): Promise<FinancialYearRecord[]> {
  const result = await getDbClient().query<FinancialYearRow>(
    `${FINANCIAL_YEAR_SELECT}
     ORDER BY year DESC`,
  );

  return result.rows.map(mapFinancialYearRow);
}

export async function getFinancialYearById(
  id: number,
): Promise<FinancialYearRecord | null> {
  const result = await getDbClient().query<FinancialYearRow>(
    `${FINANCIAL_YEAR_SELECT}
     WHERE id = $1`,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapFinancialYearRow(result.rows[0]);
}

export async function getActiveFinancialYear(): Promise<FinancialYearRecord | null> {
  const result = await getDbClient().query<FinancialYearRow>(
    `${FINANCIAL_YEAR_SELECT}
     WHERE is_active = TRUE
     ORDER BY year DESC
     LIMIT 1`,
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapFinancialYearRow(result.rows[0]);
}

export async function createFinancialYear(
  input: CreateFinancialYearInput,
): Promise<FinancialYearRecord> {
  try {
    return await withTransaction(async () => {
      const client = getDbClient();

      if (input.isActive) {
        await client.query(
          `UPDATE financial_years SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP`,
        );
      }

      const result = await client.query<FinancialYearRow>(
        `INSERT INTO financial_years (
           year, label, is_active, cycle_start_date, ineligibility_date
         )
         VALUES ($1, $2, $3, $4::date, $5::date)
         RETURNING id, year, label, is_active,
                   cycle_start_date::text, ineligibility_date::text,
                   created_at::text, updated_at::text`,
        [
          input.year,
          input.label.trim(),
          input.isActive ?? false,
          input.cycleStartDate.trim(),
          input.ineligibilityDate.trim(),
        ],
      );

      return mapFinancialYearRow(result.rows[0]);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new FinancialYearError(
        "A financial year with this year or label already exists.",
        409,
      );
    }

    throw error;
  }
}

export async function updateFinancialYear(
  id: number,
  input: UpdateFinancialYearInput,
): Promise<FinancialYearRecord> {
  try {
    return await withTransaction(async () => {
      const client = getDbClient();

      if (input.isActive) {
        await deactivateOtherYears(id);
      }

      const result = await client.query<FinancialYearRow>(
        `UPDATE financial_years
         SET year = $1,
             label = $2,
             is_active = COALESCE($3, is_active),
             cycle_start_date = $4::date,
             ineligibility_date = $5::date,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING id, year, label, is_active,
                   cycle_start_date::text, ineligibility_date::text,
                   created_at::text, updated_at::text`,
        [
          input.year,
          input.label.trim(),
          input.isActive ?? null,
          input.cycleStartDate.trim(),
          input.ineligibilityDate.trim(),
          id,
        ],
      );

      if (result.rows.length === 0) {
        throw new FinancialYearError("Financial year not found.", 404);
      }

      return mapFinancialYearRow(result.rows[0]);
    });
  } catch (error) {
    if (error instanceof FinancialYearError) {
      throw error;
    }

    if (isUniqueViolation(error)) {
      throw new FinancialYearError(
        "A financial year with this year or label already exists.",
        409,
      );
    }

    throw error;
  }
}

export async function deleteFinancialYear(id: number): Promise<void> {
  try {
    const result = await getDbClient().query(`DELETE FROM financial_years WHERE id = $1`, [
      id,
    ]);

    if (result.rowCount === 0) {
      throw new FinancialYearError("Financial year not found.", 404);
    }
  } catch (error) {
    if (error instanceof FinancialYearError) {
      throw error;
    }

    if (isForeignKeyViolation(error)) {
      throw new FinancialYearError(
        "Cannot delete a financial year that has performance levels assigned.",
        409,
      );
    }

    throw error;
  }
}
