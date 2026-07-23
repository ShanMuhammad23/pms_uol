import type { EntityRecord } from "@/types/entities";
import type { EntityCategoryCode } from "@/types/entity-categories";

export const ENTITY_FILTER_LEVELS = [
  { level: 0, categoryCode: "C0" as EntityCategoryCode, label: "ORG Level 0" },
  { level: 1, categoryCode: "C1" as EntityCategoryCode, label: "ORG Level 1" },
  { level: 2, categoryCode: "C2" as EntityCategoryCode, label: "ORG Level 2" },
] as const;

export type EntityFilterSelection = {
  category0EntityId: number | "ALL";
  category1EntityId: number | "ALL";
  category2EntityId: number | "ALL";
};

/** `null` = all selected (no filter). `[]` = none selected. */
export type MultiFilterSelection<T extends string | number> = T[] | null;

function sortEntities(entities: EntityRecord[]): EntityRecord[] {
  return [...entities].sort((left, right) => left.name.localeCompare(right.name));
}

export function getEntitiesForFilterLevel(
  entities: EntityRecord[],
  level: 0 | 1 | 2,
  parentEntityId: number | null,
): EntityRecord[] {
  const categoryCode = ENTITY_FILTER_LEVELS[level].categoryCode;

  const filtered = entities.filter((entity) => {
    if (entity.categoryCode !== categoryCode) {
      return false;
    }

    if (level === 0) {
      return true;
    }

    return parentEntityId !== null && entity.parentEntityId === parentEntityId;
  });

  return sortEntities(filtered);
}

export function getEntitiesForFilterLevels(
  entities: EntityRecord[],
  level: 0 | 1 | 2,
  parentEntityIds: number[] | null,
): EntityRecord[] {
  if (level === 0) {
    return getEntitiesForFilterLevel(entities, 0, null);
  }

  if (parentEntityIds === null) {
    return sortEntities(
      entities.filter(
        (entity) => entity.categoryCode === ENTITY_FILTER_LEVELS[level].categoryCode,
      ),
    );
  }

  if (parentEntityIds.length === 0) {
    return [];
  }

  const byId = new Map<number, EntityRecord>();
  for (const parentId of parentEntityIds) {
    for (const entity of getEntitiesForFilterLevel(entities, level, parentId)) {
      byId.set(entity.id, entity);
    }
  }

  return sortEntities([...byId.values()]);
}

export function pruneMultiSelection<T extends string | number>(
  selected: MultiFilterSelection<T>,
  availableValues: T[],
): MultiFilterSelection<T> {
  if (selected === null) {
    return null;
  }

  const available = new Set(availableValues);
  const next = selected.filter((value) => available.has(value));

  if (next.length === availableValues.length && availableValues.length > 0) {
    return null;
  }

  return next;
}

export function getEffectiveEntityFilterId(
  selection: EntityFilterSelection,
): number | "ALL" {
  if (selection.category2EntityId !== "ALL") {
    return selection.category2EntityId;
  }

  if (selection.category1EntityId !== "ALL") {
    return selection.category1EntityId;
  }

  if (selection.category0EntityId !== "ALL") {
    return selection.category0EntityId;
  }

  return "ALL";
}

type EntityTreeCache = {
  childrenByParent: Map<number, number[]>;
  descendantsByRoot: Map<number, Set<number>>;
  /** entityId → self + all ancestors (for O(1) subtree membership checks). */
  selfAndAncestorsById: Map<number, Set<number>>;
  entitiesById: Map<number, EntityRecord>;
};

const entityTreeCache = new WeakMap<EntityRecord[], EntityTreeCache>();

function getEntityTreeCache(entities: EntityRecord[]): EntityTreeCache {
  const cached = entityTreeCache.get(entities);
  if (cached) {
    return cached;
  }

  const childrenByParent = new Map<number, number[]>();
  const entitiesById = new Map<number, EntityRecord>();

  for (const entity of entities) {
    entitiesById.set(entity.id, entity);
    if (entity.parentEntityId !== null) {
      const siblings = childrenByParent.get(entity.parentEntityId) ?? [];
      siblings.push(entity.id);
      childrenByParent.set(entity.parentEntityId, siblings);
    }
  }

  const selfAndAncestorsById = new Map<number, Set<number>>();
  for (const entity of entities) {
    const chain = new Set<number>();
    let current: EntityRecord | undefined = entity;
    while (current) {
      chain.add(current.id);
      current =
        current.parentEntityId != null
          ? entitiesById.get(current.parentEntityId)
          : undefined;
    }
    selfAndAncestorsById.set(entity.id, chain);
  }

  const next: EntityTreeCache = {
    childrenByParent,
    descendantsByRoot: new Map(),
    selfAndAncestorsById,
    entitiesById,
  };
  entityTreeCache.set(entities, next);
  return next;
}

/** Self + ancestors for an entity (empty if unknown). */
export function getEntitySelfAndAncestorIds(
  entityId: number,
  entities: EntityRecord[],
): Set<number> {
  return (
    getEntityTreeCache(entities).selfAndAncestorsById.get(entityId) ??
    new Set()
  );
}

/**
 * True when `entityId` is `rootId` or a descendant of `rootId`.
 * Uses a cached ancestor index — O(1) after first build for the entities array.
 */
export function isEntityInCachedSubtree(
  entityId: number | null | undefined,
  rootId: number,
  entities: EntityRecord[],
): boolean {
  if (entityId == null) {
    return false;
  }

  if (entityId === rootId) {
    return true;
  }

  return getEntitySelfAndAncestorIds(entityId, entities).has(rootId);
}

export function getEntityDescendantIds(
  rootId: number,
  entities: EntityRecord[],
): Set<number> {
  const cache = getEntityTreeCache(entities);
  const cached = cache.descendantsByRoot.get(rootId);
  if (cached) {
    return cached;
  }

  const descendants = new Set<number>();
  const stack = [rootId];

  while (stack.length > 0) {
    const current = stack.pop()!;

    for (const childId of cache.childrenByParent.get(current) ?? []) {
      descendants.add(childId);
      stack.push(childId);
    }
  }

  cache.descendantsByRoot.set(rootId, descendants);
  return descendants;
}

export type EntityListFilterState = {
  searchQuery: string;
  categoryCode: EntityCategoryCode | "ALL";
  /** Entity belonging to the selected category. */
  entityId: number | "ALL";
  /** Direct child of the selected entity. */
  childEntityId: number | "ALL";
};

/** Entities that belong to a category code (for cascading filter dropdowns). */
export function getEntitiesForCategoryCode(
  entities: EntityRecord[],
  categoryCode: EntityCategoryCode | "ALL",
): EntityRecord[] {
  if (categoryCode === "ALL") {
    return [];
  }

  return sortEntities(
    entities.filter((entity) => entity.categoryCode === categoryCode),
  );
}

/** Direct children of a parent entity (any category). */
export function getDirectChildEntities(
  entities: EntityRecord[],
  parentEntityId: number | "ALL",
): EntityRecord[] {
  if (parentEntityId === "ALL") {
    return [];
  }

  return sortEntities(
    entities.filter((entity) => entity.parentEntityId === parentEntityId),
  );
}

export function filterEntityRecords(
  entities: EntityRecord[],
  filters: EntityListFilterState,
): EntityRecord[] {
  const query = filters.searchQuery.trim().toLowerCase();
  const { categoryCode, entityId, childEntityId } = filters;

  return entities.filter((entity) => {
    if (childEntityId !== "ALL") {
      if (entity.id !== childEntityId) {
        return false;
      }
    } else if (entityId !== "ALL") {
      if (entity.id !== entityId && entity.parentEntityId !== entityId) {
        return false;
      }
    } else if (categoryCode !== "ALL" && entity.categoryCode !== categoryCode) {
      return false;
    }

    if (!query) {
      return true;
    }

    return (
      entity.name.toLowerCase().includes(query) ||
      entity.categoryCode.toLowerCase().includes(query) ||
      (entity.parentName?.toLowerCase().includes(query) ?? false)
    );
  });
}
