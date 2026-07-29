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

  // Fallback only when appraisal row has no stored FY eligibility yet.
  const computed = computeAppraisalEligibility(submission.dateOfJoining, {
    financialYear: submission.eligibilityReferenceYear ?? undefined,
  });

  return computed.status;
}

/** Short labels for the staff listing Eligible? column. */
export function getEligibilityShortLabel(
  status: EligibilityStatus,
): "Full" | "Partial" | "No" | "N/A" {
  if (status === "Fully Eligible") return "Full";
  if (status === "Partially Eligible") return "Partial";
  if (status === "Ineligible") return "N/A";
  return "No";
}

/**
 * Returns the eligibility status used for display in the consolidated
 * Eligible? column. When an employee has been manually marked as
 * ineligible (assessmentEligibility === false), the status is "Ineligible"
 * regardless of the duration-based calculation.
 */
export function getSubmissionEligibilityDisplayStatus(
  submission: FormSubmissionListItem,
): EligibilityStatus {
  if (!submission.assessmentEligibility) return "Ineligible";
  return getSubmissionEligibilityStatus(submission);
}

export function getSubmissionApplicableDurationFactor(
  submission: FormSubmissionListItem,
): number {
  if (
    submission.applicableDurationFactor !== null &&
    submission.applicableDurationFactor !== undefined
  ) {
    return Math.round(submission.applicableDurationFactor * 10) / 10;
  }

  const computed = computeAppraisalEligibility(submission.dateOfJoining, {
    financialYear: submission.eligibilityReferenceYear ?? undefined,
  });

  return computed.applicableDurationFactor;
}

export function buildEligibilityData(
  submissions: FormSubmissionListItem[],
  isDarkMode: boolean,
) {
  const counts: Record<EligibilityStatus, number> = {
    "Fully Eligible": 0,
    "Partially Eligible": 0,
    "Not Eligible": 0,
    Ineligible: 0,
  };

  submissions.forEach((submission) => {
    counts[getSubmissionEligibilityDisplayStatus(submission)] += 1;
  });

  return (Object.keys(counts) as EligibilityStatus[]).map((name) => ({
    name,
    value: counts[name],
    color: isDarkMode ? ELIGIBILITY_CONFIG[name].dark : ELIGIBILITY_CONFIG[name].light,
  }));
}
