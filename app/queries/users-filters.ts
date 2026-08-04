"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
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
  matchesUserPageFilters,
  matchesUserPageFiltersExcluding,
  type UserPageFilterState,
} from "@/app/helpers/users-page-filters";
import type { EntityRecord } from "@/types/entities";
import type { UserRecord } from "@/types/users";

interface UseUsersPageFiltersParams {
  users: UserRecord[];
  entities: EntityRecord[];
  designations: string[];
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
}: UseUsersPageFiltersParams) {
  const [selectedCategory0EntityIds, setSelectedCategory0EntityIds] =
    useState<MultiFilterSelection<number>>(null);
  const [selectedCategory1EntityIds, setSelectedCategory1EntityIds] =
    useState<MultiFilterSelection<number>>(null);
  const [selectedCategory2EntityIds, setSelectedCategory2EntityIds] =
    useState<MultiFilterSelection<number>>(null);
  const [selectedRoleCategories, setSelectedRoleCategories] =
    useState<MultiFilterSelection<string>>(null);
  const [selectedDesignations, setSelectedDesignations] =
    useState<MultiFilterSelection<string>>(null);

  const category0Entities = useMemo(
    () => getEntitiesForFilterLevels(entities, 0, null),
    [entities],
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
      selectedCategory0EntityIds,
      selectedCategory1EntityIds,
      selectedCategory2EntityIds,
      selectedRoleCategories,
      selectedDesignations,
      entities,
    }),
    [
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
      const value = formatRoleCategoryValue(user.roleCategory);
      if (
        matchesUserPageFiltersExcluding(
          user,
          deferredFilterState,
          "roleCategory",
        )
      ) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      } else if (!counts.has(value)) {
        counts.set(value, 0);
      }
    }

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
    selectedCategory0EntityIds,
    selectedCategory1EntityIds,
    selectedCategory2EntityIds,
    selectedRoleCategories,
    selectedDesignations,
    entities,
  ]);

  const clearAllFilters = useCallback(() => {
    setSelectedCategory0EntityIds(null);
    setSelectedCategory1EntityIds(null);
    setSelectedCategory2EntityIds(null);
    setSelectedRoleCategories(null);
    setSelectedDesignations(null);
  }, []);

  return {
    selectedCategory0EntityIds: toStringSelection(selectedCategory0EntityIds),
    selectedCategory1EntityIds: toStringSelection(selectedCategory1EntityIds),
    selectedCategory2EntityIds: toStringSelection(selectedCategory2EntityIds),
    selectedRoleCategories,
    selectedDesignations,
    category0Options,
    category0DistributionOptions,
    category1Options,
    category2Options,
    roleCategoryOptions,
    designationOptions,
    filteredUsers,
    activeFilters,
    handleCategory0EntityChange,
    handleCategory0DistributionSelect,
    handleCategory1EntityChange,
    handleCategory2EntityChange,
    handleRoleCategoryChange,
    handleDesignationChange,
    clearAllFilters,
  };
}
