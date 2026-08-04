"use client";

import { useCallback, useMemo, useState } from "react";
import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import {
  ENTITY_FILTER_LEVELS,
  getEntitiesForFilterLevels,
  getEntitySelfAndAncestorIds,
  pruneMultiSelection,
  type MultiFilterSelection,
} from "@/app/helpers/dashboard-entity-filters";
import type { EntityRecord } from "@/types/entities";
import type { DirectAssessmentEmployee } from "@/lib/queries/direct-assessment-client";

/** Assessment status filter values. */
export type AssessmentStatusFilter = "pending" | "locked" | "approved" | "final";

export const ASSESSMENT_STATUS_OPTIONS: { value: AssessmentStatusFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "locked", label: "Pending Mgr" },
  { value: "approved", label: "Approved" },
  { value: "final", label: "Locked" },
];

export interface DirectAssessmentFilterState {
  selectedDesignations: MultiFilterSelection<string>;
  selectedRoleCategories: MultiFilterSelection<string>;
  selectedAssessmentStatuses: MultiFilterSelection<AssessmentStatusFilter>;
  selectedCategory0EntityIds: MultiFilterSelection<number>;
  selectedCategory1EntityIds: MultiFilterSelection<number>;
  selectedCategory2EntityIds: MultiFilterSelection<number>;
}

export const EMPTY_DIRECT_ASSESSMENT_FILTER_STATE: DirectAssessmentFilterState = {
  selectedDesignations: null,
  selectedRoleCategories: null,
  selectedAssessmentStatuses: null,
  selectedCategory0EntityIds: null,
  selectedCategory1EntityIds: null,
  selectedCategory2EntityIds: null,
};

/**
 * Resolves an employee's assessment status into a filter-friendly bucket.
 * - "pending": editable by current reviewer (canEdit = true)
 * - "locked": pending review but not editable by current reviewer (Pending Mgr)
 * - "approved": past PENDING_HEAD_REVIEW (HR calibration / board)
 * - "final": APPROVED or COMPLETED (Locked)
 */
function resolveAssessmentStatusBucket(
  emp: Pick<DirectAssessmentEmployee, "canEdit" | "status">,
): AssessmentStatusFilter {
  if (emp.canEdit) return "pending";
  if (emp.status === "PENDING_HEAD_REVIEW") return "locked";
  if (emp.status === "APPROVED" || emp.status === "COMPLETED") return "final";
  return "approved";
}

/** Filter dimensions that can be excluded for cascading count calculations. */
export type DirectAssessmentFilterDimension =
  | "designation"
  | "roleCategory"
  | "assessmentStatus"
  | "category0"
  | "category1"
  | "category2";

/**
 * Same as {@link matchesDirectAssessmentFilters}, but ignores the filter for
 * `excludeDimension`. Used to compute cascading filter option counts: the
 * count for dimension X reflects all employees matching every active filter
 * *except* X's own filter, so users can see how many records each option
 * would add/remove.
 */
function matchesDirectAssessmentFiltersExcluding(
  emp: DirectAssessmentEmployee,
  filters: DirectAssessmentFilterState,
  entities: EntityRecord[],
  excludeDimension: DirectAssessmentFilterDimension | null,
): boolean {
  // Designation filter
  if (
    excludeDimension !== "designation" &&
    filters.selectedDesignations !== null
  ) {
    if (filters.selectedDesignations.length === 0) return false;
    const designation = emp.designation ?? "";
    if (!filters.selectedDesignations.includes(designation)) return false;
  }

  // Role Category filter
  if (
    excludeDimension !== "roleCategory" &&
    filters.selectedRoleCategories !== null
  ) {
    if (filters.selectedRoleCategories.length === 0) return false;
    const roleCategory = emp.roleCategory ?? "";
    if (!filters.selectedRoleCategories.includes(roleCategory)) return false;
  }

  // Assessment Status filter
  if (
    excludeDimension !== "assessmentStatus" &&
    filters.selectedAssessmentStatuses !== null
  ) {
    if (filters.selectedAssessmentStatuses.length === 0) return false;
    const bucket = resolveAssessmentStatusBucket(emp);
    if (!filters.selectedAssessmentStatuses.includes(bucket)) return false;
  }

  // Organization hierarchy filters (AND logic across levels)
  if (
    (excludeDimension !== "category0" &&
      filters.selectedCategory0EntityIds !== null) ||
    (excludeDimension !== "category1" &&
      filters.selectedCategory1EntityIds !== null) ||
    (excludeDimension !== "category2" &&
      filters.selectedCategory2EntityIds !== null)
  ) {
    if (emp.entityId == null) return false;

    const selfAndAncestors = getEntitySelfAndAncestorIds(emp.entityId, entities);

    if (
      excludeDimension !== "category0" &&
      filters.selectedCategory0EntityIds !== null
    ) {
      if (filters.selectedCategory0EntityIds.length === 0) return false;
      const category0Entities = getEntitiesForFilterLevels(entities, 0, null);
      const matchingC0 = category0Entities.some(
        (e) =>
          filters.selectedCategory0EntityIds!.includes(e.id) &&
          selfAndAncestors.has(e.id),
      );
      if (!matchingC0) return false;
    }

    if (
      excludeDimension !== "category1" &&
      filters.selectedCategory1EntityIds !== null
    ) {
      if (filters.selectedCategory1EntityIds.length === 0) return false;
      const category1Entities = getEntitiesForFilterLevels(
        entities,
        1,
        filters.selectedCategory0EntityIds,
      );
      const matchingC1 = category1Entities.some(
        (e) =>
          filters.selectedCategory1EntityIds!.includes(e.id) &&
          selfAndAncestors.has(e.id),
      );
      if (!matchingC1) return false;
    }

    if (
      excludeDimension !== "category2" &&
      filters.selectedCategory2EntityIds !== null
    ) {
      if (filters.selectedCategory2EntityIds.length === 0) return false;
      const category2Entities = getEntitiesForFilterLevels(
        entities,
        2,
        filters.selectedCategory1EntityIds,
      );
      const matchingC2 = category2Entities.some(
        (e) =>
          filters.selectedCategory2EntityIds!.includes(e.id) &&
          selfAndAncestors.has(e.id),
      );
      if (!matchingC2) return false;
    }
  }

  return true;
}

export function matchesDirectAssessmentFilters(
  emp: DirectAssessmentEmployee,
  filters: DirectAssessmentFilterState,
  entities: EntityRecord[],
): boolean {
  return matchesDirectAssessmentFiltersExcluding(
    emp,
    filters,
    entities,
    null,
  );
}

export function filterDirectAssessmentEmployees(
  employees: DirectAssessmentEmployee[],
  filters: DirectAssessmentFilterState,
  entities: EntityRecord[],
): DirectAssessmentEmployee[] {
  const hasActiveFilters =
    filters.selectedDesignations !== null ||
    filters.selectedRoleCategories !== null ||
    filters.selectedAssessmentStatuses !== null ||
    filters.selectedCategory0EntityIds !== null ||
    filters.selectedCategory1EntityIds !== null ||
    filters.selectedCategory2EntityIds !== null;

  if (!hasActiveFilters) return employees;

  return employees.filter((emp) =>
    matchesDirectAssessmentFilters(emp, filters, entities),
  );
}

export function hasActiveDirectAssessmentFilters(
  filters: DirectAssessmentFilterState,
): boolean {
  return (
    filters.selectedDesignations !== null ||
    filters.selectedRoleCategories !== null ||
    filters.selectedAssessmentStatuses !== null ||
    filters.selectedCategory0EntityIds !== null ||
    filters.selectedCategory1EntityIds !== null ||
    filters.selectedCategory2EntityIds !== null
  );
}

export interface UseDirectAssessmentFiltersResult {
  filterState: DirectAssessmentFilterState;
  selectedDesignations: string[] | null;
  selectedRoleCategories: string[] | null;
  selectedAssessmentStatuses: string[] | null;
  selectedCategory0EntityIds: string[] | null;
  selectedCategory1EntityIds: string[] | null;
  selectedCategory2EntityIds: string[] | null;
  designationOptions: MultiSelectOption[];
  roleCategoryOptions: MultiSelectOption[];
  assessmentStatusOptions: MultiSelectOption[];
  category0Options: MultiSelectOption[];
  category1Options: MultiSelectOption[];
  category2Options: MultiSelectOption[];
  hasActiveFilters: boolean;
  handleDesignationChange: (values: string[] | null) => void;
  handleRoleCategoryChange: (values: string[] | null) => void;
  handleAssessmentStatusChange: (values: string[] | null) => void;
  handleCategory0EntityChange: (values: string[] | null) => void;
  handleCategory1EntityChange: (values: string[] | null) => void;
  handleCategory2EntityChange: (values: string[] | null) => void;
  clearAllFilters: () => void;
}

function toStringSelection(
  selected: MultiFilterSelection<number>,
): string[] | null {
  return selected === null ? null : selected.map(String);
}

function fromStringIds(values: string[] | null): MultiFilterSelection<number> {
  return values === null ? null : values.map(Number);
}

/**
 * Builds filter options with cascading counts from the employee dataset.
 *
 * For each distinct value of the given `getValue` selector, the count is the
 * number of employees matching every active filter *except* `excludeDimension`
 * — so the user sees how many records each option would yield if selected.
 * This mirrors the Staff Listing's `buildMasterFilterOptions` cascade logic.
 *
 * `valueToLabel` maps the raw value to a display label (e.g. entity id → name).
 * `fixedValues` (optional) ensures certain values always appear (e.g. all
 * status buckets), even if no employee currently maps to them.
 */
function buildOptionsWithCounts(
  employees: DirectAssessmentEmployee[],
  filters: DirectAssessmentFilterState,
  entities: EntityRecord[],
  excludeDimension: DirectAssessmentFilterDimension,
  getValue: (emp: DirectAssessmentEmployee) => string | null | undefined,
  valueToLabel: (value: string) => string,
  fixedValues?: string[],
): MultiSelectOption[] {
  const counts = new Map<string, number>();
  const labelByValue = new Map<string, string>();

  for (const emp of employees) {
    if (
      !matchesDirectAssessmentFiltersExcluding(
        emp,
        filters,
        entities,
        excludeDimension,
      )
    ) {
      continue;
    }
    const rawValue = getValue(emp);
    const value = rawValue && rawValue !== "" ? rawValue : "—";
    counts.set(value, (counts.get(value) ?? 0) + 1);
    labelByValue.set(value, value === "—" ? "—" : valueToLabel(value));
  }

  // Ensure fixed values (e.g. all assessment status buckets) always appear,
  // even with a zero count, so the dropdown structure stays stable.
  if (fixedValues) {
    for (const value of fixedValues) {
      if (!counts.has(value)) {
        counts.set(value, 0);
        labelByValue.set(value, valueToLabel(value));
      }
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: labelByValue.get(value) ?? value,
      count,
    }))
    .filter((option) => option.count > 0 || (fixedValues?.includes(option.value) ?? false))
    .sort((a, b) => {
      if (a.value === "—") return 1;
      if (b.value === "—") return -1;
      return a.label.localeCompare(b.label, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

export function useDirectAssessmentFilters(
  employees: DirectAssessmentEmployee[],
  entities: EntityRecord[],
): UseDirectAssessmentFiltersResult {
  const [selectedDesignations, setSelectedDesignations] =
    useState<MultiFilterSelection<string>>(null);
  const [selectedRoleCategories, setSelectedRoleCategories] =
    useState<MultiFilterSelection<string>>(null);
  const [selectedAssessmentStatuses, setSelectedAssessmentStatuses] =
    useState<MultiFilterSelection<AssessmentStatusFilter>>(null);
  const [selectedCategory0EntityIds, setSelectedCategory0EntityIds] =
    useState<MultiFilterSelection<number>>(null);
  const [selectedCategory1EntityIds, setSelectedCategory1EntityIds] =
    useState<MultiFilterSelection<number>>(null);
  const [selectedCategory2EntityIds, setSelectedCategory2EntityIds] =
    useState<MultiFilterSelection<number>>(null);

  // Entity lists (cascading parent → child). Computed early because the
  // filterState pruning and the option counts both depend on them.
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

  // Prune child selections when parent changes
  const prunedCategory1 = useMemo(
    () => pruneMultiSelection(selectedCategory1EntityIds, category1Entities.map((e) => e.id)),
    [selectedCategory1EntityIds, category1Entities],
  );
  const prunedCategory2 = useMemo(
    () => pruneMultiSelection(selectedCategory2EntityIds, category2Entities.map((e) => e.id)),
    [selectedCategory2EntityIds, category2Entities],
  );

  // Filter state is computed before option memos because the cascading
  // counts below depend on the full active filter state (excluding each
  // option's own dimension).
  const filterState: DirectAssessmentFilterState = useMemo(
    () => ({
      selectedDesignations,
      selectedRoleCategories,
      selectedAssessmentStatuses,
      selectedCategory0EntityIds,
      selectedCategory1EntityIds: prunedCategory1,
      selectedCategory2EntityIds: prunedCategory2,
    }),
    [
      selectedDesignations,
      selectedRoleCategories,
      selectedAssessmentStatuses,
      selectedCategory0EntityIds,
      prunedCategory1,
      prunedCategory2,
    ],
  );

  // ---- Dynamic filter options with cascading counts ----
  //
  // Each option's count reflects the number of employees matching every
  // active filter *except* that option's own dimension — so the user sees
  // how many records each value would yield if selected. Options are built
  // from the employee dataset (already RBAC-scoped server-side), so counts
  // never include inaccessible employees.

  const designationOptions = useMemo(
    () =>
      buildOptionsWithCounts(
        employees,
        filterState,
        entities,
        "designation",
        (emp) => emp.designation,
        (value) => value,
      ),
    [employees, filterState, entities],
  );

  const roleCategoryOptions = useMemo(
    () =>
      buildOptionsWithCounts(
        employees,
        filterState,
        entities,
        "roleCategory",
        (emp) => emp.roleCategory,
        (value) => value,
      ),
    [employees, filterState, entities],
  );

  const assessmentStatusOptions = useMemo<MultiSelectOption[]>(
    () =>
      buildOptionsWithCounts(
        employees,
        filterState,
        entities,
        "assessmentStatus",
        (emp) => resolveAssessmentStatusBucket(emp),
        (value) =>
          ASSESSMENT_STATUS_OPTIONS.find((opt) => opt.value === value)?.label ??
          value,
        // Keep all status buckets visible (even at zero count) so the
        // dropdown structure stays stable and users can see what statuses
        // exist in the workflow.
        ASSESSMENT_STATUS_OPTIONS.map((opt) => opt.value),
      ),
    [employees, filterState, entities],
  );

  // Entity (Organization) filter options with counts. For each entity at
  // the given level, the count is the number of employees whose entity
  // self+ancestors include that entity id, matching all other active
  // filters. Only entities that actually have employees in the dataset are
  // shown (zero-count entities are filtered out) so the dropdown reflects
  // real data, not the full org tree.
  const category0Options = useMemo<MultiSelectOption[]>(() => {
    return buildOptionsWithCounts(
      employees,
      filterState,
      entities,
      "category0",
      (emp) => {
        if (emp.entityId == null) return null;
        const selfAndAncestors = getEntitySelfAndAncestorIds(emp.entityId, entities);
        const match = category0Entities.find((e) => selfAndAncestors.has(e.id));
        return match ? String(match.id) : null;
      },
      (value) =>
        category0Entities.find((e) => String(e.id) === value)?.name ?? value,
    );
  }, [employees, filterState, entities, category0Entities]);

  const category1Options = useMemo<MultiSelectOption[]>(() => {
    return buildOptionsWithCounts(
      employees,
      filterState,
      entities,
      "category1",
      (emp) => {
        if (emp.entityId == null) return null;
        const selfAndAncestors = getEntitySelfAndAncestorIds(emp.entityId, entities);
        const match = category1Entities.find((e) => selfAndAncestors.has(e.id));
        return match ? String(match.id) : null;
      },
      (value) =>
        category1Entities.find((e) => String(e.id) === value)?.name ?? value,
    );
  }, [employees, filterState, entities, category1Entities]);

  const category2Options = useMemo<MultiSelectOption[]>(() => {
    return buildOptionsWithCounts(
      employees,
      filterState,
      entities,
      "category2",
      (emp) => {
        if (emp.entityId == null) return null;
        const selfAndAncestors = getEntitySelfAndAncestorIds(emp.entityId, entities);
        const match = category2Entities.find((e) => selfAndAncestors.has(e.id));
        return match ? String(match.id) : null;
      },
      (value) =>
        category2Entities.find((e) => String(e.id) === value)?.name ?? value,
    );
  }, [employees, filterState, entities, category2Entities]);

  const hasActiveFilters = hasActiveDirectAssessmentFilters(filterState);

  const handleDesignationChange = useCallback((values: string[] | null) => {
    setSelectedDesignations(values);
  }, []);

  const handleRoleCategoryChange = useCallback((values: string[] | null) => {
    setSelectedRoleCategories(values);
  }, []);

  const handleAssessmentStatusChange = useCallback(
    (values: string[] | null) => {
      setSelectedAssessmentStatuses(
        values === null ? null : (values as AssessmentStatusFilter[]),
      );
    },
    [],
  );

  const handleCategory0EntityChange = useCallback((values: string[] | null) => {
    setSelectedCategory0EntityIds(fromStringIds(values));
  }, []);

  const handleCategory1EntityChange = useCallback((values: string[] | null) => {
    setSelectedCategory1EntityIds(fromStringIds(values));
  }, []);

  const handleCategory2EntityChange = useCallback((values: string[] | null) => {
    setSelectedCategory2EntityIds(fromStringIds(values));
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedDesignations(null);
    setSelectedRoleCategories(null);
    setSelectedAssessmentStatuses(null);
    setSelectedCategory0EntityIds(null);
    setSelectedCategory1EntityIds(null);
    setSelectedCategory2EntityIds(null);
  }, []);

  return {
    filterState,
    selectedDesignations,
    selectedRoleCategories,
    selectedAssessmentStatuses:
      selectedAssessmentStatuses === null
        ? null
        : selectedAssessmentStatuses.map(String),
    selectedCategory0EntityIds: toStringSelection(selectedCategory0EntityIds),
    selectedCategory1EntityIds: toStringSelection(prunedCategory1),
    selectedCategory2EntityIds: toStringSelection(prunedCategory2),
    designationOptions,
    roleCategoryOptions,
    assessmentStatusOptions,
    category0Options,
    category1Options,
    category2Options,
    hasActiveFilters,
    handleDesignationChange,
    handleRoleCategoryChange,
    handleAssessmentStatusChange,
    handleCategory0EntityChange,
    handleCategory1EntityChange,
    handleCategory2EntityChange,
    clearAllFilters,
  };
}

export { ENTITY_FILTER_LEVELS };
