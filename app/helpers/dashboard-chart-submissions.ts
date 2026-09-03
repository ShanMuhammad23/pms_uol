import type { FormSubmissionListItem } from "@/types/form-submissions";
import {
  getNormalizedScorePercent,
  getScorePercentByType,
  type MatrixScoreType,
} from "@/lib/performance-rating";
import {
  isHrAlignmentAligned,
  isSubmissionEligible,
} from "@/app/helpers/dashboard-workflow-stats";

/** Employee has started/submitted an appraisal (exclude bare staff rows). */
export function hasAppraisalProgress(
  submission: FormSubmissionListItem,
): boolean {
  return submission.id > 0 && submission.status !== "PENDING_SELF_ASSESSMENT";
}

export function filterSubmissionsForCharts(
  submissions: FormSubmissionListItem[],
): FormSubmissionListItem[] {
  return submissions.filter(hasAppraisalProgress);
}

function hasValidNormalizedScoreForCharts(
  submission: FormSubmissionListItem,
): boolean {
  const pct = getNormalizedScorePercent(submission);
  return pct !== null && pct > 0;
}

/**
 * Rows that may populate the Performance Rating Curve (Actual) and the
 * Rating × Quartile Matrix when Score (N) is selected. Requires:
 * - appraisal progress + eligibility
 * - HR alignment completed (past PENDING_HR_CALIBRATION)
 * - a valid normalized score (persisted Norm. Score or derived %)
 */
export function contributesToPerformanceDistribution(
  submission: FormSubmissionListItem,
): boolean {
  return (
    hasAppraisalProgress(submission) &&
    isSubmissionEligible(submission) &&
    isHrAlignmentAligned(submission) &&
    hasValidNormalizedScoreForCharts(submission)
  );
}

/**
 * Generalized contribution check for the Rating × Quartile Matrix dropdown.
 * For `normalized` (default): requires HR alignment + valid normalized score.
 * For `scoreO` / `adjusted`: only requires appraisal progress + eligibility +
 * a valid score of the selected type (no HR alignment needed).
 */
export function contributesToMatrixByScoreType(
  submission: FormSubmissionListItem,
  scoreType: MatrixScoreType,
): boolean {
  if (!hasAppraisalProgress(submission) || !isSubmissionEligible(submission)) {
    return false;
  }
  if (scoreType === "normalized") {
    return isHrAlignmentAligned(submission) && hasValidNormalizedScoreForCharts(submission);
  }
  const pct = getScorePercentByType(submission, scoreType);
  return pct !== null && pct > 0;
}
