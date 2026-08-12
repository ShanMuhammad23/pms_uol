import type { FormSubmissionListItem } from "@/types/form-submissions";
import { filterSubmissionsForCharts } from "@/app/helpers/dashboard-chart-submissions";
import { getHrApprovalStatus } from "@/app/helpers/dashboard-table-columns";
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

/**
 * Performance level used for the Rating Curve Actual series — same source as
 * the Rating × Quartile Matrix (resolved HR-aligned performance level).
 */
export function getSubmissionDisplayRating(
  submission: FormSubmissionListItem,
): string {
  return submission.performanceLevelName ?? "—";
}

/**
 * @param submissions Filtered submissions — drives Actual Distribution.
 * @param quotas Chart quota series from DB (`/api/institutional-quotas`).
 * @param quotaEligibleCount Eligible headcount used to scale Institutional Quota
 *               targets. Should ignore workflow/form-state filters (stats cards)
 *               so quota counts stay stable when those filters change.
 *
 * Quota = institutional % × eligible employee count.
 * Actual = eligible employees with approved HR alignment, by performance level.
 */
export function buildCalibrationData(
  submissions: FormSubmissionListItem[],
  quotas?: Array<{ rating: string; quota: number }> | null,
  quotaEligibleCount?: number,
) {
  if (!quotas || quotas.length === 0) {
    return [];
  }

  const chartSubmissions = filterSubmissionsForCharts(submissions).filter(
    (submission) =>
      isSubmissionEligible(submission) &&
      getHrApprovalStatus(submission) === "approved",
  );
  const quotaBaseCount =
    quotaEligibleCount ?? countEligibleSubmissions(submissions);
  const counts = new Map(quotas.map((row) => [row.rating, 0]));

  chartSubmissions.forEach((submission) => {
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
