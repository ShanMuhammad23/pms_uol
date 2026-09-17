import type { AppraisalStatus } from "@/types/forms";
import type { FormSubmissionListItem } from "@/types/form-submissions";

/**
 * Statuses that indicate the manager review stage has been completed (the
 * reporting manager has approved). Before these, the manager score is still a
 * draft and must NOT be shown as the official Score (O).
 */
const MANAGER_REVIEW_APPROVED_STATUSES: ReadonlySet<AppraisalStatus> = new Set([
  "PENDING_HR_CALIBRATION",
  "PENDING_BOARD_APPROVAL",
  "APPROVED",
  "COMPLETED",
]);

function isManagerReviewApproved(status: AppraisalStatus): boolean {
  return MANAGER_REVIEW_APPROVED_STATUSES.has(status);
}

/**
 * Resolve the official reporting-manager score for the Score (O) column.
 *
 * Decision flow:
 *  1. Direct score entry → the admin manually enters the official score into
 *     `initial_score_numeric` (no manager review). Return it as-is.
 *  2. Manager 2 assigned → return Manager 2's approved score once the manager
 *     review stage is complete; otherwise null (placeholder).
 *  3. Manager 2 not assigned → return Manager 1's approved score once the
 *     manager review stage is complete; otherwise null (placeholder).
 *
 * Self-assessment (`rawScore`) is NEVER used as the official Score (O).
 * Draft / unsaved manager values are excluded by gating on the appraisal
 * status having advanced past `PENDING_HEAD_REVIEW`.
 */
export function getReportingManagerScore(
  row: Pick<
    FormSubmissionListItem,
    | "directScoreEntry"
    | "scoreO"
    | "manager1Score"
    | "manager2Score"
    | "manager2UserId"
    | "status"
  >,
): number | null {
  // Direct score entry: the official score is entered manually by admin.
  if (row.directScoreEntry) {
    return row.scoreO;
  }

  // Only show a manager score once the manager review stage is approved.
  if (!isManagerReviewApproved(row.status)) {
    return null;
  }

  if (row.manager2UserId != null) {
    return row.manager2Score;
  }

  return row.manager1Score;
}

/**
 * Human-readable reason the official Score (O) is unavailable, or null when a
 * score exists. Used to surface a warning in the Adjusted Score cell — a bare
 * "—" hides whether the score is simply pending review or missing because the
 * review stage was bypassed / produced no marks.
 */
export function getMissingReportingScoreReason(
  row: Pick<
    FormSubmissionListItem,
    | "directScoreEntry"
    | "scoreO"
    | "manager1Score"
    | "manager2Score"
    | "manager2UserId"
    | "status"
    | "awaitingManagerAssignment"
  >,
): string | null {
  if (getReportingManagerScore(row) !== null) {
    return null;
  }

  if (row.directScoreEntry) {
    return "Score (O) missing — no direct score has been entered.";
  }

  if (row.awaitingManagerAssignment) {
    return "Score (O) missing — no manager is assigned for this review level. Assign a manager to enable the review.";
  }

  if (!isManagerReviewApproved(row.status)) {
    return "Score (O) not yet available — pending manager review.";
  }

  return "Score (O) missing — the manager review produced no score. Return the submission for review.";
}
