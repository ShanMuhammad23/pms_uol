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

/**
 * Replace each entity's direct `staffCount` with self + all descendants.
 * Input counts must be direct assignments; do not call twice on the same list.
 */
export function enrichEntitiesWithSubtreeStaffCounts(
  entities: EntityRecord[],
): EntityRecord[] {
  if (entities.length === 0) {
    return entities;
  }

  const directCounts = new Map<number, number>();
  const childrenByParent = new Map<number, number[]>();

  for (const entity of entities) {
    directCounts.set(entity.id, entity.staffCount);
    if (entity.parentEntityId != null) {
      const siblings = childrenByParent.get(entity.parentEntityId) ?? [];
      siblings.push(entity.id);
      childrenByParent.set(entity.parentEntityId, siblings);
    }
  }

  const subtreeCache = new Map<number, number>();

  const subtreeTotal = (id: number): number => {
    const cached = subtreeCache.get(id);
    if (cached !== undefined) {
      return cached;
    }

    let total = directCounts.get(id) ?? 0;
    for (const childId of childrenByParent.get(id) ?? []) {
      total += subtreeTotal(childId);
    }
    subtreeCache.set(id, total);
    return total;
  };

  return entities.map((entity) => ({
    ...entity,
    staffCount: subtreeTotal(entity.id),
  }));
}

export type EntityListFilterState = {
  searchQuery: string;
  categoryCode: EntityCategoryCode | "ALL";
  /** Entities in the selected category. `null` = all, `[]` = none. */
  entityIds: MultiFilterSelection<number>;
  /** Direct children of selected entities. `null` = all, `[]` = none. */
  childEntityIds: MultiFilterSelection<number>;
  /** Filter by parent entity. `null` = all, `[]` = none. */
  parentEntityIds: MultiFilterSelection<number>;
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

/** Direct children of one or more parent entities (any category). */
export function getDirectChildEntities(
  entities: EntityRecord[],
  parentEntityIds: MultiFilterSelection<number>,
): EntityRecord[] {
  if (parentEntityIds !== null && parentEntityIds.length === 0) {
    return [];
  }

  const parentIdSet =
    parentEntityIds === null ? null : new Set(parentEntityIds);

  return sortEntities(
    entities.filter((entity) => {
      if (entity.parentEntityId == null) {
        return false;
      }
      if (parentIdSet == null) {
        return true;
      }
      return parentIdSet.has(entity.parentEntityId);
    }),
  );
}

/**
 * Children of the given parent entities only.
 * When `parentEntityIds` is `null`, use `fallbackParentIds` (e.g. all category entities).
 */
export function getDirectChildEntitiesOfParents(
  entities: EntityRecord[],
  parentEntityIds: MultiFilterSelection<number>,
  fallbackParentIds: number[],
): EntityRecord[] {
  const effectiveParents =
    parentEntityIds === null ? fallbackParentIds : parentEntityIds;

  if (effectiveParents.length === 0) {
    return [];
  }

  return getDirectChildEntities(entities, effectiveParents);
}

export function filterEntityRecords(
  entities: EntityRecord[],
  filters: EntityListFilterState,
): EntityRecord[] {
  const query = filters.searchQuery.trim().toLowerCase();
  const { categoryCode, entityIds, childEntityIds, parentEntityIds } = filters;

  return entities.filter((entity) => {
    if (childEntityIds !== null) {
      if (childEntityIds.length === 0 || !childEntityIds.includes(entity.id)) {
        return false;
      }
    } else if (entityIds !== null) {
      if (entityIds.length === 0) {
        return false;
      }
      if (
        !entityIds.includes(entity.id) &&
        (entity.parentEntityId == null ||
          !entityIds.includes(entity.parentEntityId))
      ) {
        return false;
      }
    } else if (categoryCode !== "ALL" && entity.categoryCode !== categoryCode) {
      return false;
    }

    if (
      parentEntityIds !== null &&
      (entity.parentEntityId == null ||
        !parentEntityIds.includes(entity.parentEntityId))
    ) {
      return false;
    }

    if (!query) {
      return true;
    }

    return (
      entity.name.toLowerCase().includes(query) ||
      entity.categoryCode.toLowerCase().includes(query) ||
      (entity.parentName?.toLowerCase().includes(query) ?? false) ||
      (entity.parentCategoryCode?.toLowerCase().includes(query) ?? false)
    );
  });
}
