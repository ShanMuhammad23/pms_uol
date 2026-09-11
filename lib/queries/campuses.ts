import "server-only";

import { getDbClient } from "@/lib/db-context";
import type {
  CampusRecord,
  CreateCampusInput,
  UpdateCampusInput,
} from "@/types/campuses";

export class CampusError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "CampusError";
  }
}

interface CampusRow {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapCampusRow(row: CampusRow): CampusRecord {
  return {
    id: Number(row.id),
    name: row.name,
    code: row.code,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCampuses(): Promise<CampusRecord[]> {
  const result = await getDbClient().query<CampusRow>(
    `SELECT id, name, code, is_active, created_at::text, updated_at::text
     FROM campuses
     ORDER BY id ASC`,
  );
  return result.rows.map(mapCampusRow);
}

export async function listActiveCampuses(): Promise<CampusRecord[]> {
  const result = await getDbClient().query<CampusRow>(
    `SELECT id, name, code, is_active, created_at::text, updated_at::text
     FROM campuses
     WHERE is_active = TRUE
     ORDER BY id ASC`,
  );
  return result.rows.map(mapCampusRow);
}

export async function getCampusById(id: number): Promise<CampusRecord | null> {
  const result = await getDbClient().query<CampusRow>(
    `SELECT id, name, code, is_active, created_at::text, updated_at::text
     FROM campuses
     WHERE id = $1`,
    [id],
  );
  if (result.rows.length === 0) return null;
  return mapCampusRow(result.rows[0]);
}

export async function createCampus(input: CreateCampusInput): Promise<CampusRecord> {
  try {
    const result = await getDbClient().query<{ id: string }>(
      `INSERT INTO campuses (name, code, is_active)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [input.name.trim(), input.code.trim().toUpperCase(), input.isActive ?? true],
    );
    const created = await getCampusById(Number(result.rows[0].id));
    if (!created) throw new CampusError("Failed to load created campus.", 500);
    return created;
  } catch (error) {
    if (error instanceof CampusError) throw error;
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      throw new CampusError("A campus with this name or code already exists.", 409);
    }
    throw error;
  }
}

export async function updateCampus(
  id: number,
  input: UpdateCampusInput,
): Promise<CampusRecord> {
  try {
    await getDbClient().query(
      `UPDATE campuses
       SET name = $1, code = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [input.name.trim(), input.code.trim().toUpperCase(), input.isActive ?? true, id],
    );
    const updated = await getCampusById(id);
    if (!updated) throw new CampusError("Campus not found.", 404);
    return updated;
  } catch (error) {
    if (error instanceof CampusError) throw error;
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      throw new CampusError("A campus with this name or code already exists.", 409);
    }
    throw error;
  }
}
