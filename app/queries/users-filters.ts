"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ActiveFilter } from "@/app/components/dashboard/DashboardFilterBar";
import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import {
  ENTITY_FILTER_LEVELS,
  getEntitiesForFilterLevels,
  pruneMultiSelection,
  type MultiFilterSelection,
} from "@/app/helpers/dashboard-entity-filters";
import { formatRoleCategoryValue } from "@/app/helpers/dashboard-filters";
import {
  addUserToEntityFacetCounts,
  matchesUserCampus,
  matchesUserPageFilters,
  matchesUserPageFiltersExcluding,
  type UserPageFilterState,
} from "@/app/helpers/users-page-filters";
import type { CampusRecord } from "@/types/campuses";
import type { EntityRecord } from "@/types/entities";
import type { UserRecord } from "@/types/users";
import { useSessionStorageState } from "@/app/hooks/use-session-storage-state";

interface UseUsersPageFiltersParams {
  users: UserRecord[];
  entities: EntityRecord[];
  designations: string[];
  campuses: CampusRecord[];
}

function toStringSelection(
  selected: MultiFilterSelection<number>,
): string[] | null {
  return selected === null ? null : selected.map(String);
}

function fromStringIds(values: string[] | null): MultiFilterSelection<number> {
  return values === null ? null : values.map(Number);
}

function formatMultiChipLabel(
  prefix: string,
  selected: string[],
  resolveLabel: (value: string) => string,
): string {
  if (selected.length === 1) {
    return `${prefix}: ${resolveLabel(selected[0])}`;
  }

  return `${prefix}: ${selected.length} selected`;
}

function selectionsEqual<T extends string | number>(
  left: MultiFilterSelection<T>,
  right: MultiFilterSelection<T>,
): boolean {
  if (left === right) {
    return true;
  }

  if (left === null || right === null) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function setPrunedSelection<T extends string | number>(
  setter: Dispatch<SetStateAction<MultiFilterSelection<T>>>,
  availableValues: T[],
) {
  setter((current) => {
    const next = pruneMultiSelection(current, availableValues);
    return selectionsEqual(current, next) ? current : next;
  });
}

function sortRoleOptions(
  left: MultiSelectOption,
  right: MultiSelectOption,
): number {
  if (left.value === "—") return 1;
  if (right.value === "—") return -1;
  return left.label.localeCompare(right.label, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function useUsersPageFilters({
  users,
  entities,
  designations,
  campuses,
}: UseUsersPageFiltersParams) {
  const [selectedCampusId, setSelectedCampusId] =
    useSessionStorageState<number | null>("pms:users-filters:campus", null);
  const [selectedCategory0EntityIds, setSelectedCategory0EntityIds] =
    useSessionStorageState<MultiFilterSelection<number>>(
      "pms:users-filters:category0",
      null,
    );
  const [selectedCategory1EntityIds, setSelectedCategory1EntityIds] =
    useSessionStorageState<MultiFilterSelection<number>>(
      "pms:users-filters:category1",
      null,
    );
  const [selectedCategory2EntityIds, setSelectedCategory2EntityIds] =
    useSessionStorageState<MultiFilterSelection<number>>(
      "pms:users-filters:category2",
      null,
    );
  const [selectedRoleCategories, setSelectedRoleCategories] =
    useSessionStorageState<MultiFilterSelection<string>>(
      "pms:users-filters:roleCategories",
      null,
    );
  const [selectedDesignations, setSelectedDesignations] =
    useSessionStorageState<MultiFilterSelection<string>>(
      "pms:users-filters:designations",
      null,
    );

  const category0Entities = useMemo(
    () =>
      getEntitiesForFilterLevels(entities, 0, null).filter(
        (entity) =>
          selectedCampusId === null || entity.campusId === selectedCampusId,
      ),
    [entities, selectedCampusId],
  );

  const category1Entities = useMemo(
    () => getEntitiesForFilterLevels(entities, 1, selectedCategory0EntityIds),
    [entities, selectedCategory0EntityIds],
  );

  const category2Entities = useMemo(
    () => getEntitiesForFilterLevels(entities, 2, selectedCategory1EntityIds),
    [entities, selectedCategory1EntityIds],
  );

  useEffect(() => {
    setPrunedSelection(
      setSelectedCategory0EntityIds,
      category0Entities.map((entity) => entity.id),
    );
  }, [category0Entities]);

  useEffect(() => {
    setPrunedSelection(
      setSelectedCategory1EntityIds,
      category1Entities.map((entity) => entity.id),
    );
  }, [category1Entities]);

  useEffect(() => {
    setPrunedSelection(
      setSelectedCategory2EntityIds,
      category2Entities.map((entity) => entity.id),
    );
  }, [category2Entities]);

  const baseFilterState = useMemo<UserPageFilterState>(
    () => ({
      searchQuery: "",
      selectedCampusId,
      selectedCategory0EntityIds,
      selectedCategory1EntityIds,
      selectedCategory2EntityIds,
      selectedRoleCategories,
      selectedDesignations,
      entities,
    }),
    [
      selectedCampusId,
      selectedCategory0EntityIds,
      selectedCategory1EntityIds,
      selectedCategory2EntityIds,
      selectedRoleCategories,
      selectedDesignations,
      entities,
    ],
  );

  // Keep dropdown selection snappy; defer the expensive facet/list work.
  const deferredFilterState = useDeferredValue(baseFilterState);
  const deferredUsers = useDeferredValue(users);

  const category0OptionIds = useMemo(
    () => new Set(category0Entities.map((entity) => entity.id)),
    [category0Entities],
  );
  const category1OptionIds = useMemo(
    () => new Set(category1Entities.map((entity) => entity.id)),
    [category1Entities],
  );
  const category2OptionIds = useMemo(
    () => new Set(category2Entities.map((entity) => entity.id)),
    [category2Entities],
  );

  const filteredUsers = useMemo(
    () =>
      deferredUsers.filter((user) =>
        matchesUserPageFilters(user, deferredFilterState),
      ),
    [deferredUsers, deferredFilterState],
  );

  const campusOptions = useMemo<MultiSelectOption[]>(() => {
    const counts = new Map<number, number>();
    for (const campus of campuses) {
      counts.set(campus.id, 0);
    }

    for (const user of deferredUsers) {
      if (
        !matchesUserPageFiltersExcluding(user, deferredFilterState, "campus")
      ) {
        continue;
      }
      for (const campus of campuses) {
        if (matchesUserCampus(user, campus.id, deferredFilterState.entities)) {
          counts.set(campus.id, (counts.get(campus.id) ?? 0) + 1);
        }
      }
    }

    return campuses
      .map((campus) => ({
        value: String(campus.id),
        label: campus.name,
        count: counts.get(campus.id) ?? 0,
      }))
      .filter(
        (option) =>
          option.count > 0 ||
          (selectedCampusId != null &&
            String(selectedCampusId) === option.value),
      );
  }, [
    campuses,
    deferredUsers,
    deferredFilterState,
    selectedCampusId,
  ]);

  const category0Options = useMemo<MultiSelectOption[]>(() => {
    const counts = new Map<number, number>();
    for (const entity of category0Entities) {
      counts.set(entity.id, 0);
    }

    for (const user of deferredUsers) {
      if (
        !matchesUserPageFiltersExcluding(
          user,
          deferredFilterState,
          "category0",
        )
      ) {
        continue;
      }
      addUserToEntityFacetCounts(
        user,
        category0OptionIds,
        counts,
        deferredFilterState.entities,
      );
    }

    return category0Entities.map((entity) => ({
      value: String(entity.id),
      label: entity.name,
      count: counts.get(entity.id) ?? 0,
    }));
  }, [
    category0Entities,
    category0OptionIds,
    deferredUsers,
    deferredFilterState,
  ]);

  const category0DistributionOptions = useMemo<MultiSelectOption[]>(() => {
    const visibleEntities =
      deferredFilterState.selectedCategory0EntityIds !== null &&
      deferredFilterState.selectedCategory0EntityIds.length > 0
        ? category0Entities.filter((entity) =>
            deferredFilterState.selectedCategory0EntityIds!.includes(entity.id),
          )
        : category0Entities;

    const visibleIds = new Set(visibleEntities.map((entity) => entity.id));
    const counts = new Map<number, number>();
    for (const entity of visibleEntities) {
      counts.set(entity.id, 0);
    }

    for (const user of filteredUsers) {
      addUserToEntityFacetCounts(
        user,
        visibleIds,
        counts,
        deferredFilterState.entities,
      );
    }

    return visibleEntities
      .map((entity) => ({
        value: String(entity.id),
        label: entity.name,
        count: counts.get(entity.id) ?? 0,
      }))
      .filter((option) => option.count > 0);
  }, [category0Entities, deferredFilterState, filteredUsers]);

  const category1Options = useMemo<MultiSelectOption[]>(() => {
    const counts = new Map<number, number>();
    for (const entity of category1Entities) {
      counts.set(entity.id, 0);
    }

    for (const user of deferredUsers) {
      if (
        !matchesUserPageFiltersExcluding(
          user,
          deferredFilterState,
          "category1",
        )
      ) {
        continue;
      }
      addUserToEntityFacetCounts(
        user,
        category1OptionIds,
        counts,
        deferredFilterState.entities,
      );
    }

    return category1Entities.map((entity) => ({
      value: String(entity.id),
      label: entity.name,
      count: counts.get(entity.id) ?? 0,
    }));
  }, [
    category1Entities,
    category1OptionIds,
    deferredUsers,
    deferredFilterState,
  ]);

  const category2Options = useMemo<MultiSelectOption[]>(() => {
    const counts = new Map<number, number>();
    for (const entity of category2Entities) {
      counts.set(entity.id, 0);
    }

    for (const user of deferredUsers) {
      if (
        !matchesUserPageFiltersExcluding(
          user,
          deferredFilterState,
          "category2",
        )
      ) {
        continue;
      }
      addUserToEntityFacetCounts(
        user,
        category2OptionIds,
        counts,
        deferredFilterState.entities,
      );
    }

    return category2Entities.map((entity) => ({
      value: String(entity.id),
      label: entity.name,
      count: counts.get(entity.id) ?? 0,
    }));
  }, [
    category2Entities,
    category2OptionIds,
    deferredUsers,
    deferredFilterState,
  ]);

  const roleCategoryOptions = useMemo<MultiSelectOption[]>(() => {
    const counts = new Map<string, number>();

    for (const user of deferredUsers) {
      if (
        !matchesUserPageFiltersExcluding(
          user,
          deferredFilterState,
          "roleCategory",
        )
      ) {
        continue;
      }

      const value = formatRoleCategoryValue(user.roleCategory);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    // Keep currently selected values visible even if other filters zero them out.
    if (selectedRoleCategories) {
      for (const value of selectedRoleCategories) {
        if (!counts.has(value)) {
          counts.set(value, 0);
        }
      }
    }

    return [...counts.entries()]
      .map(([value, count]) => ({
        value,
        label: value,
        count,
      }))
      .filter(
        (option) =>
          option.count > 0 || selectedRoleCategories?.includes(option.value),
      )
      .sort(sortRoleOptions);
  }, [deferredUsers, deferredFilterState, selectedRoleCategories]);

  const designationOptions = useMemo<MultiSelectOption[]>(() => {
    const counts = new Map<string, number>();

    for (const user of deferredUsers) {
      if (
        !matchesUserPageFiltersExcluding(
          user,
          deferredFilterState,
          "designation",
        )
      ) {
        continue;
      }

      const designation = user.designation?.trim() ?? "";
      if (!designation) {
        continue;
      }

      counts.set(designation, (counts.get(designation) ?? 0) + 1);
    }

    return designations
      .map((designation) => ({
        value: designation,
        label: designation,
        count: counts.get(designation) ?? 0,
      }))
      .filter((option) => option.count > 0);
  }, [designations, deferredUsers, deferredFilterState]);

  const handleCampusChange = useCallback((values: string[] | null) => {
    if (values === null || values.length === 0) {
      setSelectedCampusId(null);
    } else {
      setSelectedCampusId(Number(values[0]));
    }
  }, []);

  const handleCategory0EntityChange = useCallback((values: string[] | null) => {
    setSelectedCategory0EntityIds(fromStringIds(values));
  }, []);

  const handleCategory0DistributionSelect = useCallback((entityId: string) => {
    const id = Number(entityId);
    setSelectedCategory0EntityIds((current) => {
      if (current !== null && current.length === 1 && current[0] === id) {
        return null;
      }

      return [id];
    });
  }, []);

  const handleCategory1EntityChange = useCallback((values: string[] | null) => {
    setSelectedCategory1EntityIds(fromStringIds(values));
  }, []);

  const handleCategory2EntityChange = useCallback((values: string[] | null) => {
    setSelectedCategory2EntityIds(fromStringIds(values));
  }, []);

  const handleRoleCategoryChange = useCallback((values: string[] | null) => {
    setSelectedRoleCategories(values);
  }, []);

  const handleDesignationChange = useCallback((values: string[] | null) => {
    setSelectedDesignations(values);
  }, []);

  const activeFilters = useMemo(() => {
    const filters: ActiveFilter[] = [];

    if (selectedCampusId !== null) {
      const campus = campuses.find((item) => item.id === selectedCampusId);
      filters.push({
        label: `Site: ${campus?.name ?? selectedCampusId}`,
        onRemove: () => setSelectedCampusId(null),
        color: "slate",
      });
    }

    if (selectedCategory0EntityIds !== null) {
      filters.push({
        label: formatMultiChipLabel(
          ENTITY_FILTER_LEVELS[0].label,
          selectedCategory0EntityIds.map(String),
          (value) =>
            entities.find((entity) => entity.id === Number(value))?.name ?? value,
        ),
        onRemove: () => setSelectedCategory0EntityIds(null),
        color: "slate",
      });
    }

    if (selectedCategory1EntityIds !== null) {
      filters.push({
        label: formatMultiChipLabel(
          ENTITY_FILTER_LEVELS[1].label,
          selectedCategory1EntityIds.map(String),
          (value) =>
            entities.find((entity) => entity.id === Number(value))?.name ?? value,
        ),
        onRemove: () => setSelectedCategory1EntityIds(null),
        color: "slate",
      });
    }

    if (selectedCategory2EntityIds !== null) {
      filters.push({
        label: formatMultiChipLabel(
          ENTITY_FILTER_LEVELS[2].label,
          selectedCategory2EntityIds.map(String),
          (value) =>
            entities.find((entity) => entity.id === Number(value))?.name ?? value,
        ),
        onRemove: () => setSelectedCategory2EntityIds(null),
        color: "slate",
      });
    }

    if (selectedRoleCategories !== null) {
      filters.push({
        label: formatMultiChipLabel(
          "Role Category",
          selectedRoleCategories,
          (value) => value,
        ),
        onRemove: () => setSelectedRoleCategories(null),
        color: "amber",
      });
    }

    if (selectedDesignations !== null) {
      filters.push({
        label: formatMultiChipLabel(
          "Designation",
          selectedDesignations,
          (value) => value,
        ),
        onRemove: () => setSelectedDesignations(null),
        color: "emerald",
      });
    }

    return filters;
  }, [
    selectedCampusId,
    selectedCategory0EntityIds,
    selectedCategory1EntityIds,
    selectedCategory2EntityIds,
    selectedRoleCategories,
    selectedDesignations,
    campuses,
    entities,
  ]);

  const clearAllFilters = useCallback(() => {
    setSelectedCampusId(null);
    setSelectedCategory0EntityIds(null);
    setSelectedCategory1EntityIds(null);
    setSelectedCategory2EntityIds(null);
    setSelectedRoleCategories(null);
    setSelectedDesignations(null);
  }, []);

  return {
    selectedCampusId,
    selectedCategory0EntityIds: toStringSelection(selectedCategory0EntityIds),
    selectedCategory1EntityIds: toStringSelection(selectedCategory1EntityIds),
    selectedCategory2EntityIds: toStringSelection(selectedCategory2EntityIds),
    selectedRoleCategories,
    selectedDesignations,
    campusOptions,
    category0Options,
    category0DistributionOptions,
    category1Options,
    category2Options,
    roleCategoryOptions,
    designationOptions,
    filteredUsers,
    activeFilters,
    handleCampusChange,
    handleCategory0EntityChange,
    handleCategory0DistributionSelect,
    handleCategory1EntityChange,
    handleCategory2EntityChange,
    handleRoleCategoryChange,
    handleDesignationChange,
    clearAllFilters,
  };
}
