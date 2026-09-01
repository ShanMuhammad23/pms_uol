import { getSubmissionApplicableDurationFactor } from "@/app/helpers/dashboard-eligibility";
import type { FormSubmissionListItem } from "@/types/form-submissions";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Compensation worksheet formulas for Staff Listing:
 *
 * - Applicable Salary = Current Salary × Applicable Duration
 * - Increment Per Matrix = Applicable Salary × (App. Incr % / 100)
 * - Increment Adjustment = Increment Per Matrix (HR may override)
 * - Revised Salary = Current Salary + Increment Adjustment
 * - Revised Salary (RO) = Revised Salary (HR may override)
 */

export function getApplicableSalary(
  row: FormSubmissionListItem,
): number | null {
  if (row.currentSalary == null || !Number.isFinite(row.currentSalary)) {
    return null;
  }
  const duration = getSubmissionApplicableDurationFactor(row);
  if (!Number.isFinite(duration)) return null;
  return roundMoney(row.currentSalary * duration);
}

export function getIncrementPerMatrix(
  row: FormSubmissionListItem,
): number | null {
  const applicable = getApplicableSalary(row);
  const pct = row.applicableIncrementPercent;
  if (applicable == null || pct == null || !Number.isFinite(pct)) {
    return row.incrementPerMatrix;
  }
  return roundMoney(applicable * (pct / 100));
}

export function getIncrementAdjusted(
  row: FormSubmissionListItem,
): number | null {
  if (row.incrementAdjusted != null && Number.isFinite(row.incrementAdjusted)) {
    return row.incrementAdjusted;
  }
  return getIncrementPerMatrix(row);
}

export function getRevisedSalary(row: FormSubmissionListItem): number | null {
  if (row.currentSalary == null || !Number.isFinite(row.currentSalary)) {
    return null;
  }
  const adjustment = getIncrementAdjusted(row);
  if (adjustment == null) return null;
  return roundMoney(row.currentSalary + adjustment);
}

export function getRevisedSalaryRo(
  row: FormSubmissionListItem,
): number | null {
  if (row.revisedSalaryRo != null && Number.isFinite(row.revisedSalaryRo)) {
    return row.revisedSalaryRo;
  }
  return getRevisedSalary(row);
}

/** Fill derived (non-overridable) compensation fields for listing / export. */
export function applyCompensationWorksheet(
  row: FormSubmissionListItem,
): FormSubmissionListItem {
  return {
    ...row,
    applicableSalaryForIncrement: getApplicableSalary(row),
    incrementPerMatrix: getIncrementPerMatrix(row),
    revisedSalary: getRevisedSalary(row),
  };
}
