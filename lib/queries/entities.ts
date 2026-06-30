import "server-only";

import { db } from "../db";
import type {
  CreateEntityInput,
  EntityRecord,
  UpdateEntityInput,
} from "@/types/entities";
import { normalizeEntityInput } from "@/lib/validation/entities";

interface EntityRow {
  id: string;
  name: string;
  entity_category_id: number;
  category_code: string;
  parent_entity_id: string | null;
  parent_name: string | null;
  created_at: string;
  updated_at: string;
}

const ENTITY_SELECT = `
  SELECT
    e.id,
    e.name,
    e.entity_category_id,
    ec.code AS category_code,
    e.parent_entity_id,
    p.name AS parent_name,
    e.created_at::text,
    e.updated_at::text
  FROM entities e
  JOIN entity_categories ec ON ec.id = e.entity_category_id
  LEFT JOIN entities p ON p.id = e.parent_entity_id
`;

export class EntityError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "EntityError";
  }
}

function mapEntityRow(row: EntityRow): EntityRecord {
  return {
    id: Number(row.id),
    name: row.name,
    entityCategoryId: row.entity_category_id,
    categoryCode: row.category_code,
    parentEntityId: row.parent_entity_id ? Number(row.parent_entity_id) : null,
    parentName: row.parent_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23503"
  );
}

async function assertCategoryExists(categoryId: number): Promise<void> {
  const result = await db.query(`SELECT id FROM entity_categories WHERE id = $1`, [
    categoryId,
  ]);

  if (result.rows.length === 0) {
    throw new EntityError("Entity category not found.", 404);
  }
}

async function getParentEntityId(entityId: number): Promise<number | null> {
  const result = await db.query<{ parent_entity_id: string | null }>(
    `SELECT parent_entity_id FROM entities WHERE id = $1`,
    [entityId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const parentId = result.rows[0].parent_entity_id;
  return parentId ? Number(parentId) : null;
}

async function entityExists(id: number): Promise<boolean> {
  const result = await db.query(`SELECT id FROM entities WHERE id = $1`, [id]);
  return result.rows.length > 0;
}

async function assertValidParent(
  entityId: number | null,
  parentId: number | null,
): Promise<void> {
  if (parentId === null) {
    return;
  }

  if (entityId !== null && parentId === entityId) {
    throw new EntityError("An entity cannot be its own parent.", 400);
  }

  if (!(await entityExists(parentId))) {
    throw new EntityError("Parent entity not found.", 404);
  }

  if (entityId === null) {
    return;
  }

  let currentId: number | null = parentId;

  while (currentId !== null) {
    if (currentId === entityId) {
      throw new EntityError(
        "Invalid parent: this would create a circular hierarchy.",
        400,
      );
    }

    currentId = await getParentEntityId(currentId);
  }
}

export async function listEntities(): Promise<EntityRecord[]> {
  const result = await db.query<EntityRow>(
    `${ENTITY_SELECT}
     ORDER BY e.name ASC`,
  );

  return result.rows.map(mapEntityRow);
}

export async function getEntityById(id: number): Promise<EntityRecord | null> {
  const result = await db.query<EntityRow>(
    `${ENTITY_SELECT}
     WHERE e.id = $1`,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapEntityRow(result.rows[0]);
}

export async function createEntity(
  input: CreateEntityInput,
): Promise<EntityRecord> {
  const normalized = normalizeEntityInput(input);

  await assertCategoryExists(normalized.entityCategoryId);
  await assertValidParent(null, normalized.parentEntityId);

  try {
    const result = await db.query<{ id: string }>(
      `INSERT INTO entities (name, entity_category_id, parent_entity_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [
        normalized.name,
        normalized.entityCategoryId,
        normalized.parentEntityId,
      ],
    );

    const created = await getEntityById(Number(result.rows[0].id));

    if (!created) {
      throw new EntityError("Failed to load created entity.", 500);
    }

    return created;
  } catch (error) {
    if (error instanceof EntityError) {
      throw error;
    }

    if (isForeignKeyViolation(error)) {
      throw new EntityError("Invalid entity category or parent reference.", 400);
    }

    throw error;
  }
}

export async function updateEntity(
  id: number,
  input: UpdateEntityInput,
): Promise<EntityRecord> {
  const normalized = normalizeEntityInput(input);

  await assertCategoryExists(normalized.entityCategoryId);
  await assertValidParent(id, normalized.parentEntityId);

  try {
    const result = await db.query(
      `UPDATE entities
       SET name = $1,
           entity_category_id = $2,
           parent_entity_id = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [
        normalized.name,
        normalized.entityCategoryId,
        normalized.parentEntityId,
        id,
      ],
    );

    if (result.rowCount === 0) {
      throw new EntityError("Entity not found.", 404);
    }

    const updated = await getEntityById(id);

    if (!updated) {
      throw new EntityError("Failed to load updated entity.", 500);
    }

    return updated;
  } catch (error) {
    if (error instanceof EntityError) {
      throw error;
    }

    if (isForeignKeyViolation(error)) {
      throw new EntityError("Invalid entity category or parent reference.", 400);
    }

    throw error;
  }
}

export async function deleteEntity(id: number): Promise<void> {
  const result = await db.query(`DELETE FROM entities WHERE id = $1`, [id]);

  if (result.rowCount === 0) {
    throw new EntityError("Entity not found.", 404);
  }
}
