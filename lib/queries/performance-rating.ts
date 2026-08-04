import "server-only";

import { db } from "@/lib/db";
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
} from "@/lib/performance-rating";

export async function getActiveFinancialYearQuartileBands(): Promise<
  PerformanceQuartileBand[]
> {
  const result = await db.query<{
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
     ORDER BY pl.sort_order ASC, pq.sort_order ASC`,
  );

  return result.rows.map((row) => ({
    performanceLevelId: Number(row.performance_level_id),
    performanceLevelName: row.performance_level_name,
    quartileId: Number(row.quartile_id),
    quartileName: row.quartile_name,
    scoreMin: Number(row.score_min),
    scoreMax: Number(row.score_max),
    levelSortOrder: row.level_sort_order,
    quartileSortOrder: row.quartile_sort_order,
  }));
}
