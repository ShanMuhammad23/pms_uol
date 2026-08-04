import type { PerformanceQuartileBand } from "@/lib/performance-rating";
import type { PerformanceLevelWithQuartiles } from "@/types/performance-matrices";

export interface MatrixQuartileColumn {
  index: number;
  label: string;
  sortOrder: number;
}

export function sortPerformanceMatrix(
  levels: PerformanceLevelWithQuartiles[],
): PerformanceLevelWithQuartiles[] {
  return [...levels]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((level) => ({
      ...level,
      quartiles: [...level.quartiles].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    }));
}

export function buildQuartileBandsFromMatrix(
  levels: PerformanceLevelWithQuartiles[],
): PerformanceQuartileBand[] {
  const sorted = sortPerformanceMatrix(levels);
  const bands: PerformanceQuartileBand[] = [];

  for (const level of sorted) {
    for (const quartile of level.quartiles) {
      bands.push({
        performanceLevelId: level.id,
        performanceLevelName: level.name,
        quartileId: quartile.id,
        quartileName: quartile.name,
        scoreMin: quartile.scoreMin,
        scoreMax: quartile.scoreMax,
        levelSortOrder: level.sortOrder,
        quartileSortOrder: quartile.sortOrder,
      });
    }
  }

  return bands;
}

export function getMatrixQuartileColumnCount(
  levels: PerformanceLevelWithQuartiles[],
): number {
  const sorted = sortPerformanceMatrix(levels);
  return Math.max(...sorted.map((level) => level.quartiles.length), 0);
}

export function getMatrixQuartileColumnHeaders(
  levels: PerformanceLevelWithQuartiles[],
): MatrixQuartileColumn[] {
  const sorted = sortPerformanceMatrix(levels);
  const maxQuartiles = getMatrixQuartileColumnCount(sorted);
  const headers: MatrixQuartileColumn[] = [];

  for (let index = 0; index < maxQuartiles; index += 1) {
    const quartilesAtIndex = sorted
      .map((level) => level.quartiles[index])
      .filter(Boolean);
    const names = quartilesAtIndex.map((quartile) => quartile!.name);
    const uniqueNames = [...new Set(names)];
    const sortOrder = quartilesAtIndex[0]?.sortOrder ?? index;

    headers.push({
      index,
      label:
        uniqueNames.length === 1 ? uniqueNames[0]! : `Quartile ${index + 1}`,
      sortOrder,
    });
  }

  return headers;
}
