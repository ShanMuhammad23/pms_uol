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

/** Self Assessment "Submitted" — past self assessment stage. */
export function isSelfAssessmentSubmitted(
  submission: FormSubmissionListItem,
): boolean {
  return SUBMITTED_SELF_ASSESSMENT_STATES.includes(submission.status);
}

/** Manager 1 "Submitted" — reached Manager 1 review stage. */
export function isManager1Submitted(
  submission: FormSubmissionListItem,
): boolean {
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

  const submitted = countByStatuses(submissions, SUBMITTED_SELF_ASSESSMENT_STATES);

  return toWorkflowStageStats(eligible, submitted);
}

export type ManagerReviewDualStats = {
  manager1: WorkflowStageStats;
  manager2: WorkflowStageStats;
};

function buildManagerReviewStatsForLevel(
  submissions: FormSubmissionListItem[],
  level: 1 | 2,
): WorkflowStageStats {
  const pendingAtLevel = submissions.filter(
    (submission) =>
      submission.status === "PENDING_HEAD_REVIEW" &&
      (submission.managerLevel ?? 1) === level,
  ).length;

  const completed = submissions.filter((submission) => {
    const managerLevel = submission.managerLevel ?? 1;

    if (level === 1) {
      return (
        (submission.status === "PENDING_HEAD_REVIEW" && managerLevel > 1) ||
        SUBMITTED_FOR_HR_STATES.includes(submission.status)
      );
    }

    return SUBMITTED_FOR_HR_STATES.includes(submission.status);
  }).length;

  // Submitted = still pending at this level + already reviewed (all that reached this stage).
  const submitted = pendingAtLevel + completed;
  return {
    awaiting: submitted,
    completed,
    percentageLabel: formatWorkflowPercentage(completed, submitted),
  };
}

/**
 * Manager 1 / Manager 2 stats are scoped by appraisals.manager_level.
 * Submitted = pending at level + already reviewed; % = reviewed / submitted.
 * Manager 2 pool only includes submissions that require a second review.
 */
export function buildManagerReviewStats(
  submissions: FormSubmissionListItem[],
): ManagerReviewDualStats {
  const manager2Pool = submissions.filter((submission) =>
    submissionRequiresSecondManagerReview(submission),
  );

  return {
    manager1: buildManagerReviewStatsForLevel(submissions, 1),
    manager2: buildManagerReviewStatsForLevel(manager2Pool, 2),
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
