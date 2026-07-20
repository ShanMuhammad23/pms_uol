import {
  getEntityDescendantIds,
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

  const selectedEntity = entities.find((entity) => entity.id === selectedEntityId);

  if (!selectedEntity) {
    return false;
  }

  const userEntityId =
    user.entityId == null ? null : Number(user.entityId);

  if (userEntityId != null && !Number.isNaN(userEntityId)) {
    if (userEntityId === selectedEntityId) {
      return true;
    }

    const descendantIds = getEntityDescendantIds(selectedEntityId, entities);

    if (descendantIds.has(userEntityId)) {
      return true;
    }
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

export function matchesUserPageFilters(
  user: UserRecord,
  filters: UserPageFilterState,
): boolean {
  const query = filters.searchQuery.toLowerCase();
  const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
  const matchesSearch =
    !filters.searchQuery ||
    fullName.includes(query) ||
    user.employeeId.toLowerCase().includes(query) ||
    user.email.toLowerCase().includes(query);

  const matchesEntity0 = matchesUserEntityMultiFilter(
    user,
    filters.selectedCategory0EntityIds,
    filters.entities,
  );
  const matchesEntity1 = matchesUserEntityMultiFilter(
    user,
    filters.selectedCategory1EntityIds,
    filters.entities,
  );
  const matchesEntity2 = matchesUserEntityMultiFilter(
    user,
    filters.selectedCategory2EntityIds,
    filters.entities,
  );

  const matchesRoleCategory = matchesMultiSelection(
    filters.selectedRoleCategories,
    formatRoleCategoryValue(user.roleCategory),
  );

  const designation = user.designation?.trim() ?? "";
  const matchesDesignation = matchesMultiSelection(
    filters.selectedDesignations,
    designation || null,
  );

  return (
    matchesSearch &&
    matchesEntity0 &&
    matchesEntity1 &&
    matchesEntity2 &&
    matchesRoleCategory &&
    matchesDesignation
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
