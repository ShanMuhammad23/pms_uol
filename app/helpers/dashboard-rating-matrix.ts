import type { RatingQuartileMatrixData } from "@/app/helpers/dashboard-types";
import {
  buildQuartileBandsFromMatrix,
  getMatrixQuartileColumnHeaders,
  sortPerformanceMatrix,
} from "@/lib/performance-matrix";
import { resolvePerformanceQuartile } from "@/lib/performance-rating";
import { formatPerformanceScore, type PerformanceLevelWithQuartiles } from "@/types/performance-matrices";
import type { FormSubmissionListItem } from "@/types/form-submissions";

export function buildRatingQuartileMatrix(
  submissions: FormSubmissionListItem[],
  matrix: PerformanceLevelWithQuartiles[],
): RatingQuartileMatrixData {
  const sortedMatrix = sortPerformanceMatrix(matrix);
  const columns = getMatrixQuartileColumnHeaders(sortedMatrix);
  const bands = buildQuartileBandsFromMatrix(sortedMatrix);
  const counts = new Map<string, number>();

  sortedMatrix.forEach((level) => {
    level.quartiles.forEach((quartile) => {
      counts.set(`${level.id}-${quartile.id}`, 0);
    });
  });

  submissions.forEach((submission) => {
    const resolved = resolvePerformanceQuartile(submission.scorePercent, bands);

    if (resolved) {
      const key = `${resolved.performanceLevelId}-${resolved.quartileId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  });

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
        sublabel: `${formatPerformanceScore(quartile.scoreMin)} – ${formatPerformanceScore(quartile.scoreMax)}`,
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

  return { rows, columns };
}
