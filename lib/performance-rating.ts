import { isQuartileScoreMinExclusive } from "@/types/performance-matrices";

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
