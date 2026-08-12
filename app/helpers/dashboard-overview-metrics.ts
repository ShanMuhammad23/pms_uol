import { ELIGIBILITY_CONFIG } from "@/app/helpers/dashboard-chart-config";
import type { EligibilityStatus } from "@/app/helpers/dashboard-types";
import type { RatingQuartileMatrixData } from "@/app/helpers/dashboard-types";
import { getEligibilityDisplayLabel } from "@/app/helpers/dashboard-eligibility";
import {
  getMatrixQuartileColumnHeaders,
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
 * - Actual: counts from ratingDistribution (HR-approved alignments only)
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
    count: number;
  }>,
  matrix: PerformanceLevelWithQuartiles[],
): RatingQuartileMatrixData {
  const sortedMatrix = sortPerformanceMatrix(matrix);
  const columns = getMatrixQuartileColumnHeaders(sortedMatrix);

  const counts = new Map(
    ratingQuartileCounts.map(
      (row) =>
        [`${row.performanceLevelId}-${row.quartileId}`, row.count] as const,
    ),
  );

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

      return {
        id: quartile.id,
        label: quartile.name,
        sortOrder: quartile.sortOrder,
        sublabel: quartile.name,
        count: counts.get(`${level.id}-${quartile.id}`) ?? 0,
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
