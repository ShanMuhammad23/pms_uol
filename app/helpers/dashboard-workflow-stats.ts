import { getSubmissionEligibilityStatus } from "@/app/helpers/dashboard-eligibility";
import { submissionRequiresSecondManagerReview } from "@/app/helpers/manager-review";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { AppraisalStatus } from "@/types/forms";

export function isSubmissionEligible(
  submission: FormSubmissionListItem,
): boolean {
  const eligibility = getSubmissionEligibilityStatus(submission);
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
  const awaiting = submissions.filter(
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

  return toWorkflowStageStats(awaiting, completed);
}

/**
 * Manager 1 / Manager 2 stats are scoped by appraisals.manager_level.
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
