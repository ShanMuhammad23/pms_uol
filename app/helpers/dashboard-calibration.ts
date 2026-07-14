import { INSTITUTIONAL_QUOTA } from "@/app/helpers/dashboard-chart-config";
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

export function buildCalibrationData(
  submissions: FormSubmissionListItem[],
  quotas: Array<{ rating: string; quota: number }> = INSTITUTIONAL_QUOTA,
) {
  const quotaRows = quotas.length > 0 ? quotas : INSTITUTIONAL_QUOTA;
  const total = submissions.length;
  const counts = new Map(quotaRows.map((row) => [row.rating, 0]));

  submissions.forEach((submission) => {
    const bucket = normalizeRating(getSubmissionDisplayRating(submission));
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  });

  return quotaRows.map((row) => ({
    rating: row.rating,
    quota: row.quota,
    actual: total === 0 ? 0 : Math.round(((counts.get(row.rating) ?? 0) / total) * 100),
  }));
}
