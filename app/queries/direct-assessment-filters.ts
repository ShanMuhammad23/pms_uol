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

export function matchesDirectAssessmentFilters(
  emp: DirectAssessmentEmployee,
  filters: DirectAssessmentFilterState,
  entities: EntityRecord[],
): boolean {
  // Designation filter
  if (filters.selectedDesignations !== null) {
    if (filters.selectedDesignations.length === 0) return false;
    const designation = emp.designation ?? "";
    if (!filters.selectedDesignations.includes(designation)) return false;
  }

  // Role Category filter
  if (filters.selectedRoleCategories !== null) {
    if (filters.selectedRoleCategories.length === 0) return false;
    const roleCategory = emp.roleCategory ?? "";
    if (!filters.selectedRoleCategories.includes(roleCategory)) return false;
  }

  // Assessment Status filter
  if (filters.selectedAssessmentStatuses !== null) {
    if (filters.selectedAssessmentStatuses.length === 0) return false;
    const bucket = resolveAssessmentStatusBucket(emp);
    if (!filters.selectedAssessmentStatuses.includes(bucket)) return false;
  }

  // Organization hierarchy filters (AND logic across levels)
  if (
    filters.selectedCategory0EntityIds !== null ||
    filters.selectedCategory1EntityIds !== null ||
    filters.selectedCategory2EntityIds !== null
  ) {
    if (emp.entityId == null) return false;

    const selfAndAncestors = getEntitySelfAndAncestorIds(emp.entityId, entities);

    if (filters.selectedCategory0EntityIds !== null) {
      if (filters.selectedCategory0EntityIds.length === 0) return false;
      const category0Entities = getEntitiesForFilterLevels(entities, 0, null);
      const matchingC0 = category0Entities.some(
        (e) =>
          filters.selectedCategory0EntityIds!.includes(e.id) &&
          selfAndAncestors.has(e.id),
      );
      if (!matchingC0) return false;
    }

    if (filters.selectedCategory1EntityIds !== null) {
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

    if (filters.selectedCategory2EntityIds !== null) {
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

function buildOptionsFromValues(values: string[]): MultiSelectOption[] {
  return values
    .filter((v) => v !== "")
    .map((value) => ({ value, label: value, count: 0 }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
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

  // Build filter options from the employee dataset
  const designationOptions = useMemo(() => {
    const designations = new Set<string>();
    for (const emp of employees) {
      if (emp.designation) designations.add(emp.designation);
    }
    return buildOptionsFromValues([...designations]);
  }, [employees]);

  const roleCategoryOptions = useMemo(() => {
    const categories = new Set<string>();
    for (const emp of employees) {
      if (emp.roleCategory) categories.add(emp.roleCategory);
    }
    return buildOptionsFromValues([...categories]);
  }, [employees]);

  const assessmentStatusOptions = useMemo<MultiSelectOption[]>(
    () =>
      ASSESSMENT_STATUS_OPTIONS.map((opt) => ({
        value: opt.value,
        label: opt.label,
        count: 0,
      })),
    [],
  );

  // Entity filter options (cascading)
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

  const category0Options = useMemo<MultiSelectOption[]>(
    () =>
      category0Entities.map((entity) => ({
        value: String(entity.id),
        label: entity.name,
        count: 0,
      })),
    [category0Entities],
  );

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

  // Prune child selections when parent changes
  const prunedCategory1 = useMemo(
    () => pruneMultiSelection(selectedCategory1EntityIds, category1Entities.map((e) => e.id)),
    [selectedCategory1EntityIds, category1Entities],
  );
  const prunedCategory2 = useMemo(
    () => pruneMultiSelection(selectedCategory2EntityIds, category2Entities.map((e) => e.id)),
    [selectedCategory2EntityIds, category2Entities],
  );

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
