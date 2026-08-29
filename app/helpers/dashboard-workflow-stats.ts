import { getSubmissionEligibilityDisplayStatus } from "@/app/helpers/dashboard-eligibility";
import type { EligibilityStatus } from "@/app/helpers/dashboard-types";
import { submissionRequiresSecondManagerReview } from "@/app/helpers/manager-review";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { AppraisalStatus } from "@/types/forms";

export function isSubmissionEligible(
  submission: FormSubmissionListItem,
): boolean {
  const eligibility = getSubmissionEligibilityDisplayStatus(submission);
  return eligibility === "Fully Eligible" || eligibility === "Partially Eligible";
}

export function countEligibleSubmissions(
  submissions: FormSubmissionListItem[],
): number {
  return submissions.filter(isSubmissionEligible).length;
}

export type WorkflowStageStats = {
  awaiting: number;
  completed: number;
  percentageLabel: string;
};

const SUBMITTED_SELF_ASSESSMENT_STATES: AppraisalStatus[] = [
  "PENDING_HEAD_REVIEW",
  "PENDING_HR_CALIBRATION",
  "PENDING_BOARD_APPROVAL",
  "APPROVED",
  "COMPLETED",
];

const SUBMITTED_FOR_HR_STATES: AppraisalStatus[] = [
  "PENDING_HR_CALIBRATION",
  "PENDING_BOARD_APPROVAL",
  "APPROVED",
  "COMPLETED",
];

const HR_ALIGNMENT_COMPLETED_STATES: AppraisalStatus[] = [
  "PENDING_BOARD_APPROVAL",
  "APPROVED",
  "COMPLETED",
];

const BOARD_APPROVAL_PENDING_STATES: AppraisalStatus[] = [
  "PENDING_BOARD_APPROVAL",
];

const BOARD_APPROVAL_COMPLETED_STATES: AppraisalStatus[] = [
  "APPROVED",
  "COMPLETED",
];

// ---------------------------------------------------------------------------
// Card filter predicates — these are the SINGLE SOURCE OF TRUTH for both
// counting (in build*Stats functions) and filtering (in matchesCardFilter).
// Exporting them ensures the dashboard card counts and the staff listing
// filter results always use identical business rules.
// ---------------------------------------------------------------------------

/** Self Assessment "Eligible" — eligibility is Full or Partial. */
export function isSelfAssessmentEligible(
  submission: FormSubmissionListItem,
): boolean {
  return isSubmissionEligible(submission);
}

/**
 * Direct assessment employees skip the employee form and are created already
 * at PENDING_HEAD_REVIEW / manager_level 1. Until a manager completes review
 * they should stay in Self Assessment Eligible only — not Submitted, and not
 * Manager 1 Submitted. After review, status advances (manager_level > 1 or
 * HR/board states) and they count as Submitted on both cards.
 */
export function isDirectAssessmentAwaitingFirstManagerReview(
  submission: Pick<
    FormSubmissionListItem,
    "status" | "managerLevel" | "selfAssessmentEnabled"
  >,
): boolean {
  if (submission.selfAssessmentEnabled !== false) {
    return false;
  }

  if (submission.status !== "PENDING_HEAD_REVIEW") {
    return false;
  }

  return (submission.managerLevel ?? 1) === 1;
}

/** Self Assessment "Submitted" — past self assessment stage. */
export function isSelfAssessmentSubmitted(
  submission: FormSubmissionListItem,
): boolean {
  if (isDirectAssessmentAwaitingFirstManagerReview(submission)) {
    return false;
  }

  return SUBMITTED_SELF_ASSESSMENT_STATES.includes(submission.status);
}

/** Manager 1 "Submitted" — reached Manager 1 review stage. */
export function isManager1Submitted(
  submission: FormSubmissionListItem,
): boolean {
  if (isDirectAssessmentAwaitingFirstManagerReview(submission)) {
    return false;
  }

  return (
    submission.status === "PENDING_HEAD_REVIEW" ||
    SUBMITTED_FOR_HR_STATES.includes(submission.status)
  );
}

/** Manager 1 "Reviewed" — passed Manager 1 review. */
export function isManager1Reviewed(
  submission: FormSubmissionListItem,
): boolean {
  const managerLevel = submission.managerLevel ?? 1;
  return (
    (submission.status === "PENDING_HEAD_REVIEW" && managerLevel > 1) ||
    SUBMITTED_FOR_HR_STATES.includes(submission.status)
  );
}

/** Manager 2 "Submitted" — reached Manager 2 review stage (requires 2nd review). */
export function isManager2Submitted(
  submission: FormSubmissionListItem,
): boolean {
  if (!submissionRequiresSecondManagerReview(submission)) return false;
  const managerLevel = submission.managerLevel ?? 1;
  return (
    (submission.status === "PENDING_HEAD_REVIEW" && managerLevel >= 2) ||
    SUBMITTED_FOR_HR_STATES.includes(submission.status)
  );
}

/** Manager 2 "Reviewed" — passed Manager 2 review (requires 2nd review). */
export function isManager2Reviewed(
  submission: FormSubmissionListItem,
): boolean {
  if (!submissionRequiresSecondManagerReview(submission)) return false;
  return SUBMITTED_FOR_HR_STATES.includes(submission.status);
}

/** HR Alignment "Submitted" — sent to HR for calibration. */
export function isHrAlignmentSubmitted(
  submission: FormSubmissionListItem,
): boolean {
  return SUBMITTED_FOR_HR_STATES.includes(submission.status);
}

/** HR Alignment "Aligned" — HR calibration completed. */
export function isHrAlignmentAligned(
  submission: FormSubmissionListItem,
): boolean {
  return HR_ALIGNMENT_COMPLETED_STATES.includes(submission.status);
}

/** Board Approval "Pending" — awaiting board approval. */
export function isBoardApprovalPending(
  submission: FormSubmissionListItem,
): boolean {
  return BOARD_APPROVAL_PENDING_STATES.includes(submission.status);
}

/** Board Approval "Approved" — board approved. */
export function isBoardApprovalApproved(
  submission: FormSubmissionListItem,
): boolean {
  return BOARD_APPROVAL_COMPLETED_STATES.includes(submission.status);
}

/** Eligibility card — matches a specific eligibility display status. */
export function matchesEligibilityStatus(
  submission: FormSubmissionListItem,
  status: EligibilityStatus,
): boolean {
  return getSubmissionEligibilityDisplayStatus(submission) === status;
}

export function formatWorkflowPercentage(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";

  const value = (numerator / denominator) * 100;
  if (!Number.isFinite(value)) return "—";

  return `${Math.round(value)}%`;
}

function countByStatuses(
  submissions: FormSubmissionListItem[],
  statuses: AppraisalStatus[],
): number {
  return submissions.filter((submission) => statuses.includes(submission.status)).length;
}

function toWorkflowStageStats(awaiting: number, completed: number): WorkflowStageStats {
  return {
    awaiting,
    completed,
    percentageLabel: formatWorkflowPercentage(completed, awaiting),
  };
}

/** Eligible = Fully + Partially eligible; Submitted = past self assessment. */
export function buildSelfAssessmentStats(
  submissions: FormSubmissionListItem[],
): WorkflowStageStats {
  const eligible = countEligibleSubmissions(submissions);
  const submitted = submissions.filter(isSelfAssessmentSubmitted).length;

  return toWorkflowStageStats(eligible, submitted);
}

export type ManagerReviewDualStats = {
  manager1: WorkflowStageStats;
  manager2: WorkflowStageStats;
};

/**
 * Manager 1 / Manager 2 stats use the same predicates as the card filters.
 * Submitted = reached this stage; Reviewed = passed it; % = reviewed / submitted.
 * Direct assessment employees awaiting first manager review are excluded from
 * Manager 1 Submitted until a manager completes review.
 */
export function buildManagerReviewStats(
  submissions: FormSubmissionListItem[],
): ManagerReviewDualStats {
  return {
    manager1: toWorkflowStageStats(
      submissions.filter(isManager1Submitted).length,
      submissions.filter(isManager1Reviewed).length,
    ),
    manager2: toWorkflowStageStats(
      submissions.filter(isManager2Submitted).length,
      submissions.filter(isManager2Reviewed).length,
    ),
  };
}

/** Awaiting Alignment = sent to HR; Submitted = past HR calibration. */
export function buildHrAlignmentStats(
  submissions: FormSubmissionListItem[],
): WorkflowStageStats {
  const awaitingAlignment = countByStatuses(submissions, SUBMITTED_FOR_HR_STATES);
  const submitted = countByStatuses(submissions, HR_ALIGNMENT_COMPLETED_STATES);

  return toWorkflowStageStats(awaitingAlignment, submitted);
}

/** Pending = awaiting board approval; Approved = board approved. */
export function buildBoardApprovalStats(
  submissions: FormSubmissionListItem[],
): WorkflowStageStats {
  const pending = countByStatuses(submissions, BOARD_APPROVAL_PENDING_STATES);
  const approved = countByStatuses(submissions, BOARD_APPROVAL_COMPLETED_STATES);

  return {
    awaiting: pending,
    completed: approved,
    percentageLabel: formatWorkflowPercentage(approved, pending + approved),
  };
}
