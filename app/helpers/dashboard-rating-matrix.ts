import type { RatingQuartileMatrixData } from "@/app/helpers/dashboard-types";
import { filterSubmissionsForCharts } from "@/app/helpers/dashboard-chart-submissions";
import { isSubmissionEligible } from "@/app/helpers/dashboard-workflow-stats";
import {
  buildQuartileBandsFromMatrix,
  getMatrixQuartileColumnHeaders,
  sortPerformanceMatrix,
} from "@/lib/performance-matrix";
import {
  resolveSubmissionPerformanceQuartile,
} from "@/lib/performance-rating";
import { type PerformanceLevelWithQuartiles } from "@/types/performance-matrices";
import type { FormSubmissionListItem } from "@/types/form-submissions";

export function buildRatingQuartileMatrix(
  submissions: FormSubmissionListItem[],
  matrix: PerformanceLevelWithQuartiles[],
): RatingQuartileMatrixData {
  const sortedMatrix = sortPerformanceMatrix(matrix);
  const columns = getMatrixQuartileColumnHeaders(sortedMatrix);
  // Match the server-side aggregation: only count submissions that have
  // appraisal progress AND are eligible. Previously this only filtered by
  // hasAppraisalProgress, which caused the client-side matrix to count
  // ineligible employees and disagree with the server-side counts.
  const chartSubmissions = filterSubmissionsForCharts(submissions).filter(
    isSubmissionEligible,
  );
  const bands = buildQuartileBandsFromMatrix(sortedMatrix);
  const counts = new Map<string, number>();

  sortedMatrix.forEach((level) => {
    level.quartiles.forEach((quartile) => {
      counts.set(`${level.id}-${quartile.id}`, 0);
    });
  });

  chartSubmissions.forEach((submission) => {
    // Use the shared resolver which computes the normalized score %
    // from Score O + adjustments + calibration factor, then maps it
    // to the configured performance matrix bands.
    const resolved = resolveSubmissionPerformanceQuartile(submission, bands);

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

  return { rows, columns };
}
