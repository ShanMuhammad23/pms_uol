"use client";

import {
  useCallback,
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
  matchesUserEntityMultiFilter,
  matchesUserPageFilters,
  matchesUserPageFiltersExcluding,
  type UserFilterDimension,
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

  const filteredUsers = useMemo(
    () => users.filter((user) => matchesUserPageFilters(user, baseFilterState)),
    [users, baseFilterState],
  );

  const countForDimension = useCallback(
    (dimension: UserFilterDimension, predicate: (user: UserRecord) => boolean) => {
      let count = 0;
      for (const user of users) {
        if (
          matchesUserPageFiltersExcluding(user, baseFilterState, dimension) &&
          predicate(user)
        ) {
          count += 1;
        }
      }
      return count;
    },
    [users, baseFilterState],
  );

  const category0Options = useMemo<MultiSelectOption[]>(
    () =>
      category0Entities.map((entity) => ({
        value: String(entity.id),
        label: entity.name,
        count: countForDimension("category0", (user) =>
          matchesUserEntityMultiFilter(user, [entity.id], entities),
        ),
      })),
    [category0Entities, countForDimension, entities],
  );

  const category0DistributionOptions = useMemo<MultiSelectOption[]>(() => {
    const visibleEntities =
      selectedCategory0EntityIds !== null && selectedCategory0EntityIds.length > 0
        ? category0Entities.filter((entity) =>
            selectedCategory0EntityIds.includes(entity.id),
          )
        : category0Entities;

    return visibleEntities
      .map((entity) => ({
        value: String(entity.id),
        label: entity.name,
        count: filteredUsers.filter((user) =>
          matchesUserEntityMultiFilter(user, [entity.id], entities),
        ).length,
      }))
      .filter((option) => option.count > 0);
  }, [
    category0Entities,
    selectedCategory0EntityIds,
    filteredUsers,
    entities,
  ]);

  const category1Options = useMemo<MultiSelectOption[]>(
    () =>
      category1Entities.map((entity) => ({
        value: String(entity.id),
        label: entity.name,
        count: countForDimension("category1", (user) =>
          matchesUserEntityMultiFilter(user, [entity.id], entities),
        ),
      })),
    [category1Entities, countForDimension, entities],
  );

  const category2Options = useMemo<MultiSelectOption[]>(
    () =>
      category2Entities.map((entity) => ({
        value: String(entity.id),
        label: entity.name,
        count: countForDimension("category2", (user) =>
          matchesUserEntityMultiFilter(user, [entity.id], entities),
        ),
      })),
    [category2Entities, countForDimension, entities],
  );

  const roleCategoryOptions = useMemo<MultiSelectOption[]>(() => {
    const counts = new Map<string, number>();

    for (const user of users) {
      const value = formatRoleCategoryValue(user.roleCategory);
      if (
        matchesUserPageFiltersExcluding(user, baseFilterState, "roleCategory")
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
      .sort((left, right) => {
        if (left.value === "—") return 1;
        if (right.value === "—") return -1;
        return left.label.localeCompare(right.label, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [users, baseFilterState, selectedRoleCategories]);

  const designationOptions = useMemo<MultiSelectOption[]>(
    () =>
      designations
        .map((designation) => ({
          value: designation,
          label: designation,
          count: countForDimension(
            "designation",
            (user) => (user.designation?.trim() ?? "") === designation,
          ),
        }))
        .filter((option) => option.count > 0),
    [designations, countForDimension],
  );

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
