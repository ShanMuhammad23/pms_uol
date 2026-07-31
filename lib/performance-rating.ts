import type { FormSubmissionListItem } from "@/types/form-submissions";

export interface PerformanceQuartileBand {
  performanceLevelId: number;
  performanceLevelName: string;
  quartileId: number;
  quartileName: string;
  scoreMin: number;
  scoreMax: number;
  levelSortOrder: number;
  quartileSortOrder: number;
}

export interface ResolvedPerformanceQuartile {
  performanceLevelId: number;
  performanceLevelName: string;
  quartileId: number;
  quartileName: string;
  scoreMin: number;
  scoreMax: number;
  scorePercent: number;
}

export function calculateScorePercent(
  rawScore: number,
  maxRawScore: number,
): number {
  if (maxRawScore <= 0) {
    return 0;
  }

  return Number(((rawScore / maxRawScore) * 100).toFixed(2));
}

export function resolvePerformanceQuartile(
  scorePercent: number,
  bands: PerformanceQuartileBand[],
): ResolvedPerformanceQuartile | null {
  if (bands.length === 0) {
    return null;
  }

  const match = bands.find(
    (band) => scorePercent >= band.scoreMin && scorePercent <= band.scoreMax,
  );

  if (!match) {
    return null;
  }

  return {
    performanceLevelId: match.performanceLevelId,
    performanceLevelName: match.performanceLevelName,
    quartileId: match.quartileId,
    quartileName: match.quartileName,
    scoreMin: match.scoreMin,
    scoreMax: match.scoreMax,
    scorePercent,
  };
}

export function resolvePerformanceQuartileForRawScore(
  rawScore: number,
  maxRawScore: number,
  bands: PerformanceQuartileBand[],
): ResolvedPerformanceQuartile | null {
  const scorePercent = calculateScorePercent(rawScore, maxRawScore);
  return resolvePerformanceQuartile(scorePercent, bands);
}

/**
 * Compute the adjusted score (Score O + CH Adj + ORIC Adj + QEC Adj).
 * Returns null when Score O is not available.
 */
export function getAdjustedScore(
  row: Pick<
    FormSubmissionListItem,
    | "scoreO"
    | "rawScore"
    | "creditHrsErpScoreAdj"
    | "pubOricScoreAdj"
    | "qecScoreAdj"
  >,
): number | null {
  const scoreO = row.scoreO ?? row.rawScore;
  if (scoreO === null || scoreO === undefined || Number.isNaN(scoreO)) {
    return null;
  }

  const chAdj = row.creditHrsErpScoreAdj ?? 0;
  const oricAdj = row.pubOricScoreAdj ?? 0;
  const qecAdj = row.qecScoreAdj ?? 0;

  return scoreO + chAdj + oricAdj + qecAdj;
}

/**
 * Compute the normalized score (adjusted score × calibration factor).
 * Returns null when the adjusted score is not available.
 */
export function getNormalizedScore(
  row: Pick<
    FormSubmissionListItem,
    | "scoreO"
    | "rawScore"
    | "creditHrsErpScoreAdj"
    | "pubOricScoreAdj"
    | "qecScoreAdj"
    | "calibrationFactor"
  >,
): number | null {
  const adjusted = getAdjustedScore(row);
  if (adjusted === null) return null;
  const calFr = row.calibrationFactor ?? 1;
  return adjusted * calFr;
}

/**
 * Compute the normalized score as a percentage of maxRawScore.
 * This is the single source of truth for the percentage used to map
 * submissions to performance levels and quartiles.
 *
 * Formula: ((scoreO + chAdj + oricAdj + qecAdj) × calFr / maxRawScore) × 100
 *
 * Returns null when the score or maxRawScore is not valid.
 */
export function getNormalizedScorePercent(
  row: Pick<
    FormSubmissionListItem,
    | "scoreO"
    | "rawScore"
    | "creditHrsErpScoreAdj"
    | "pubOricScoreAdj"
    | "qecScoreAdj"
    | "calibrationFactor"
    | "maxRawScore"
  >,
): number | null {
  const normalized = getNormalizedScore(row);
  if (normalized === null || row.maxRawScore <= 0) return null;
  return Number(((normalized / row.maxRawScore) * 100).toFixed(2));
}

/**
 * Map a submission to its performance level and quartile using the
 * configured performance matrix bands and the normalized score percentage.
 *
 * This is the single source of truth for submission → performance level +
 * quartile mapping. It must be used everywhere this mapping is needed:
 * server-side persistence, Staff Listing columns, dashboard aggregation,
 * and dashboard rendering.
 */
export function resolveSubmissionPerformanceQuartile(
  row: Pick<
    FormSubmissionListItem,
    | "scoreO"
    | "rawScore"
    | "creditHrsErpScoreAdj"
    | "pubOricScoreAdj"
    | "qecScoreAdj"
    | "calibrationFactor"
    | "maxRawScore"
  >,
  bands: PerformanceQuartileBand[],
): ResolvedPerformanceQuartile | null {
  const scorePercent = getNormalizedScorePercent(row);
  if (scorePercent === null) return null;
  return resolvePerformanceQuartile(scorePercent, bands);
}
