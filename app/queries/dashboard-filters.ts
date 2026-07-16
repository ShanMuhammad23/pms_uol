"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { ActiveFilter } from "@/app/components/dashboard/DashboardFilterBar";
import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import {
  ENTITY_FILTER_LEVELS,
  getEntitiesForFilterLevels,
  pruneMultiSelection,
  type MultiFilterSelection,
} from "@/app/helpers/dashboard-entity-filters";
import {
  matchesSubmissionEntityMultiFilter,
  matchesSubmissionFilters,
  matchesSubmissionFiltersExcluding,
  type FilterDimension,
  type SubmissionFilterState,
} from "@/app/helpers/dashboard-filters";
import { FORM_STATE_CONFIG } from "@/app/helpers/dashboard-form-state";
import type { FormState } from "@/app/helpers/dashboard-types";
import type { EntityRecord } from "@/types/entities";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { StaffCategoryWithSubCategories } from "@/types/staff-categories";

interface UseDashboardFiltersParams {
  submissions: FormSubmissionListItem[];
  staffCategories: StaffCategoryWithSubCategories[];
  entities: EntityRecord[];
  designations: string[];
}

const FORM_STATE_OPTIONS = Object.keys(FORM_STATE_CONFIG) as FormState[];

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

export function useDashboardFilters({
  submissions,
  staffCategories,
  entities,
  designations,
}: UseDashboardFiltersParams) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory0EntityIds, setSelectedCategory0EntityIds] =
    useState<MultiFilterSelection<number>>(null);
  const [selectedCategory1EntityIds, setSelectedCategory1EntityIds] =
    useState<MultiFilterSelection<number>>(null);
  const [selectedCategory2EntityIds, setSelectedCategory2EntityIds] =
    useState<MultiFilterSelection<number>>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] =
    useState<MultiFilterSelection<number>>(null);
  const [selectedSubCategoryIds, setSelectedSubCategoryIds] =
    useState<MultiFilterSelection<number>>(null);
  const [selectedDesignations, setSelectedDesignations] =
    useState<MultiFilterSelection<string>>(null);
  const [selectedFormStates, setSelectedFormStates] =
    useState<MultiFilterSelection<FormState>>(null);

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

  const availableSubCategories = useMemo(() => {
    const categories =
      selectedCategoryIds === null
        ? staffCategories
        : staffCategories.filter((category) =>
            selectedCategoryIds.includes(category.id),
          );

    const byId = new Map<number, StaffCategoryWithSubCategories["subCategories"][number]>();
    for (const category of categories) {
      for (const subCategory of category.subCategories) {
        byId.set(subCategory.id, subCategory);
      }
    }

    return [...byId.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [selectedCategoryIds, staffCategories]);

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

  useEffect(() => {
    setPrunedSelection(
      setSelectedSubCategoryIds,
      availableSubCategories.map((subCategory) => subCategory.id),
    );
  }, [availableSubCategories]);

  const baseFilterState = useMemo<Omit<SubmissionFilterState, never>>(
    () => ({
      searchQuery,
      selectedCategory0EntityIds,
      selectedCategory1EntityIds,
      selectedCategory2EntityIds,
      selectedCategoryIds,
      selectedSubCategoryIds,
      selectedDesignations,
      selectedFormStates,
      staffCategories,
      entities,
    }),
    [
      searchQuery,
      selectedCategory0EntityIds,
      selectedCategory1EntityIds,
      selectedCategory2EntityIds,
      selectedCategoryIds,
      selectedSubCategoryIds,
      selectedDesignations,
      selectedFormStates,
      staffCategories,
      entities,
    ],
  );

  const filteredSubmissions = useMemo(
    () =>
      submissions.filter((submission) =>
        matchesSubmissionFilters(submission, baseFilterState),
      ),
    [submissions, baseFilterState],
  );

  const countForDimension = useCallback(
    (
      dimension: FilterDimension,
      predicate: (submission: FormSubmissionListItem) => boolean,
    ) => {
      let count = 0;
      for (const submission of submissions) {
        if (
          matchesSubmissionFiltersExcluding(submission, baseFilterState, dimension) &&
          predicate(submission)
        ) {
          count += 1;
        }
      }
      return count;
    },
    [submissions, baseFilterState],
  );

  const category0Options = useMemo<MultiSelectOption[]>(
    () =>
      category0Entities.map((entity) => ({
        value: String(entity.id),
        label: entity.name,
        count: countForDimension("category0", (submission) =>
          matchesSubmissionEntityMultiFilter(submission, [entity.id], entities),
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
        count: filteredSubmissions.filter((submission) =>
          matchesSubmissionEntityMultiFilter(submission, [entity.id], entities),
        ).length,
      }))
      .filter((option) => option.count > 0);
  }, [
    category0Entities,
    selectedCategory0EntityIds,
    filteredSubmissions,
    entities,
  ]);

  const category1Options = useMemo<MultiSelectOption[]>(
    () =>
      category1Entities.map((entity) => ({
        value: String(entity.id),
        label: entity.name,
        count: countForDimension("category1", (submission) =>
          matchesSubmissionEntityMultiFilter(submission, [entity.id], entities),
        ),
      })),
    [category1Entities, countForDimension, entities],
  );

  const category2Options = useMemo<MultiSelectOption[]>(
    () =>
      category2Entities.map((entity) => ({
        value: String(entity.id),
        label: entity.name,
        count: countForDimension("category2", (submission) =>
          matchesSubmissionEntityMultiFilter(submission, [entity.id], entities),
        ),
      })),
    [category2Entities, countForDimension, entities],
  );

  const staffCategoryOptions = useMemo<MultiSelectOption[]>(
    () =>
      staffCategories.map((category) => ({
        value: String(category.id),
        label: category.name,
        count: countForDimension(
          "staffCategory",
          (submission) =>
            submission.staffCategoryId === category.id ||
            submission.staffCategoryName === category.name,
        ),
      })),
    [staffCategories, countForDimension],
  );

  const staffSubCategoryOptions = useMemo<MultiSelectOption[]>(
    () =>
      availableSubCategories.map((subCategory) => ({
        value: String(subCategory.id),
        label: subCategory.name,
        count: countForDimension(
          "staffSubCategory",
          (submission) =>
            submission.staffSubCategoryId === subCategory.id ||
            submission.staffSubCategoryName === subCategory.name,
        ),
      })),
    [availableSubCategories, countForDimension],
  );

  const designationOptions = useMemo<MultiSelectOption[]>(
    () =>
      designations
        .map((designation) => ({
          value: designation,
          label: designation,
          count: countForDimension(
            "designation",
            (submission) =>
              (submission.designation?.trim() ?? "") === designation,
          ),
        }))
        .filter((option) => option.count > 0),
    [designations, countForDimension],
  );

  const formStateOptions = useMemo<MultiSelectOption[]>(
    () =>
      FORM_STATE_OPTIONS.map((state) => ({
        value: state,
        label: FORM_STATE_CONFIG[state].label,
        count: countForDimension(
          "formState",
          (submission) => submission.status === state,
        ),
      })),
    [countForDimension],
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

  const handleStaffCategoryChange = useCallback((values: string[] | null) => {
    setSelectedCategoryIds(fromStringIds(values));
  }, []);

  const handleSubCategoryChange = useCallback((values: string[] | null) => {
    setSelectedSubCategoryIds(fromStringIds(values));
  }, []);

  const handleDesignationChange = useCallback((values: string[] | null) => {
    setSelectedDesignations(values);
  }, []);

  const handleFormStateChange = useCallback((values: string[] | null) => {
    setSelectedFormStates(
      values === null ? null : (values as FormState[]),
    );
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

    if (selectedCategoryIds !== null) {
      filters.push({
        label: formatMultiChipLabel(
          "Staff Category",
          selectedCategoryIds.map(String),
          (value) =>
            staffCategories.find((category) => category.id === Number(value))
              ?.name ?? value,
        ),
        onRemove: () => setSelectedCategoryIds(null),
        color: "amber",
      });
    }

    if (selectedSubCategoryIds !== null) {
      filters.push({
        label: formatMultiChipLabel(
          "Staff Sub-Category",
          selectedSubCategoryIds.map(String),
          (value) =>
            availableSubCategories.find(
              (subCategory) => subCategory.id === Number(value),
            )?.name ?? value,
        ),
        onRemove: () => setSelectedSubCategoryIds(null),
        color: "blue",
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

    if (selectedFormStates !== null) {
      filters.push({
        label: formatMultiChipLabel(
          "State",
          selectedFormStates,
          (value) => FORM_STATE_CONFIG[value as FormState]?.label ?? value,
        ),
        onRemove: () => setSelectedFormStates(null),
        color: "orange",
      });
    }

    if (searchQuery) {
      filters.push({
        label: `Search: "${searchQuery}"`,
        onRemove: () => setSearchQuery(""),
        color: "emerald",
      });
    }

    return filters;
  }, [
    selectedCategory0EntityIds,
    selectedCategory1EntityIds,
    selectedCategory2EntityIds,
    selectedCategoryIds,
    selectedSubCategoryIds,
    selectedDesignations,
    selectedFormStates,
    searchQuery,
    staffCategories,
    availableSubCategories,
    entities,
  ]);

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategory0EntityIds(null);
    setSelectedCategory1EntityIds(null);
    setSelectedCategory2EntityIds(null);
    setSelectedCategoryIds(null);
    setSelectedSubCategoryIds(null);
    setSelectedDesignations(null);
    setSelectedFormStates(null);
  }, []);

  const filterByFormState = useCallback((state: FormState) => {
    setSelectedFormStates((prev) => {
      if (prev === null) {
        return [state];
      }

      if (prev.length === 1 && prev[0] === state) {
        return null;
      }

      return [state];
    });
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    selectedCategory0EntityIds: toStringSelection(selectedCategory0EntityIds),
    selectedCategory1EntityIds: toStringSelection(selectedCategory1EntityIds),
    selectedCategory2EntityIds: toStringSelection(selectedCategory2EntityIds),
    selectedCategoryIds: toStringSelection(selectedCategoryIds),
    selectedSubCategoryIds: toStringSelection(selectedSubCategoryIds),
    selectedDesignations,
    selectedFormStates:
      selectedFormStates === null ? null : selectedFormStates.map(String),
    category0Options,
    category0DistributionOptions,
    category1Options,
    category2Options,
    staffCategoryOptions,
    staffSubCategoryOptions,
    designationOptions,
    formStateOptions,
    filteredSubmissions,
    activeFilters,
    handleCategory0EntityChange,
    handleCategory0DistributionSelect,
    handleCategory1EntityChange,
    handleCategory2EntityChange,
    handleStaffCategoryChange,
    handleSubCategoryChange,
    handleDesignationChange,
    handleFormStateChange,
    clearAllFilters,
    filterByFormState,
  };
}
