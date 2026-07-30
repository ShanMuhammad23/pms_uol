/** @typedef {"Fully Eligible" | "Partially Eligible" | "Not Eligible"} AppraisalEligibilityStatus */

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
/** Minimum completed months by FY end for partial eligibility. */
const DEFAULT_MINIMUM_PARTIAL_MONTHS = 3;
/** Completed months by FY end required for full eligibility. */
const DEFAULT_FULL_ELIGIBILITY_MONTHS = 12;

/**
 * @param {string | Date | null | undefined} value
 * @returns {Date | null}
 */
export function parseIsoDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const parsed = new Date(year, month, day);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * UoL fiscal year runs 1 Jul – 30 Jun. The stored financial year (e.g. 2026)
 * represents the June end date of FY 2025-2026.
 *
 * @param {number} referenceEndYear
 */
export function deriveUolFiscalYearWindow(referenceEndYear) {
  return {
    cycleStart: new Date(referenceEndYear - 1, 6, 1),
    cycleEnd: new Date(referenceEndYear, 5, 30),
  };
}

/**
 * Eligibility is tied to financial year only (FY ends 30 Jun of that year).
 *
 * @param {{
 *   financialYear?: number | null;
 *   cycleEndDate?: string | Date | null;
 * } | undefined} input
 */
export function resolveReferenceEndDate(input) {
  if (input?.financialYear) {
    return new Date(input.financialYear, 5, 30);
  }

  const cycleEnd = parseIsoDate(input?.cycleEndDate ?? null);

  if (cycleEnd) {
    return cycleEnd;
  }

  const today = new Date();
  const currentMonth = today.getMonth();
  const endYear = currentMonth >= 6 ? today.getFullYear() + 1 : today.getFullYear();

  return new Date(endYear, 5, 30);
}

/**
 * @param {Date} start
 * @param {Date} end
 */
export function formatApplicableDuration(start, end) {
  const format = (date) =>
    `${String(date.getDate()).padStart(2, "0")} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;

  return `${format(start)} - ${format(end)}`;
}

/**
 * @param {Date} start
 * @param {Date} end
 */
function monthsBetweenInclusive(start, end) {
  if (end < start) {
    return 0;
  }

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  if (end.getDate() >= start.getDate()) {
    months += 1;
  }

  return Math.max(0, months);
}

/**
 * Tenure vs financial-year end:
 * - >= 12 months → Fully Eligible
 * - >= 3 and < 12 months → Partially Eligible
 * - < 3 months → Not Eligible
 *
 * @param {string | Date | null | undefined} dateOfJoining
 * @param {{
 *   referenceEndDate?: Date;
 *   financialYear?: number | null;
 *   cycleEndDate?: string | Date | null;
 *   minimumPartialMonths?: number;
 *   fullEligibilityMonths?: number;
 * } | undefined} options
 */
export function computeAppraisalEligibility(dateOfJoining, options = {}) {
  const referenceEndDate =
    options.referenceEndDate ??
    resolveReferenceEndDate({
      financialYear: options.financialYear ?? null,
      cycleEndDate: options.cycleEndDate ?? null,
    });
  const minimumPartialMonths =
    options.minimumPartialMonths ?? DEFAULT_MINIMUM_PARTIAL_MONTHS;
  const fullEligibilityMonths =
    options.fullEligibilityMonths ?? DEFAULT_FULL_ELIGIBILITY_MONTHS;
  const doj = parseIsoDate(dateOfJoining);
  const { cycleStart, cycleEnd } = deriveUolFiscalYearWindow(
    referenceEndDate.getFullYear(),
  );

  if (!doj) {
    return {
      status: "Not Eligible",
      uolExperienceYears: null,
      isEligible: false,
      applicableDuration: null,
      applicableDurationFactor: 0,
    };
  }

  const experienceMs = referenceEndDate.getTime() - doj.getTime();
  const uolExperienceYears =
    experienceMs < 0
      ? 0
      : Math.round((experienceMs / MS_PER_YEAR) * 100) / 100;

  if (doj > referenceEndDate) {
    return {
      status: "Not Eligible",
      uolExperienceYears,
      isEligible: false,
      applicableDuration: null,
      applicableDurationFactor: 0,
    };
  }

  const applicableMonths = monthsBetweenInclusive(doj, cycleEnd);

  if (applicableMonths >= fullEligibilityMonths) {
    return {
      status: "Fully Eligible",
      uolExperienceYears,
      isEligible: true,
      applicableDuration: formatApplicableDuration(cycleStart, cycleEnd),
      applicableDurationFactor: 1,
    };
  }

  if (applicableMonths < minimumPartialMonths) {
    return {
      status: "Not Eligible",
      uolExperienceYears,
      isEligible: false,
      applicableDuration: null,
      applicableDurationFactor: 0,
    };
  }

  const applicableDurationFactor =
    Math.round(Math.min(1, applicableMonths / 12) * 10) / 10;

  return {
    status: "Partially Eligible",
    uolExperienceYears,
    isEligible: true,
    applicableDuration: formatApplicableDuration(doj, cycleEnd),
    applicableDurationFactor,
  };
}

/** @param {import("./appraisal-eligibility.js").AppraisalEligibilityResult} result */
export function toDashboardEligibilityStatus(result) {
  return result.status;
}
