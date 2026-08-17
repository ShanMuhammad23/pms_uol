import { isQuartileScoreMinExclusive } from "@/types/performance-matrices";
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

export function scoreMatchesQuartileRange(
  scorePercent: number,
  scoreMin: number,
  scoreMax: number,
  minExclusive: boolean,
): boolean {
  const aboveMin = minExclusive
    ? scorePercent > scoreMin
    : scorePercent >= scoreMin;
  return aboveMin && scorePercent <= scoreMax;
}

function sortQuartileBands(
  bands: PerformanceQuartileBand[],
): PerformanceQuartileBand[] {
  return [...bands].sort(
    (left, right) =>
      left.levelSortOrder - right.levelSortOrder ||
      left.quartileSortOrder - right.quartileSortOrder ||
      left.scoreMin - right.scoreMin,
  );
}

export function resolvePerformanceQuartile(
  scorePercent: number,
  bands: PerformanceQuartileBand[],
): ResolvedPerformanceQuartile | null {
  if (bands.length === 0) {
    return null;
  }

  const sorted = sortQuartileBands(bands);

  for (let index = 0; index < sorted.length; index += 1) {
    const band = sorted[index]!;
    const previous = index > 0 ? sorted[index - 1]! : null;
    const minExclusive = isQuartileScoreMinExclusive(
      band.scoreMin,
      previous?.scoreMax,
    );

    if (
      !scoreMatchesQuartileRange(
        scorePercent,
        band.scoreMin,
        band.scoreMax,
        minExclusive,
      )
    ) {
      continue;
    }

    return {
      performanceLevelId: band.performanceLevelId,
      performanceLevelName: band.performanceLevelName,
      quartileId: band.quartileId,
      quartileName: band.quartileName,
      scoreMin: band.scoreMin,
      scoreMax: band.scoreMax,
      scorePercent,
    };
  }

  return null;
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
 * Prefer the persisted Norm. Score when present (HR calibration / stored value);
 * otherwise derive from Score O + adjustments × calibration factor.
 * Returns null when neither source is available.
 */
export function getNormalizedScore(
  row: Pick<
    FormSubmissionListItem,
    | "normalizedScore"
    | "scoreO"
    | "rawScore"
    | "creditHrsErpScoreAdj"
    | "pubOricScoreAdj"
    | "qecScoreAdj"
    | "calibrationFactor"
  >,
): number | null {
  if (
    row.normalizedScore != null &&
    Number.isFinite(row.normalizedScore)
  ) {
    return row.normalizedScore;
  }

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
 * Prefer persisted `normalizedScore` (Staff Listing Norm. Score). Otherwise:
 * ((scoreO + chAdj + oricAdj + qecAdj) × calFr / maxRawScore) × 100
 *
 * Returns null when the score or maxRawScore is not valid.
 */
export function getNormalizedScorePercent(
  row: Pick<
    FormSubmissionListItem,
    | "normalizedScore"
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
    | "normalizedScore"
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
