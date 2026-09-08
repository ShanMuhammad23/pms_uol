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

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Calendar days in a standard year — used for UOL experience and applicable duration. */
const DAYS_PER_YEAR = 365;
/** Minimum completed months by FY end for partial eligibility. */
const DEFAULT_MINIMUM_PARTIAL_MONTHS = 3;
/** Inclusive days DOJ→FY-end required for full eligibility (days / 365 ≥ 1). */
const DEFAULT_FULL_ELIGIBILITY_DAYS = DAYS_PER_YEAR;

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
 * Inclusive calendar days from start through end (both dates count).
 * @param {Date} start
 * @param {Date} end
 */
function daysBetweenInclusive(start, end) {
  if (end < start) {
    return 0;
  }

  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

  return Math.floor((endUtc - startUtc) / MS_PER_DAY) + 1;
}

/**
 * Tenure vs financial-year end (FY ends 30 Jun by default):
 * - inclusive days DOJ→FY-end / 365 >= 1 (≥ 365 days) → Fully Eligible
 * - DOJ after ineligibility date (default 1 Apr of FY end year) → Not Eligible
 * - >= 3 months and < 365 days (and on/before ineligibility date) → Partially Eligible
 * - < 3 months → Not Eligible
 *
 * @param {string | Date | null | undefined} dateOfJoining
 * @param {{
 *   referenceEndDate?: Date;
 *   financialYear?: number | null;
 *   cycleEndDate?: string | Date | null;
 *   cycleStartDate?: string | Date | null;
 *   ineligibilityDate?: string | Date | null;
 *   minimumPartialMonths?: number;
 *   fullEligibilityDays?: number;
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
  const fullEligibilityDays =
    options.fullEligibilityDays ?? DEFAULT_FULL_ELIGIBILITY_DAYS;
  const doj = parseIsoDate(dateOfJoining);
  const referenceEndYear = referenceEndDate.getFullYear();
  const defaults = deriveUolFiscalYearWindow(referenceEndYear);
  const cycleStart =
    parseIsoDate(options.cycleStartDate ?? null) ?? defaults.cycleStart;
  const cycleEnd =
    parseIsoDate(options.cycleEndDate ?? null) ?? defaults.cycleEnd;
  // Joining after the configured ineligibility date is too late for that cycle.
  const ineligibilityCutoff =
    parseIsoDate(options.ineligibilityDate ?? null) ??
    new Date(referenceEndYear, 3, 1);

  if (!doj) {
    return {
      status: "Not Eligible",
      uolExperienceYears: null,
      isEligible: false,
      applicableDuration: null,
      applicableDurationFactor: 0,
    };
  }

  if (doj > referenceEndDate) {
    return {
      status: "Not Eligible",
      uolExperienceYears: 0,
      isEligible: false,
      applicableDuration: null,
      applicableDurationFactor: 0,
    };
  }

  // Inclusive of FY end (30 Jun): both DOJ and reference end date count.
  const experienceDays = daysBetweenInclusive(doj, referenceEndDate);
  const uolExperienceYears =
    Math.round((experienceDays / DAYS_PER_YEAR) * 100) / 100;

  const applicableDays = daysBetweenInclusive(doj, cycleEnd);
  const applicableMonths = monthsBetweenInclusive(doj, cycleEnd);

  if (applicableDays >= fullEligibilityDays) {
    return {
      status: "Fully Eligible",
      uolExperienceYears,
      isEligible: true,
      applicableDuration: formatApplicableDuration(cycleStart, cycleEnd),
      applicableDurationFactor: 1,
    };
  }

  // Business rule: joining after the ineligibility date → Not Eligible.
  if (doj > ineligibilityCutoff || applicableMonths < minimumPartialMonths) {
    return {
      status: "Not Eligible",
      uolExperienceYears,
      isEligible: false,
      applicableDuration: null,
      applicableDurationFactor: 0,
    };
  }

  const applicableDurationFactor = Math.min(1, applicableDays / DAYS_PER_YEAR);

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
