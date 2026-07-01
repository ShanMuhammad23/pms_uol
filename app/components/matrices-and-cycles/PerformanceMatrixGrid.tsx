"use client";

import type { PerformanceLevelWithQuartiles } from "@/types/performance-matrices";

interface PerformanceMatrixGridProps {
  levels: PerformanceLevelWithQuartiles[];
}

function getColumnHeaders(levels: PerformanceLevelWithQuartiles[]): string[] {
  const maxQuartiles = Math.max(
    ...levels.map((level) => level.quartiles.length),
    0,
  );

  if (maxQuartiles === 0) {
    return [];
  }

  const headers: string[] = [];

  for (let index = 0; index < maxQuartiles; index += 1) {
    const names = levels
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
}: PerformanceMatrixGridProps) {
  const columnHeaders = getColumnHeaders(levels);

  if (levels.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
        <p className="text-sm font-medium text-text-primary">
          No performance levels configured
        </p>
        <p className="mt-1 text-sm text-foreground/70">
          Add performance levels and quartiles to build the matrix.
        </p>
      </div>
    );
  }

  if (columnHeaders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
        <p className="text-sm font-medium text-text-primary">
          Performance levels exist but no quartiles are defined yet
        </p>
        <p className="mt-1 text-sm text-foreground/70">
          Add quartiles to each level to populate the combined matrix.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-300/80 dark:border-white/15">
      <table className="min-w-full text-sm">
        <thead className="bg-primary/5">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-text-primary">
              Performance Level
            </th>
            {columnHeaders.map((header, index) => (
              <th
                key={`${header}-${index}`}
                className="px-4 py-3 text-left font-semibold text-text-primary"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {levels.map((level) => (
            <tr
              key={level.id}
              className="border-t border-slate-300/80 dark:border-white/15"
            >
              <td className="px-4 py-3 font-medium text-text-primary">
                {level.name}
              </td>
              {columnHeaders.map((_, index) => {
                const quartile = level.quartiles[index];

                return (
                  <td key={`${level.id}-${index}`} className="px-4 py-3">
                    {quartile ? (
                      <div className="space-y-0.5">
                        <p className="font-medium text-text-primary">
                          {quartile.name}
                        </p>
                        <p className="text-xs text-foreground/70">
                          {quartile.scoreMin} – {quartile.scoreMax}
                        </p>
                      </div>
                    ) : (
                      <span className="text-foreground/40">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
