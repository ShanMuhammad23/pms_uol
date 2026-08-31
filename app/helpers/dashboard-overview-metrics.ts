import { ELIGIBILITY_CONFIG } from "@/app/helpers/dashboard-chart-config";
import type { EligibilityStatus } from "@/app/helpers/dashboard-types";
import type { RatingQuartileMatrixData } from "@/app/helpers/dashboard-types";
import { getEligibilityDisplayLabel } from "@/app/helpers/dashboard-eligibility";
import {
  getMatrixQuartileColumnHeaders,
  parseQuartileSequenceNumber,
  sortPerformanceMatrix,
} from "@/lib/performance-matrix";
import type { CountOption } from "@/types/dashboard-api";
import type { PerformanceLevelWithQuartiles } from "@/types/performance-matrices";

export function buildEligibilityDataFromCounts(
  counts: Record<EligibilityStatus, number>,
  isDarkMode: boolean,
) {
  return (Object.keys(counts) as EligibilityStatus[]).map((name) => ({
    name: getEligibilityDisplayLabel(name),
    value: counts[name],
    color: isDarkMode
      ? ELIGIBILITY_CONFIG[name].dark
      : ELIGIBILITY_CONFIG[name].light,
  }));
}

/**
 * Performance Rating Curve series:
 * - Quota: institutional % × eligible employee count
 * - Actual: counts from ratingDistribution (HR alignment completed + normalized score)
 */
export function buildCalibrationDataFromCounts(
  ratingDistribution: CountOption[],
  quotas?: Array<{ rating: string; quota: number }> | null,
  quotaEligibleCount = 0,
) {
  if (!quotas || quotas.length === 0) {
    return [];
  }

  const counts = new Map(
    ratingDistribution.map((row) => [row.value, row.count]),
  );

  return quotas.map((row) => ({
    rating: row.rating,
    quota: Math.round((quotaEligibleCount * row.quota) / 100),
    actual: counts.get(row.rating) ?? 0,
  }));
}

export function buildRatingQuartileMatrixFromCounts(
  ratingQuartileCounts: Array<{
    performanceLevelId: number;
    quartileId: number;
    performanceLevelName?: string;
    quartileName?: string;
    count: number;
  }>,
  matrix: PerformanceLevelWithQuartiles[],
): RatingQuartileMatrixData {
  const sortedMatrix = sortPerformanceMatrix(matrix);
  const columns = getMatrixQuartileColumnHeaders(sortedMatrix);

  const countsById = new Map(
    ratingQuartileCounts.map(
      (row) =>
        [`${row.performanceLevelId}-${row.quartileId}`, row.count] as const,
    ),
  );
  const countsByName = new Map<string, number>();
  const countsByQNumber = new Map<string, number>();
  for (const row of ratingQuartileCounts) {
    const levelName = row.performanceLevelName?.trim().toLowerCase();
    const quartileName = row.quartileName?.trim().toLowerCase();
    if (!levelName || !quartileName) continue;
    const nameKey = `${levelName}::${quartileName}`;
    countsByName.set(nameKey, (countsByName.get(nameKey) ?? 0) + row.count);
    const qNumber = parseQuartileSequenceNumber(row.quartileName);
    if (qNumber == null) continue;
    const qKey = `${levelName}::q:${qNumber}`;
    countsByQNumber.set(qKey, (countsByQNumber.get(qKey) ?? 0) + row.count);
  }

  const rows = sortedMatrix.map((level) => {
    const quartiles = columns.map((column) => {
      const quartile = level.quartiles[column.index];

      if (!quartile) {
        return {
          id: null,
          label: column.label,
          sortOrder: column.sortOrder,
          sublabel: "",
          count: null,
        };
      }

      const byId = countsById.get(`${level.id}-${quartile.id}`);
      const levelKey = level.name.trim().toLowerCase();
      const nameKey = `${levelKey}::${quartile.name.trim().toLowerCase()}`;
      const byName = countsByName.get(nameKey);
      const qNumber =
        parseQuartileSequenceNumber(quartile.name) ?? column.index + 1;
      const byQNumber = countsByQNumber.get(`${levelKey}::q:${qNumber}`);

      return {
        id: quartile.id,
        label: quartile.name,
        sortOrder: quartile.sortOrder,
        sublabel: quartile.name,
        // Prefer name matching so employees from every assigned matrix land
        // in the same collapsed performance-level row. Fall back to Q-number
        // (IN-Q4 ↔ Q4) when quartile labels differ across matrices.
        count:
          byName !== undefined
            ? byName
            : byQNumber !== undefined
              ? byQNumber
              : (byId ?? 0),
      };
    });

    return {
      levelId: level.id,
      rating: level.name,
      sortOrder: level.sortOrder,
      quartiles,
      rowTotal: quartiles.reduce((sum, cell) => sum + (cell.count ?? 0), 0),
    };
  });

  return { columns, rows };
}
