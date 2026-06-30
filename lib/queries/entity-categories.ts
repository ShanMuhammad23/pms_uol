import "server-only";

import { db } from "../db";
import type {
  CreateEntityCategoryInput,
  EntityCategoryCode,
  EntityCategoryRecord,
  UpdateEntityCategoryInput,
} from "@/types/entity-categories";

interface EntityCategoryRow {
  id: number;
  code: EntityCategoryCode;
  created_at: string;
  updated_at: string;
}

export class EntityCategoryError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "EntityCategoryError";
  }
}

function mapEntityCategoryRow(row: EntityCategoryRow): EntityCategoryRecord {
  return {
    id: row.id,
    code: row.code,
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

export async function listEntityCategories(): Promise<EntityCategoryRecord[]> {
  const result = await db.query<EntityCategoryRow>(
    `SELECT id, code, created_at::text, updated_at::text
     FROM entity_categories
     ORDER BY code ASC`,
  );

  return result.rows.map(mapEntityCategoryRow);
}

export async function getEntityCategoryById(
  id: number,
): Promise<EntityCategoryRecord | null> {
  const result = await db.query<EntityCategoryRow>(
    `SELECT id, code, created_at::text, updated_at::text
     FROM entity_categories
     WHERE id = $1`,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapEntityCategoryRow(result.rows[0]);
}

export async function createEntityCategory(
  input: CreateEntityCategoryInput,
): Promise<EntityCategoryRecord> {
  try {
    const result = await db.query<EntityCategoryRow>(
      `INSERT INTO entity_categories (code)
       VALUES ($1)
       RETURNING id, code, created_at::text, updated_at::text`,
      [input.code],
    );

    return mapEntityCategoryRow(result.rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new EntityCategoryError(
        `Category code "${input.code}" already exists.`,
        409,
      );
    }

    throw error;
  }
}

export async function updateEntityCategory(
  id: number,
  input: UpdateEntityCategoryInput,
): Promise<EntityCategoryRecord> {
  try {
    const result = await db.query<EntityCategoryRow>(
      `UPDATE entity_categories
       SET code = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, code, created_at::text, updated_at::text`,
      [input.code, id],
    );

    if (result.rows.length === 0) {
      throw new EntityCategoryError("Entity category not found.", 404);
    }

    return mapEntityCategoryRow(result.rows[0]);
  } catch (error) {
    if (error instanceof EntityCategoryError) {
      throw error;
    }

    if (isUniqueViolation(error)) {
      throw new EntityCategoryError(
        `Category code "${input.code}" already exists.`,
        409,
      );
    }

    throw error;
  }
}

export async function deleteEntityCategory(id: number): Promise<void> {
  const result = await db.query(
    `DELETE FROM entity_categories WHERE id = $1`,
    [id],
  );

  if (result.rowCount === 0) {
    throw new EntityCategoryError("Entity category not found.", 404);
  }
}
