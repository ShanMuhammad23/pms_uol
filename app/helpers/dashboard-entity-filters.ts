import type { EntityRecord } from "@/types/entities";
import type { EntityCategoryCode } from "@/types/entity-categories";

export const ENTITY_FILTER_LEVELS = [
  { level: 0, categoryCode: "C1" as EntityCategoryCode, label: "Category 0" },
  { level: 1, categoryCode: "C2" as EntityCategoryCode, label: "Category 1" },
  { level: 2, categoryCode: "C3" as EntityCategoryCode, label: "Category 2" },
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

export function getEntityDescendantIds(
  rootId: number,
  entities: EntityRecord[],
): Set<number> {
  const descendants = new Set<number>();
  const childrenByParent = new Map<number, number[]>();

  entities.forEach((entity) => {
    if (entity.parentEntityId !== null) {
      const siblings = childrenByParent.get(entity.parentEntityId) ?? [];
      siblings.push(entity.id);
      childrenByParent.set(entity.parentEntityId, siblings);
    }
  });

  const stack = [rootId];

  while (stack.length > 0) {
    const current = stack.pop()!;

    for (const childId of childrenByParent.get(current) ?? []) {
      descendants.add(childId);
      stack.push(childId);
    }
  }

  return descendants;
}

export function filterEntityRecords(
  entities: EntityRecord[],
  searchQuery: string,
  categoryCode: EntityCategoryCode | "ALL",
): EntityRecord[] {
  const query = searchQuery.trim().toLowerCase();

  return entities.filter((entity) => {
    if (categoryCode !== "ALL" && entity.categoryCode !== categoryCode) {
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
