import {
  getEntitySelfAndAncestorIds,
  isEntityInCachedSubtree,
  type MultiFilterSelection,
} from "@/app/helpers/dashboard-entity-filters";
import {
  formatRoleCategoryValue,
  matchesMultiSelection,
} from "@/app/helpers/dashboard-filters";
import type { EntityRecord } from "@/types/entities";
import type { UserRecord } from "@/types/users";

export type UserPageFilterState = {
  searchQuery: string;
  selectedCategory0EntityIds: MultiFilterSelection<number>;
  selectedCategory1EntityIds: MultiFilterSelection<number>;
  selectedCategory2EntityIds: MultiFilterSelection<number>;
  selectedRoleCategories: MultiFilterSelection<string>;
  selectedDesignations: MultiFilterSelection<string>;
  entities: EntityRecord[];
};

export type UserFilterDimension =
  | "category0"
  | "category1"
  | "category2"
  | "roleCategory"
  | "designation";

function matchesUserEntityFilter(
  user: UserRecord,
  selectedEntityId: number | "ALL",
  entities: EntityRecord[],
): boolean {
  if (selectedEntityId === "ALL") {
    return true;
  }

  if (isEntityInCachedSubtree(user.entityId, selectedEntityId, entities)) {
    return true;
  }

  const selectedEntity = entities.find((entity) => entity.id === selectedEntityId);
  if (!selectedEntity) {
    return false;
  }

  return (
    user.entityName === selectedEntity.name ||
    user.parentEntityName === selectedEntity.name
  );
}

export function matchesUserEntityMultiFilter(
  user: UserRecord,
  selectedEntityIds: MultiFilterSelection<number>,
  entities: EntityRecord[],
): boolean {
  if (selectedEntityIds === null) {
    return true;
  }

  if (selectedEntityIds.length === 0) {
    return false;
  }

  return selectedEntityIds.some((entityId) =>
    matchesUserEntityFilter(user, entityId, entities),
  );
}

function matchesSearch(user: UserRecord, searchQuery: string): boolean {
  if (!searchQuery) {
    return true;
  }

  const query = searchQuery.toLowerCase();
  const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
  return (
    fullName.includes(query) ||
    user.employeeId.toLowerCase().includes(query) ||
    user.email.toLowerCase().includes(query)
  );
}

export function matchesUserPageFilters(
  user: UserRecord,
  filters: UserPageFilterState,
): boolean {
  if (!matchesSearch(user, filters.searchQuery)) {
    return false;
  }

  if (
    !matchesUserEntityMultiFilter(
      user,
      filters.selectedCategory0EntityIds,
      filters.entities,
    )
  ) {
    return false;
  }

  if (
    !matchesUserEntityMultiFilter(
      user,
      filters.selectedCategory1EntityIds,
      filters.entities,
    )
  ) {
    return false;
  }

  if (
    !matchesUserEntityMultiFilter(
      user,
      filters.selectedCategory2EntityIds,
      filters.entities,
    )
  ) {
    return false;
  }

  if (
    !matchesMultiSelection(
      filters.selectedRoleCategories,
      formatRoleCategoryValue(user.roleCategory),
    )
  ) {
    return false;
  }

  const designation = user.designation?.trim() ?? "";
  return matchesMultiSelection(
    filters.selectedDesignations,
    designation || null,
  );
}

export function matchesUserPageFiltersExcluding(
  user: UserRecord,
  filters: UserPageFilterState,
  exclude: UserFilterDimension,
): boolean {
  return matchesUserPageFilters(user, {
    ...filters,
    selectedCategory0EntityIds:
      exclude === "category0" ? null : filters.selectedCategory0EntityIds,
    selectedCategory1EntityIds:
      exclude === "category1" ? null : filters.selectedCategory1EntityIds,
    selectedCategory2EntityIds:
      exclude === "category2" ? null : filters.selectedCategory2EntityIds,
    selectedRoleCategories:
      exclude === "roleCategory" ? null : filters.selectedRoleCategories,
    selectedDesignations:
      exclude === "designation" ? null : filters.selectedDesignations,
  });
}

/** Increment facet counts for entity options that contain this user's entity. */
export function addUserToEntityFacetCounts(
  user: UserRecord,
  optionEntityIds: Set<number>,
  counts: Map<number, number>,
  entities: EntityRecord[],
) {
  if (user.entityId == null) {
    return;
  }

  const chain = getEntitySelfAndAncestorIds(user.entityId, entities);
  for (const ancestorId of chain) {
    if (optionEntityIds.has(ancestorId)) {
      counts.set(ancestorId, (counts.get(ancestorId) ?? 0) + 1);
    }
  }
}
