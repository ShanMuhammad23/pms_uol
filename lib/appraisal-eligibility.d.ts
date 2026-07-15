export type AppraisalEligibilityStatus =
  | "Fully Eligible"
  | "Partially Eligible"
  | "Not Eligible";

export type AppraisalEligibilityResult = {
  status: AppraisalEligibilityStatus;
  uolExperienceYears: number | null;
  isEligible: boolean;
  applicableDuration: string | null;
};

export type AppraisalCycleWindow = {
  cycleStart: Date;
  cycleEnd: Date;
};

export function parseIsoDate(value: string | Date | null | undefined): Date | null;

export function deriveUolFiscalYearWindow(referenceEndYear: number): AppraisalCycleWindow;

export function resolveReferenceEndDate(input?: {
  financialYear?: number | null;
  cycleEndDate?: string | Date | null;
}): Date;

export function formatApplicableDuration(start: Date, end: Date): string;

export function computeAppraisalEligibility(
  dateOfJoining: string | Date | null | undefined,
  options?: {
    referenceEndDate?: Date;
    financialYear?: number | null;
    cycleEndDate?: string | Date | null;
    minimumPartialMonths?: number;
  },
): AppraisalEligibilityResult;

export function toDashboardEligibilityStatus(
  result: AppraisalEligibilityResult,
): AppraisalEligibilityStatus;
