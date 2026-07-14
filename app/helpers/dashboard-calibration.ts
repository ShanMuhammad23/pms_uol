import type { FormSubmissionListItem } from "@/types/form-submissions";
import { RATING_LABELS } from "@/types/forms";

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
 * @param quotas Chart quota series from DB (`/api/institutional-quotas`).
 *               When omitted/undefined (still loading), returns empty series.
 */
export function buildCalibrationData(
  submissions: FormSubmissionListItem[],
  quotas?: Array<{ rating: string; quota: number }> | null,
) {
  if (!quotas || quotas.length === 0) {
    return [];
  }

  const total = submissions.length;
  const counts = new Map(quotas.map((row) => [row.rating, 0]));

  submissions.forEach((submission) => {
    const bucket = normalizeRating(getSubmissionDisplayRating(submission));
    if (counts.has(bucket)) {
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
  });

  return quotas.map((row) => ({
    rating: row.rating,
    quota: row.quota,
    actual: total === 0 ? 0 : Math.round(((counts.get(row.rating) ?? 0) / total) * 100),
  }));
}
