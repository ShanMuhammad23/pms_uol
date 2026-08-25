import type { FormSubmissionListItem } from "@/types/form-submissions";

/**
 * Strip staff-listing fields that HEAD must not receive (compensation, etc.).
 * Keeps score adjustment inputs so Adjusted Score can still be computed client-side.
 */
export function toHeadStaffListingItem(
  item: FormSubmissionListItem,
): FormSubmissionListItem {
  return {
    ...item,
    ratingO: null,
    ratingN: null,
    initialRating: null,
    calibratedRating: null,
    calibrationFactor: null,
    normalizedScore: null,
    performanceLevelName: null,
    quartileName: null,
    remarksEvaluation: null,
    currentSalary: null,
    previousSalary: null,
    applicableSalaryForIncrement: null,
    assignedPerformanceMatrix: null,
    applicableMatrix: null,
    applicableIncrementPercent: null,
    incrementPerMatrix: null,
    incrementAdjusted: null,
    revisedSalary: null,
    revisedSalaryRo: null,
    remarksCompensation: null,
    hodReviewComments: null,
  };
}
