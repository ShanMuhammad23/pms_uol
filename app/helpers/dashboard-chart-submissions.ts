import type { FormSubmissionListItem } from "@/types/form-submissions";

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
