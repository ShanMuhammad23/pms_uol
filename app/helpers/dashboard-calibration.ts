import type { FormSubmissionListItem } from "@/types/form-submissions";
import { RATING_LABELS } from "@/types/forms";
import { filterSubmissionsForCharts } from "@/app/helpers/dashboard-chart-submissions";
import {
  countEligibleSubmissions,
  isSubmissionEligible,
} from "@/app/helpers/dashboard-workflow-stats";

const RATING_NORMALIZE: Record<string, string> = {
  Unsatisfactory: "Unsatisfactory",
  "Improvement Needed": "Improvement Needed",
  Satisfactory: "Improvement Needed",
  Good: "Strong",
  Strong: "Strong",
  Excellent: "Excellent",
  Outstanding: "Outstanding",
};

export function normalizeRating(rating: string): string {
  return RATING_NORMALIZE[rating] ?? "Strong";
}

export function getSubmissionDisplayRating(submission: FormSubmissionListItem): string {
  if (submission.calibratedRating) {
    return RATING_LABELS[submission.calibratedRating];
  }

  if (submission.initialRating) {
    return RATING_LABELS[submission.initialRating];
  }

  return submission.performanceLevelName ?? "—";
}

/**
 * @param submissions Filtered submissions — drives Actual Distribution.
 * @param quotas Chart quota series from DB (`/api/institutional-quotas`).
 * @param quotaEligibleCount Eligible headcount used to scale Institutional Quota
 *               targets. Should ignore workflow/form-state filters (stats cards)
 *               so quota counts stay stable when those filters change.
 */
export function buildCalibrationData(
  submissions: FormSubmissionListItem[],
  quotas?: Array<{ rating: string; quota: number }> | null,
  quotaEligibleCount?: number,
) {
  if (!quotas || quotas.length === 0) {
    return [];
  }

  const chartSubmissions = filterSubmissionsForCharts(submissions);
  const eligibleSubmissions = chartSubmissions.filter(isSubmissionEligible);
  const quotaBaseCount =
    quotaEligibleCount ?? countEligibleSubmissions(submissions);
  const counts = new Map(quotas.map((row) => [row.rating, 0]));

  eligibleSubmissions.forEach((submission) => {
    const displayRating = getSubmissionDisplayRating(submission);

    if (displayRating === "—") {
      return;
    }

    const bucket = normalizeRating(displayRating);

    if (counts.has(bucket)) {
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
  });

  return quotas.map((row) => ({
    rating: row.rating,
    quota: Math.round((quotaBaseCount * row.quota) / 100),
    actual: counts.get(row.rating) ?? 0,
  }));
}
