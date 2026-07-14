import { getSubmissionEligibilityStatus } from "@/app/helpers/dashboard-eligibility";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { AppraisalStatus } from "@/types/forms";

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
  const eligible = submissions.filter((submission) => {
    const eligibility = getSubmissionEligibilityStatus(submission);
    return eligibility === "Fully Eligible" || eligibility === "Partially Eligible";
  }).length;

  const submitted = countByStatuses(submissions, SUBMITTED_SELF_ASSESSMENT_STATES);

  return toWorkflowStageStats(eligible, submitted);
}

/** Awaiting Review = SA submitted to manager; Submitted = forwarded to HR. */
export function buildManagerReviewStats(
  submissions: FormSubmissionListItem[],
): WorkflowStageStats {
  const awaitingReview = countByStatuses(submissions, SUBMITTED_SELF_ASSESSMENT_STATES);
  const submittedForHr = countByStatuses(submissions, SUBMITTED_FOR_HR_STATES);

  return toWorkflowStageStats(awaitingReview, submittedForHr);
}

/** Awaiting Alignment = sent to HR; Submitted = past HR calibration. */
export function buildHrAlignmentStats(
  submissions: FormSubmissionListItem[],
): WorkflowStageStats {
  const awaitingAlignment = countByStatuses(submissions, SUBMITTED_FOR_HR_STATES);
  const submitted = countByStatuses(submissions, HR_ALIGNMENT_COMPLETED_STATES);

  return toWorkflowStageStats(awaitingAlignment, submitted);
}
