"use client";

import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import type { ActiveFilter } from "@/app/components/dashboard/DashboardFilterBar";
import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import {
  ENTITY_FILTER_LEVELS,
  getEntitiesForFilterLevels,
  pruneMultiSelection,
  type MultiFilterSelection,
} from "@/app/helpers/dashboard-entity-filters";
import {
  FORM_STATE_CONFIG,
  FORM_STATE_IDS,
  LEGACY_HEAD_REVIEW_FORM_STATE,
  normalizeSelectedFormStates,
} from "@/app/helpers/dashboard-form-state";
import type { CardFilterId, FormState } from "@/app/helpers/dashboard-types";
import type { DashboardFilterParams } from "@/types/dashboard-api";
import type { EntityRecord } from "@/types/entities";
import { useSessionStorageState } from "@/app/hooks/use-session-storage-state";

interface UseDashboardFiltersParams {
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

/** Human-readable label for a dashboard card filter chip. */
function formatCardFilterChipLabel(cardId: CardFilterId): string {
  if (cardId.startsWith("eligibility:")) {
    const status = cardId.slice("eligibility:".length);
    if (status === "Ineligible" || status === "Not Applicable") return "Eligibility: N/A";
    if (status === "Fully Eligible") return "Eligibility: Full";
    if (status === "Partially Eligible") return "Eligibility: Partial";
    if (status === "Not Eligible") return "Eligibility: None";
    return `Eligibility: ${status}`;
  }

  const [card, number] = cardId.split(":");
  const cardLabels: Record<string, string> = {
    selfAssessment: "Self Assessment",
    manager1: "Manager 1",
    manager2: "Manager 2",
    hrAlignment: "HR Alignment",
    boardApproval: "Board Approval",
  };
  const numberLabels: Record<string, string> = {
    eligible: "Eligible",
    submitted: "Submitted",
    reviewed: "Reviewed",
    aligned: "Aligned",
    pending: "Pending",
    approved: "Approved",
  };
  const cardLabel = cardLabels[card] ?? card;
  const numberLabel = numberLabels[number] ?? number;
  return `${cardLabel}: ${numberLabel}`;
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
  entities,
  designations,
}: UseDashboardFiltersParams) {
  const [searchQuery, setSearchQuery] = useSessionStorageState<string>(
    "pms:dashboard-filters:searchQuery",
    "",
  );
  const [selectedCategory0EntityIds, setSelectedCategory0EntityIds] =
    useSessionStorageState<MultiFilterSelection<number>>(
      "pms:dashboard-filters:category0",
      null,
    );
  const [selectedCategory1EntityIds, setSelectedCategory1EntityIds] =
    useSessionStorageState<MultiFilterSelection<number>>(
      "pms:dashboard-filters:category1",
      null,
    );
  const [selectedCategory2EntityIds, setSelectedCategory2EntityIds] =
    useSessionStorageState<MultiFilterSelection<number>>(
      "pms:dashboard-filters:category2",
      null,
    );
  const [selectedRoleCategories, setSelectedRoleCategories] =
    useSessionStorageState<MultiFilterSelection<string>>(
      "pms:dashboard-filters:roleCategories",
      null,
    );
  const [selectedDesignations, setSelectedDesignations] =
    useSessionStorageState<MultiFilterSelection<string>>(
      "pms:dashboard-filters:designations",
      null,
    );
  const [selectedFormStates, setSelectedFormStates] =
    useSessionStorageState<MultiFilterSelection<FormState>>(
      "pms:dashboard-filters:formStates",
      null,
    );

  useEffect(() => {
    if (selectedFormStates === null) {
      return;
    }
    if (
      (selectedFormStates as readonly string[]).includes(
        LEGACY_HEAD_REVIEW_FORM_STATE,
      )
    ) {
      setSelectedFormStates(normalizeSelectedFormStates(selectedFormStates));
    }
  }, [selectedFormStates, setSelectedFormStates]);

  const [selectedCardFilter, setSelectedCardFilter] =
    useSessionStorageState<CardFilterId | null>(
      "pms:dashboard-filters:cardFilter",
      null,
    );

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

  const filterParams = useMemo<DashboardFilterParams>(
    () => ({
      searchQuery,
      category0EntityIds: selectedCategory0EntityIds,
      category1EntityIds: selectedCategory1EntityIds,
      category2EntityIds: selectedCategory2EntityIds,
      roleCategories: selectedRoleCategories,
      designations: selectedDesignations,
      formStates: normalizeSelectedFormStates(selectedFormStates),
      cardFilter: selectedCardFilter,
    }),
    [
      searchQuery,
      selectedCategory0EntityIds,
      selectedCategory1EntityIds,
      selectedCategory2EntityIds,
      selectedRoleCategories,
      selectedDesignations,
      selectedFormStates,
      selectedCardFilter,
    ],
  );

  const category0Options = useMemo<MultiSelectOption[]>(
    () =>
      category0Entities.map((entity) => ({
        value: String(entity.id),
        label: entity.name,
        count: 0,
      })),
    [category0Entities],
  );

  const category0DistributionOptions = useMemo<MultiSelectOption[]>(() => {
    const visibleEntities =
      selectedCategory0EntityIds !== null && selectedCategory0EntityIds.length > 0
        ? category0Entities.filter((entity) =>
            selectedCategory0EntityIds.includes(entity.id),
          )
        : category0Entities;

    return visibleEntities.map((entity) => ({
      value: String(entity.id),
      label: entity.name,
      count: 0,
    }));
  }, [category0Entities, selectedCategory0EntityIds]);

  const category1Options = useMemo<MultiSelectOption[]>(
    () =>
      category1Entities.map((entity) => ({
        value: String(entity.id),
        label: entity.name,
        count: 0,
      })),
    [category1Entities],
  );

  const category2Options = useMemo<MultiSelectOption[]>(
    () =>
      category2Entities.map((entity) => ({
        value: String(entity.id),
        label: entity.name,
        count: 0,
      })),
    [category2Entities],
  );

  const roleCategoryOptions = useMemo<MultiSelectOption[]>(
    () =>
      (selectedRoleCategories ?? []).map((value) => ({
        value,
        label: value,
        count: 0,
      })),
    [selectedRoleCategories],
  );

  const designationOptions = useMemo<MultiSelectOption[]>(
    () =>
      designations.map((designation) => ({
        value: designation,
        label: designation,
        count: 0,
      })),
    [designations],
  );

  const formStateOptions = useMemo<MultiSelectOption[]>(
    () =>
      FORM_STATE_IDS.map((state) => ({
        value: state,
        label: FORM_STATE_CONFIG[state].label,
        count: 0,
      })),
    [],
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

  const handleFormStateChange = useCallback((values: string[] | null) => {
    setSelectedFormStates(
      values === null ? null : (values as FormState[]),
    );
    // Card filter and formState filter are mutually exclusive.
    setSelectedCardFilter(null);
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

    if (selectedCardFilter !== null) {
      filters.push({
        label: formatCardFilterChipLabel(selectedCardFilter),
        onRemove: () => setSelectedCardFilter(null),
        color: "blue",
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
    selectedRoleCategories,
    selectedDesignations,
    selectedFormStates,
    selectedCardFilter,
    searchQuery,
    entities,
  ]);

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategory0EntityIds(null);
    setSelectedCategory1EntityIds(null);
    setSelectedCategory2EntityIds(null);
    setSelectedRoleCategories(null);
    setSelectedDesignations(null);
    setSelectedFormStates(null);
    setSelectedCardFilter(null);
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
    // Card filter and formState filter are mutually exclusive.
    setSelectedCardFilter(null);
  }, []);

  /**
   * Filter the staff listing by a dashboard card number.
   * Uses the same predicate that produced the count, so the result count
   * always matches the clicked number. Clears the formState filter since
   * the two are mutually exclusive. Toggles off if the same card is clicked
   * again.
   */
  const filterByCard = useCallback((cardId: CardFilterId) => {
    setSelectedCardFilter((prev) => (prev === cardId ? null : cardId));
    setSelectedFormStates(null);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    selectedCategory0EntityIds: toStringSelection(selectedCategory0EntityIds),
    selectedCategory1EntityIds: toStringSelection(selectedCategory1EntityIds),
    selectedCategory2EntityIds: toStringSelection(selectedCategory2EntityIds),
    selectedRoleCategories,
    selectedDesignations,
    selectedFormStates:
      selectedFormStates === null ? null : selectedFormStates.map(String),
    selectedCardFilter,
    category0Options,
    category0DistributionOptions,
    category1Options,
    category2Options,
    roleCategoryOptions,
    designationOptions,
    formStateOptions,
    filterParams,
    activeFilters,
    handleCategory0EntityChange,
    handleCategory0DistributionSelect,
    handleCategory1EntityChange,
    handleCategory2EntityChange,
    handleRoleCategoryChange,
    handleDesignationChange,
    handleFormStateChange,
    clearAllFilters,
    filterByFormState,
    filterByCard,
  };
}
