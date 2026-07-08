import { ELIGIBILITY_CONFIG } from "@/app/helpers/dashboard-chart-config";
import type { EligibilityStatus } from "@/app/helpers/dashboard-types";
import type { FormSubmissionListItem } from "@/types/form-submissions";

export function getSubmissionEligibilityStatus(
  submission: FormSubmissionListItem,
): EligibilityStatus {
  if (
    submission.status === "PENDING_HR_CALIBRATION" ||
    submission.status === "PENDING_BOARD_APPROVAL" ||
    submission.status === "APPROVED" ||
    submission.status === "COMPLETED"
  ) {
    return "Fully Eligible";
  }

  if (
    submission.status === "PENDING_SELF_ASSESSMENT" ||
    submission.status === "PENDING_HEAD_REVIEW"
  ) {
    return "Partially Eligible";
  }

  return "Not Eligible";
}

export function buildEligibilityData(
  submissions: FormSubmissionListItem[],
  isDarkMode: boolean,
) {
  const counts: Record<EligibilityStatus, number> = {
    "Fully Eligible": 0,
    "Partially Eligible": 0,
    "Not Eligible": 0,
  };

  submissions.forEach((submission) => {
    counts[getSubmissionEligibilityStatus(submission)] += 1;
  });

  return (Object.keys(counts) as EligibilityStatus[]).map((name) => ({
    name,
    value: counts[name],
    color: isDarkMode ? ELIGIBILITY_CONFIG[name].dark : ELIGIBILITY_CONFIG[name].light,
  }));
}
