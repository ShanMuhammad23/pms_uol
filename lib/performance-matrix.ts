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

/**
 * One row per unique performance level name. Multiple matrices often share
 * the same level names with different score bands; the dashboard grid must
 * not list duplicates. Counts are matched by name after each employee is
 * resolved against their assigned matrix.
 */
/** "IN-Q4", "Q4", "Quartile 4" → 4. Used to align counts across matrices. */
export function parseQuartileSequenceNumber(
  quartileName: string | null | undefined,
): number | null {
  const text = quartileName?.trim();
  if (!text) return null;
  const match = text.match(/(?:q(?:uartile)?[\s-]*)(\d+)\s*$/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function collapsePerformanceMatrixByLevelName(
  levels: PerformanceLevelWithQuartiles[],
): PerformanceLevelWithQuartiles[] {
  const sorted = sortPerformanceMatrix(levels);
  const seen = new Map<string, PerformanceLevelWithQuartiles>();
  for (const level of sorted) {
    const key = level.name.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, level);
    }
  }
  return [...seen.values()].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}
