import type { CardFilterId, FormState } from "@/app/helpers/dashboard-types";
import {
  isBoardApprovalApproved,
  isBoardApprovalPending,
  isHrAlignmentAligned,
  isHrAlignmentSubmitted,
  isManager1Reviewed,
  isManager1Submitted,
  isManager2Reviewed,
  isManager2Submitted,
  isSelfAssessmentEligible,
  isSelfAssessmentSubmitted,
  matchesEligibilityStatus,
} from "@/app/helpers/dashboard-workflow-stats";
import {
  getEntityDescendantIds,
  isEntityInCachedSubtree,
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
  selectedCardFilter: CardFilterId | null;
  entities: EntityRecord[];
};

/**
 * Returns true if the submission matches the dashboard card filter.
 * Uses the SAME predicate functions that produce the card counts — this
 * is the single source of truth ensuring count == filter result count.
 */
export function matchesCardFilter(
  submission: FormSubmissionListItem,
  cardFilter: CardFilterId | null,
): boolean {
  if (cardFilter === null) return true;

  switch (cardFilter) {
    case "selfAssessment:eligible":
      return isSelfAssessmentEligible(submission);
    case "selfAssessment:submitted":
      return isSelfAssessmentSubmitted(submission);
    case "manager1:submitted":
      return isManager1Submitted(submission);
    case "manager1:reviewed":
      return isManager1Reviewed(submission);
    case "manager2:submitted":
      return isManager2Submitted(submission);
    case "manager2:reviewed":
      return isManager2Reviewed(submission);
    case "hrAlignment:submitted":
      return isHrAlignmentSubmitted(submission);
    case "hrAlignment:aligned":
      return isHrAlignmentAligned(submission);
    case "boardApproval:pending":
      return isBoardApprovalPending(submission);
    case "boardApproval:approved":
      return isBoardApprovalApproved(submission);
    default:
      if (cardFilter.startsWith("eligibility:")) {
        const raw = cardFilter.slice("eligibility:".length);
        // The EligibilityStatCard passes display labels (e.g. "Not Applicable")
        // rather than internal EligibilityStatus values (e.g. "Ineligible").
        // Normalize back to the internal status before matching.
        const status = (raw === "Not Applicable" ? "Ineligible" : raw) as
          | "Fully Eligible"
          | "Partially Eligible"
          | "Not Eligible"
          | "Ineligible";
        return matchesEligibilityStatus(submission, status);
      }
      return true;
  }
}

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

  // Match by entity id / org subtree only — never by display name.
  // Duplicate entities can share a name; name matching would merge their staff.
  return isEntityInCachedSubtree(
    submission.entityId,
    selectedEntityId,
    entities,
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

  const matchesCard = matchesCardFilter(submission, filters.selectedCardFilter);

  return (
    matchesSearch &&
    matchesEntity0 &&
    matchesEntity1 &&
    matchesEntity2 &&
    matchesRoleCategory &&
    matchesDesignation &&
    matchesFormState &&
    matchesCard
  );
}

export type FilterDimension =
  | "category0"
  | "category1"
  | "category2"
  | "roleCategory"
  | "designation"
  | "formState"
  | "cardFilter";

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
    selectedCardFilter:
      exclude === "cardFilter" ? null : filters.selectedCardFilter,
  });
}
