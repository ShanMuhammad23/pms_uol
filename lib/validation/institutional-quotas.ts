import {
  PERFORMANCE_RATINGS,
  type PerformanceRating,
} from "@/types/forms";
import type { UpsertInstitutionalQuotasInput } from "@/types/institutional-quotas";

export function validateUpsertInstitutionalQuotasInput(
  body: UpsertInstitutionalQuotasInput,
): string | null {
  if (
    typeof body.financialYearId !== "number" ||
    !Number.isInteger(body.financialYearId) ||
    body.financialYearId <= 0
  ) {
    return "A valid financial year is required.";
  }

  if (!Array.isArray(body.quotas) || body.quotas.length === 0) {
    return "At least one quota row is required.";
  }

  const seen = new Set<PerformanceRating>();

  for (const row of body.quotas) {
    if (!PERFORMANCE_RATINGS.includes(row.rating)) {
      return `Invalid rating: ${String(row.rating)}.`;
    }

    if (seen.has(row.rating)) {
      return `Duplicate rating: ${row.rating}.`;
    }
    seen.add(row.rating);

    if (
      typeof row.quotaPercent !== "number" ||
      Number.isNaN(row.quotaPercent) ||
      row.quotaPercent < 0 ||
      row.quotaPercent > 100
    ) {
      return `Quota for ${row.rating} must be a number between 0 and 100.`;
    }

    if (
      row.sortOrder !== undefined &&
      (typeof row.sortOrder !== "number" ||
        !Number.isInteger(row.sortOrder) ||
        row.sortOrder < 0)
    ) {
      return `Sort order for ${row.rating} must be a non-negative integer.`;
    }
  }

  return null;
}
