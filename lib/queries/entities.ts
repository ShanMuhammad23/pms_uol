import "server-only";

import { db } from "../db";
import type {
  CreateEntityInput,
  EntityRecord,
  UpdateEntityInput,
} from "@/types/entities";
import { enrichEntitiesWithSubtreeStaffCounts } from "@/app/helpers/dashboard-entity-filters";
import { normalizeEntityInput } from "@/lib/validation/entities";

interface EntityRow {
  id: string;
  name: string;
  entity_category_id: number;
  category_code: string;
  parent_entity_id: string | null;
  parent_name: string | null;
  parent_category_code: string | null;
  staff_count: string | number | null;
  created_at: string;
  updated_at: string;
}

let cachedUsersEntityColumn: boolean | null = null;

async function hasUsersEntityColumn(): Promise<boolean> {
  if (cachedUsersEntityColumn !== null) {
    return cachedUsersEntityColumn;
  }

  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'users'
         AND column_name = 'entity_id'
     ) AS exists`,
  );

  cachedUsersEntityColumn = Boolean(result.rows[0]?.exists);
  return cachedUsersEntityColumn;
}

async function buildEntitySelect(): Promise<string> {
  const staffCountSelect = (await hasUsersEntityColumn())
    ? `(
         SELECT COUNT(*)::int
         FROM users u
         WHERE u.entity_id = e.id
       ) AS staff_count`
    : `0 AS staff_count`;

  return `
  SELECT
    e.id,
    e.name,
    e.entity_category_id,
    ec.code AS category_code,
    e.parent_entity_id,
    p.name AS parent_name,
    pc.code AS parent_category_code,
    ${staffCountSelect},
    e.created_at::text,
    e.updated_at::text
  FROM entities e
  JOIN entity_categories ec ON ec.id = e.entity_category_id
  LEFT JOIN entities p ON p.id = e.parent_entity_id
  LEFT JOIN entity_categories pc ON pc.id = p.entity_category_id
`;
}

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
    parentCategoryCode: row.parent_category_code,
    staffCount: Number(row.staff_count ?? 0),
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
  const entitySelect = await buildEntitySelect();
  const result = await db.query<EntityRow>(
    `${entitySelect}
     ORDER BY e.name ASC`,
  );

  // Staff are usually assigned to leaf/child entities; roll those counts up
  // so C0/C1 parents show the full subtree headcount.
  return enrichEntitiesWithSubtreeStaffCounts(result.rows.map(mapEntityRow));
}

export async function getEntityById(id: number): Promise<EntityRecord | null> {
  const entitySelect = await buildEntitySelect();
  const result = await db.query<EntityRow>(
    `${entitySelect}
     WHERE e.id = $1`,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapEntityRow(result.rows[0]);
}

async function assertUniqueEntityName(
  excludeEntityId: number | null,
  name: string,
  entityCategoryId: number,
  parentEntityId: number | null,
): Promise<void> {
  const result = await db.query<{ id: string; name: string }>(
    `SELECT id, name
     FROM entities
     WHERE entity_category_id = $1
       AND LOWER(TRIM(name)) = LOWER(TRIM($2))
       AND (
         ($3::bigint IS NULL AND parent_entity_id IS NULL)
         OR parent_entity_id = $3
       )
       AND ($4::bigint IS NULL OR id <> $4)
     LIMIT 1`,
    [entityCategoryId, name, parentEntityId, excludeEntityId],
  );

  if (result.rows.length > 0) {
    throw new EntityError(
      `An entity named "${result.rows[0].name}" already exists in this category with the same parent.`,
      409,
    );
  }
}

export async function createEntity(
  input: CreateEntityInput,
): Promise<EntityRecord> {
  const normalized = normalizeEntityInput(input);

  await assertCategoryExists(normalized.entityCategoryId);
  await assertValidParent(null, normalized.parentEntityId);
  await assertUniqueEntityName(
    null,
    normalized.name,
    normalized.entityCategoryId,
    normalized.parentEntityId,
  );

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
  await assertUniqueEntityName(
    id,
    normalized.name,
    normalized.entityCategoryId,
    normalized.parentEntityId,
  );

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
