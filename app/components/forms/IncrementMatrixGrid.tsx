"use client";

import type { IncrementMatrixInput, PerformanceRating } from "@/types/forms";
import { PERFORMANCE_RATINGS, RATING_LABELS } from "@/types/forms";

interface IncrementMatrixGridProps {
  matrices: IncrementMatrixInput[];
  onChange: (matrices: IncrementMatrixInput[]) => void;
  readOnly?: boolean;
}

function getCellValue(
  matrices: IncrementMatrixInput[],
  rating: PerformanceRating,
  quartile: number,
): number {
  const entry = matrices.find(
    (item) => item.rating === rating && item.quartile === quartile,
  );

  return entry?.recommendedIncrementPercentage ?? 0;
}

export default function IncrementMatrixGrid({
  matrices,
  onChange,
  readOnly = false,
}: IncrementMatrixGridProps) {
  const updateCell = (
    rating: PerformanceRating,
    quartile: number,
    value: number,
  ) => {
    const next = matrices.map((entry) =>
      entry.rating === rating && entry.quartile === quartile
        ? { ...entry, recommendedIncrementPercentage: value }
        : entry,
    );

    onChange(next);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-300/80 dark:border-white/15">
      <table className="min-w-full text-sm">
        <thead className="bg-primary/5">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-text-primary">
              Rating
            </th>
            {[1, 2, 3, 4].map((quartile) => (
              <th
                key={quartile}
                className="px-4 py-3 text-left font-semibold text-text-primary"
              >
                Q{quartile}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERFORMANCE_RATINGS.map((rating) => (
            <tr
              key={rating}
              className="border-t border-slate-300/80 dark:border-white/15"
            >
              <td className="px-4 py-3 font-medium text-text-primary">
                {RATING_LABELS[rating]}
              </td>
              {[1, 2, 3, 4].map((quartile) => (
                <td key={quartile} className="px-4 py-3">
                  {readOnly ? (
                    <span className="text-sm text-text-primary">
                      {getCellValue(matrices, rating, quartile)}%
                    </span>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={getCellValue(matrices, rating, quartile)}
                      onChange={(event) =>
                        updateCell(
                          rating,
                          quartile,
                          Number(event.target.value || 0),
                        )
                      }
                      className="h-9 w-full min-w-[80px] rounded-lg border border-slate-300 bg-background px-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
