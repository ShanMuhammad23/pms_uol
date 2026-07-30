"use client";

import {
  getPerformanceLevelColor,
  getQuartileShade,
} from "@/app/helpers/dashboard-helpers";
import { sortPerformanceMatrix } from "@/lib/performance-matrix";
import { cn } from "@/lib/utils";
import {
  formatPerformanceScore,
  type PerformanceLevelWithQuartiles,
} from "@/types/performance-matrices";

interface PerformanceMatrixGridProps {
  levels: PerformanceLevelWithQuartiles[];
  onSelectLevel?: (levelId: number) => void;
  selectedLevelId?: number | null;
}

function getColumnHeaders(levels: PerformanceLevelWithQuartiles[]): string[] {
  const sortedLevels = sortPerformanceMatrix(levels);
  const maxQuartiles = Math.max(
    ...sortedLevels.map((level) => level.quartiles.length),
    0,
  );

  if (maxQuartiles === 0) {
    return [];
  }

  const headers: string[] = [];

  for (let index = 0; index < maxQuartiles; index += 1) {
    const names = sortedLevels
      .map((level) => level.quartiles[index]?.name)
      .filter(Boolean);

    const uniqueNames = [...new Set(names)];

    if (uniqueNames.length === 1) {
      headers.push(uniqueNames[0]!);
    } else {
      headers.push(`Quartile ${index + 1}`);
    }
  }

  return headers;
}

export default function PerformanceMatrixGrid({
  levels,
  onSelectLevel,
  selectedLevelId,
}: PerformanceMatrixGridProps) {
  const sortedLevels = sortPerformanceMatrix(levels);
  const columnHeaders = getColumnHeaders(sortedLevels);

  if (sortedLevels.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300/80 bg-slate-50/50 px-6 py-12 text-center dark:border-white/15 dark:bg-white/5">
        <p className="text-sm font-medium text-text-primary">
          No performance levels configured
        </p>
        <p className="mt-1 text-sm text-foreground/70">
          Add performance levels and quartiles to build the matrix.
        </p>
      </div>
    );
  }

  const headers =
    columnHeaders.length > 0 ? columnHeaders : ["Quartiles"];

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 shadow-sm dark:border-neutral-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="divide-x divide-white/20 bg-primary text-white">
            <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold">
              Performance Level
            </th>
            {headers.map((header, index) => (
              <th
                key={`${header}-${index}`}
                className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/20">
          {sortedLevels.map((level, levelIndex) => {
            const levelColor = getPerformanceLevelColor(level.name, levelIndex);
            const isSelected = selectedLevelId === level.id;

            return (
              <tr
                key={level.id}
                className={cn(
                  "divide-x divide-white/20 transition",
                  onSelectLevel && "cursor-pointer",
                  isSelected && "ring-2 ring-inset ring-primary",
                )}
                onClick={() => onSelectLevel?.(level.id)}
              >
                <td
                  className={cn(
                    "whitespace-nowrap px-4 py-3 text-base font-bold text-white",
                    levelColor,
                  )}
                >
                  {level.name}
                </td>
                {headers.map((_, index) => {
                  const quartile = level.quartiles[index];

                  return (
                    <td
                      key={`${level.id}-${index}`}
                      className={cn("px-4 py-3 text-white", levelColor)}
                    >
                      {quartile ? (
                        <div
                          className={cn(
                            "rounded-lg px-2.5 py-1.5",
                            getQuartileShade(index),
                          )}
                        >
                          <p className="font-semibold">{quartile.name}</p>
                          <p className="text-xs text-white/85">
                            {formatPerformanceScore(quartile.scoreMin)} –{" "}
                            {formatPerformanceScore(quartile.scoreMax)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-white/50">
                          {columnHeaders.length === 0
                            ? "No quartiles yet"
                            : "—"}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
