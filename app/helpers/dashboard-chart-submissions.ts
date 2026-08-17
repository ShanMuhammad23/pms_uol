import type { FormSubmissionListItem } from "@/types/form-submissions";
import { getNormalizedScorePercent } from "@/lib/performance-rating";
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
 * Rating × Quartile Matrix. Requires:
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
