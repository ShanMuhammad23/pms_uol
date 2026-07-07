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
