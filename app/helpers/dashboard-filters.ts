import type { FormState } from "@/app/helpers/dashboard-types";
import {
  getEntityDescendantIds,
  type MultiFilterSelection,
} from "@/app/helpers/dashboard-entity-filters";
import type { EntityRecord } from "@/types/entities";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { APPRAISAL_STATUSES, type AppraisalStatus } from "@/types/forms";

export function formatRoleCategoryValue(
  value: string | null | undefined,
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return value;
}

export type SubmissionFilterState = {
  searchQuery: string;
  selectedCategory0EntityIds: MultiFilterSelection<number>;
  selectedCategory1EntityIds: MultiFilterSelection<number>;
  selectedCategory2EntityIds: MultiFilterSelection<number>;
  selectedRoleCategories: MultiFilterSelection<string>;
  selectedDesignations: MultiFilterSelection<string>;
  selectedFormStates: MultiFilterSelection<FormState>;
  entities: EntityRecord[];
};

export function matchesMultiSelection<T extends string | number>(
  selected: MultiFilterSelection<T>,
  value: T | null | undefined,
): boolean {
  if (selected === null) {
    return true;
  }

  if (selected.length === 0) {
    return false;
  }

  if (value == null) {
    return false;
  }

  return selected.includes(value);
}

export function matchesSubmissionEntityFilter(
  submission: FormSubmissionListItem,
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

  if (submission.entityId === selectedEntityId) {
    return true;
  }

  const descendantIds = getEntityDescendantIds(selectedEntityId, entities);

  if (submission.entityId != null && descendantIds.has(submission.entityId)) {
    return true;
  }

  return (
    submission.entityName === selectedEntity.name ||
    submission.parentEntityName === selectedEntity.name
  );
}

export function matchesSubmissionEntityMultiFilter(
  submission: FormSubmissionListItem,
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
    matchesSubmissionEntityFilter(submission, entityId, entities),
  );
}

export { getEntityDescendantIds };

export function matchesAppraisalFormStates(
  submissionStatus: AppraisalStatus,
  selectedFormStates: MultiFilterSelection<FormState>,
): boolean {
  if (selectedFormStates === null) {
    return true;
  }

  if (selectedFormStates.length === 0) {
    return false;
  }

  return selectedFormStates.some(
    (state) =>
      APPRAISAL_STATUSES.includes(state as AppraisalStatus) &&
      submissionStatus === state,
  );
}

/** @deprecated Prefer matchesAppraisalFormStates for multi-select. */
export function matchesAppraisalFormState(
  submissionStatus: AppraisalStatus,
  selectedFormState: FormState | "ALL",
): boolean {
  if (selectedFormState === "ALL") {
    return true;
  }

  return matchesAppraisalFormStates(submissionStatus, [selectedFormState]);
}

export function matchesSubmissionFilters(
  submission: FormSubmissionListItem,
  filters: SubmissionFilterState,
): boolean {
  const query = filters.searchQuery.toLowerCase();
  const matchesSearch =
    !filters.searchQuery ||
    submission.employeeName.toLowerCase().includes(query) ||
    submission.employeeId.toLowerCase().includes(query) ||
    submission.employeeEmail.toLowerCase().includes(query);

  const matchesEntity0 = matchesSubmissionEntityMultiFilter(
    submission,
    filters.selectedCategory0EntityIds,
    filters.entities,
  );
  const matchesEntity1 = matchesSubmissionEntityMultiFilter(
    submission,
    filters.selectedCategory1EntityIds,
    filters.entities,
  );
  const matchesEntity2 = matchesSubmissionEntityMultiFilter(
    submission,
    filters.selectedCategory2EntityIds,
    filters.entities,
  );

  const matchesRoleCategory = matchesMultiSelection(
    filters.selectedRoleCategories,
    formatRoleCategoryValue(submission.roleCategory),
  );

  const designation = submission.designation?.trim() ?? "";
  const matchesDesignation = matchesMultiSelection(
    filters.selectedDesignations,
    designation || null,
  );

  const matchesFormState = matchesAppraisalFormStates(
    submission.status,
    filters.selectedFormStates,
  );

  return (
    matchesSearch &&
    matchesEntity0 &&
    matchesEntity1 &&
    matchesEntity2 &&
    matchesRoleCategory &&
    matchesDesignation &&
    matchesFormState
  );
}

export type FilterDimension =
  | "category0"
  | "category1"
  | "category2"
  | "roleCategory"
  | "designation"
  | "formState";

export function matchesSubmissionFiltersExcluding(
  submission: FormSubmissionListItem,
  filters: SubmissionFilterState,
  exclude: FilterDimension,
): boolean {
  return matchesSubmissionFilters(submission, {
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
    selectedFormStates: exclude === "formState" ? null : filters.selectedFormStates,
  });
}
