export interface PerformanceLevelRecord {
  id: number;
  financialYearId: number;
  matrixLabel: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceQuartileRecord {
  id: number;
  performanceLevelId: number;
  name: string;
  scoreMin: number;
  scoreMax: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceLevelWithQuartiles extends PerformanceLevelRecord {
  quartiles: PerformanceQuartileRecord[];
}

export interface CreatePerformanceLevelInput {
  financialYearId: number;
  matrixLabel: string;
  name: string;
  sortOrder?: number;
}

export interface UpdatePerformanceLevelInput {
  matrixLabel: string;
  name: string;
  sortOrder?: number;
}

export interface CreatePerformanceQuartileInput {
  performanceLevelId: number;
  name: string;
  scoreMin: number;
  scoreMax: number;
  sortOrder?: number;
}

export interface UpdatePerformanceQuartileInput {
  name: string;
  scoreMin: number;
  scoreMax: number;
  sortOrder?: number;
}

export function formatPerformanceScore(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
}

/** True when this quartile shares its min with the previous quartile's max. */
export function isQuartileScoreMinExclusive(
  scoreMin: number,
  previousScoreMax: number | null | undefined,
): boolean {
  return (
    previousScoreMax != null && Number(previousScoreMax) === Number(scoreMin)
  );
}

/**
 * Formats a quartile range. Shared boundaries use a greater-than lower bound
 * so e.g. 90–92.5 then >92.5–95 have no overlap at 92.5.
 */
export function formatQuartileScoreRange(
  scoreMin: number,
  scoreMax: number,
  minExclusive = false,
): string {
  const minLabel = minExclusive
    ? `>${formatPerformanceScore(scoreMin)}`
    : formatPerformanceScore(scoreMin);

  return `${minLabel} – ${formatPerformanceScore(scoreMax)}`;
}
