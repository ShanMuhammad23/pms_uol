import "server-only";

import { db } from "@/lib/db";
import { getDbClient } from "@/lib/db-context";
import type { PerformanceQuartileBand } from "@/lib/performance-rating";

export type {
  PerformanceQuartileBand,
  ResolvedPerformanceQuartile,
} from "@/lib/performance-rating";

export {
  calculateScorePercent,
  getAdjustedScore,
  getNormalizedScore,
  getNormalizedScorePercent,
  resolvePerformanceQuartile,
  resolvePerformanceQuartileForRawScore,
  resolveSubmissionPerformanceQuartile,
  bandsForAssignedMatrix,
} from "@/lib/performance-rating";

export async function getActiveFinancialYearQuartileBands(): Promise<
  PerformanceQuartileBand[]
> {
  const byLabel = await getActiveFinancialYearQuartileBandsByMatrixLabel();
  return [...byLabel.values()].flat();
}

/**
 * Quartile bands for the active financial year, keyed by performance matrix
 * label. Used when resolving an employee's score against their assigned matrix.
 */
export async function getActiveFinancialYearQuartileBandsByMatrixLabel(): Promise<
  Map<string, PerformanceQuartileBand[]>
> {
  const result = await getDbClient().query<{
    matrix_label: string;
    performance_level_id: string;
    performance_level_name: string;
    level_sort_order: number;
    quartile_id: string;
    quartile_name: string;
    score_min: string;
    score_max: string;
    quartile_sort_order: number;
  }>(
    `SELECT
       pl.matrix_label,
       pl.id AS performance_level_id,
       pl.name AS performance_level_name,
       pl.sort_order AS level_sort_order,
       pq.id AS quartile_id,
       pq.name AS quartile_name,
       pq.score_min,
       pq.score_max,
       pq.sort_order AS quartile_sort_order
     FROM performance_quartiles pq
     INNER JOIN performance_levels pl ON pl.id = pq.performance_level_id
     INNER JOIN financial_years fy ON fy.id = pl.financial_year_id
     WHERE fy.is_active = TRUE
     ORDER BY pl.matrix_label ASC, pl.sort_order ASC, pq.sort_order ASC`,
  );

  const byLabel = new Map<string, PerformanceQuartileBand[]>();
  for (const row of result.rows) {
    const band: PerformanceQuartileBand = {
      performanceLevelId: Number(row.performance_level_id),
      performanceLevelName: row.performance_level_name,
      quartileId: Number(row.quartile_id),
      quartileName: row.quartile_name,
      scoreMin: Number(row.score_min),
      scoreMax: Number(row.score_max),
      levelSortOrder: row.level_sort_order,
      quartileSortOrder: row.quartile_sort_order,
    };
    const existing = byLabel.get(row.matrix_label) ?? [];
    existing.push(band);
    byLabel.set(row.matrix_label, existing);
  }
  return byLabel;
}

/**
 * Increment % lookup for the active FY.
 * Keys:
 * - `${incrementMatrixLabel}:${performanceQuartileId}`
 * - `${incrementMatrixLabel}:${levelName}:${quartileName}` (fallback)
 */
export async function getActiveIncrementPercentageLookup(): Promise<
  Map<string, number>
> {
  const result = await getDbClient().query<{
    matrix_label: string;
    performance_quartile_id: string;
    performance_level_name: string;
    performance_quartile_name: string;
    increment_percentage: string;
  }>(
    `SELECT
       sim.matrix_label,
       sim.performance_quartile_id,
       pl.name AS performance_level_name,
       pq.name AS performance_quartile_name,
       sim.increment_percentage
     FROM sub_category_increment_matrices sim
     INNER JOIN financial_years fy ON fy.id = sim.financial_year_id
     INNER JOIN performance_quartiles pq ON pq.id = sim.performance_quartile_id
     INNER JOIN performance_levels pl ON pl.id = pq.performance_level_id
     WHERE fy.is_active = TRUE`,
  );

  const lookup = new Map<string, number>();
  for (const row of result.rows) {
    const pct = Number(row.increment_percentage);
    lookup.set(
      `${row.matrix_label}:${Number(row.performance_quartile_id)}`,
      pct,
    );
    lookup.set(
      `${row.matrix_label}:${row.performance_level_name}:${row.performance_quartile_name}`,
      pct,
    );
  }
  return lookup;
}
