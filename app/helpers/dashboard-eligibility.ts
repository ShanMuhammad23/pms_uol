import {
  computeAppraisalEligibility,
  type AppraisalEligibilityStatus,
} from "@/lib/appraisal-eligibility";
import { ELIGIBILITY_CONFIG } from "@/app/helpers/dashboard-chart-config";
import type { EligibilityStatus } from "@/app/helpers/dashboard-types";
import type { FormSubmissionListItem } from "@/types/form-submissions";

export type { AppraisalEligibilityStatus };

export function getSubmissionEligibilityStatus(
  submission: FormSubmissionListItem,
): EligibilityStatus {
  if (submission.eligibilityStatus) {
    return submission.eligibilityStatus;
  }

  const computed = computeAppraisalEligibility(submission.dateOfJoining, {
    financialYear: submission.eligibilityReferenceYear ?? undefined,
    cycleEndDate: submission.eligibilityReferenceEndDate ?? undefined,
  });

  return computed.status;
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
