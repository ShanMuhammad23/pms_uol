import { isQuartileScoreMinExclusive } from "@/types/performance-matrices";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { getReportingManagerScore } from "@/app/helpers/score-o";

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
 * True when a rating may be calculated: a form (or direct score entry) is
 * assigned AND a performance matrix is assigned. Never invent a rating from a
 * default / fallback matrix.
 */
export function canResolvePerformanceRating(
  row: {
    formAssigned?: boolean;
    directScoreEntry?: boolean;
    assignedPerformanceMatrix?: string | null;
  },
): boolean {
  if (!row.formAssigned && !row.directScoreEntry) {
    return false;
  }
  return Boolean(row.assignedPerformanceMatrix?.trim());
}

/** Bands for the employee's assigned performance matrix. Empty when none is assigned. */
export function bandsForAssignedMatrix(
  assignedMatrixLabel: string | null | undefined,
  bandsByLabel: Map<string, PerformanceQuartileBand[]> | undefined,
): PerformanceQuartileBand[] {
  const label = assignedMatrixLabel?.trim();
  if (label && bandsByLabel) {
    const assigned =
      bandsByLabel.get(label) ??
      [...bandsByLabel.entries()].find(
        ([key]) => key.trim().toLowerCase() === label.toLowerCase(),
      )?.[1];
    if (assigned && assigned.length > 0) {
      return assigned;
    }
  }
  return [];
}

/**
 * Compute the adjusted score (Score O + CH Adj + ORIC Adj + QEC Adj).
 * Uses the official reporting-manager score (getReportingManagerScore),
 * NOT self-assessment rawScore. Returns null when no approved manager
 * score is available.
 */
export function getAdjustedScore(
  row: Pick<
    FormSubmissionListItem,
    | "directScoreEntry"
    | "scoreO"
    | "manager1Score"
    | "manager2Score"
    | "manager2UserId"
    | "status"
    | "creditHrsErpScoreAdj"
    | "pubOricScoreAdj"
    | "qecScoreAdj"
  >,
): number | null {
  const scoreO = getReportingManagerScore(row);
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
    | "directScoreEntry"
    | "scoreO"
    | "manager1Score"
    | "manager2Score"
    | "manager2UserId"
    | "status"
    | "creditHrsErpScoreAdj"
    | "pubOricScoreAdj"
    | "qecScoreAdj"
    | "calibrationFactor"
  >,
): number | null {
  // Ignore 0 — a leftover / default stored value must not block derivation
  // from Score (O) × calibration factor after HR alignment.
  if (
    row.normalizedScore != null &&
    Number.isFinite(row.normalizedScore) &&
    row.normalizedScore > 0
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
    | "directScoreEntry"
    | "scoreO"
    | "manager1Score"
    | "manager2Score"
    | "manager2UserId"
    | "status"
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
    | "directScoreEntry"
    | "scoreO"
    | "manager1Score"
    | "manager2Score"
    | "manager2UserId"
    | "status"
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

/* -------------------------------------------------------------------------- */
/* Score-type-aware resolvers for the Rating × Quartile Matrix dropdown        */
/* -------------------------------------------------------------------------- */

export type MatrixScoreType = "normalized" | "scoreO" | "adjusted";

/**
 * Compute Score(O) as a percentage of maxRawScore.
 * Uses the official reporting-manager score (getReportingManagerScore),
 * NOT self-assessment rawScore. Returns null when no approved manager
 * score is available or maxRawScore is not valid.
 */
export function getScoreOPercent(
  row: Pick<
    FormSubmissionListItem,
    | "directScoreEntry"
    | "scoreO"
    | "manager1Score"
    | "manager2Score"
    | "manager2UserId"
    | "status"
    | "maxRawScore"
  >,
): number | null {
  const scoreO = getReportingManagerScore(row);
  if (scoreO === null || scoreO === undefined || Number.isNaN(scoreO)) {
    return null;
  }
  if (row.maxRawScore <= 0) return null;
  return Number(((scoreO / row.maxRawScore) * 100).toFixed(2));
}

/**
 * Compute the adjusted score as a percentage of maxRawScore.
 * Adjusted = Score(O) + CH Adj + ORIC Adj + QEC Adj.
 * Returns null when Score(O) or maxRawScore is not valid.
 */
export function getAdjustedScorePercent(
  row: Pick<
    FormSubmissionListItem,
    | "directScoreEntry"
    | "scoreO"
    | "manager1Score"
    | "manager2Score"
    | "manager2UserId"
    | "status"
    | "creditHrsErpScoreAdj"
    | "pubOricScoreAdj"
    | "qecScoreAdj"
    | "maxRawScore"
  >,
): number | null {
  const adjusted = getAdjustedScore(row);
  if (adjusted === null || row.maxRawScore <= 0) return null;
  return Number(((adjusted / row.maxRawScore) * 100).toFixed(2));
}

type AdjustedRatingRow = Pick<
  FormSubmissionListItem,
  | "normalizedScore"
  | "directScoreEntry"
  | "scoreO"
  | "manager1Score"
  | "manager2Score"
  | "manager2UserId"
  | "status"
  | "creditHrsErpScoreAdj"
  | "pubOricScoreAdj"
  | "qecScoreAdj"
  | "calibrationFactor"
  | "maxRawScore"
  | "performanceLevelName"
  | "formAssigned"
  | "assignedPerformanceMatrix"
>;

/**
 * Rating (A) for the adjusted score (Score O + CH/ORIC/QEC adj).
 *
 * Uses only the assigned performance matrix. No default-band fallback.
 * When bands are unavailable and adjusted % equals normalized %, reuse the
 * assigned-matrix Rating (N) already on the row.
 */
export function resolveAdjustedPerformanceLevelName(
  row: AdjustedRatingRow,
  bands?: PerformanceQuartileBand[] | null,
): string | null {
  if (!canResolvePerformanceRating(row)) {
    return null;
  }

  const officialScore = getReportingManagerScore(row);
  if (officialScore == null || officialScore <= 0) {
    return null;
  }

  if (bands && bands.length > 0) {
    return (
      resolveSubmissionPerformanceQuartileByType(row, bands, "adjusted")
        ?.performanceLevelName ?? null
    );
  }

  const adjPct = getAdjustedScorePercent(row);
  const normPct = getNormalizedScorePercent(row);
  if (
    adjPct != null &&
    normPct != null &&
    Math.abs(adjPct - normPct) < 0.05 &&
    row.performanceLevelName
  ) {
    return row.performanceLevelName;
  }

  return null;
}

/**
 * Get the score percentage for the specified score type.
 * This is the single entry point used by the matrix dropdown.
 */
export function getScorePercentByType(
  row: Pick<
    FormSubmissionListItem,
    | "normalizedScore"
    | "directScoreEntry"
    | "scoreO"
    | "manager1Score"
    | "manager2Score"
    | "manager2UserId"
    | "status"
    | "creditHrsErpScoreAdj"
    | "pubOricScoreAdj"
    | "qecScoreAdj"
    | "calibrationFactor"
    | "maxRawScore"
  >,
  scoreType: MatrixScoreType,
): number | null {
  switch (scoreType) {
    case "scoreO":
      return getScoreOPercent(row);
    case "adjusted":
      return getAdjustedScorePercent(row);
    case "normalized":
    default:
      return getNormalizedScorePercent(row);
  }
}

/**
 * Map a submission to its performance level and quartile using the
 * specified score type percentage. Used by the matrix dropdown to
 * segregate employees by Score(O), Adjusted Score, or Normalized Score.
 */
export function resolveSubmissionPerformanceQuartileByType(
  row: Pick<
    FormSubmissionListItem,
    | "normalizedScore"
    | "directScoreEntry"
    | "scoreO"
    | "manager1Score"
    | "manager2Score"
    | "manager2UserId"
    | "status"
    | "creditHrsErpScoreAdj"
    | "pubOricScoreAdj"
    | "qecScoreAdj"
    | "calibrationFactor"
    | "maxRawScore"
  >,
  bands: PerformanceQuartileBand[],
  scoreType: MatrixScoreType,
): ResolvedPerformanceQuartile | null {
  const scorePercent = getScorePercentByType(row, scoreType);
  if (scorePercent === null) return null;
  return resolvePerformanceQuartile(scorePercent, bands);
}
