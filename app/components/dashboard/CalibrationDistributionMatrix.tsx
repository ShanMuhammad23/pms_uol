"use client";

import type { MatrixQuartileColumn } from "@/lib/performance-matrix";
import type { RatingQuartileMatrixRow } from "@/app/helpers/dashboard-types";
import { getPerformanceLevelColor } from "@/app/helpers/dashboard-helpers";
import { cn } from "@/lib/utils";

interface CalibrationDistributionMatrixProps {
  rows: RatingQuartileMatrixRow[];
  columns: MatrixQuartileColumn[];
  employeeCount: number;
  isLoading?: boolean;
  hideHeader?: boolean;
}

export function CalibrationDistributionMatrix({
  rows,
  columns,
  employeeCount,
  isLoading,
  hideHeader = false,
}: CalibrationDistributionMatrixProps) {
  const columnTotals = columns.map((column) =>
    rows.reduce(
      (sum, row) => sum + (row.quartiles[column.index]?.count ?? 0),
      0,
    ),
  );

  return (
    <div className="flex h-full flex-col">
      {!hideHeader ? (
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Rating × Quartile Matrix</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Employee headcount by performance level and quartile (sorted by configured order)
          </p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-slate-200 px-4 py-12 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          Loading performance matrix…
        </div>
      ) : rows.length === 0 || columns.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-slate-200 px-4 py-12 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          No performance levels or quartiles configured yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-neutral-700">
          <table className="min-w-full text-xs">
            <thead className="whitespace-nowrap border-b border-slate-300 text-left text-sm font-semibold text-slate-900 dark:border-neutral-600 dark:text-slate-50">
              <tr className="divide-x divide-slate-300 dark:divide-neutral-600">
                <th className="px-3 bg-primary py-2.5 text-left font-semibold text-white dark:text-slate-300">
                  Performance Level
                </th>
                {columns.map((column) => (
                  <th
                    key={`${column.label}-${column.index}`}
                    className="px-2 bg-primary py-2.5 text-center font-semibold text-white dark:text-slate-300"
                  >
                    <span className="block">{column.label}</span>
                  </th>
                ))}
                <th className="px-2 bg-primary py-2.5 text-center font-semibold text-white dark:text-slate-300">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm dark:divide-neutral-700">
              {rows.map((row) => (
                <tr
                  key={row.levelId}
                  className="divide-x divide-slate-200 dark:divide-neutral-700"
                >
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2.5 font-bold text-white dark:text-slate-200 text-lg",
                      getPerformanceLevelColor(row.rating),
                    )}
                  >
                    {row.rating}
                  </td>
                  {row.quartiles.map((cell) => (
                    <td key={`${row.levelId}-${cell.id ?? cell.sortOrder}`} className={cn("px-2 py-2.5 text-center", getPerformanceLevelColor(row.rating))} >
                      {cell.count === null ? (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      ) : (
                        <div className="space-y-0.1">
                          <span
                            className={cn(
                              "text-lg inline-flex min-w-8 items-center justify-center text-white dark:text-slate-200 rounded-md  font-bold tabular-nums",
                              cell.count > 0
                                ? " text-primary dark:bg-amber-950/40 dark:text-amber-300"
                                : "text-white dark:text-slate-200",
                            )}
                          >
                            {cell.count}
                          </span>
                          {cell.sublabel ? (
                            <p className="text-[10px] text-white dark:text-slate-500">
                              {cell.sublabel}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </td>
                  ))}
                  <td className={cn("px-2 py-2.5 text-center text-white font-bold text-base tabular-nums bg-primary text-white")}>
                    {row.rowTotal}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-primary text-white dark:border-white/10 dark:bg-slate-800/40">
                <td className="px-3 py-2.5 font-semibold  dark:text-slate-300">Total</td>
                {columnTotals.map((total, index) => (
                  <td
                    key={`${columns[index]?.label}-${index}`}
                    className="px-2 py-2.5 text-center font-semibold tabular-nums  dark:text-slate-200"
                  >
                    {total}
                  </td>
                ))}
                <td className="px-2 py-2.5 text-center font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                  {}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
