"use client";

import type { MatrixQuartileColumn } from "@/lib/performance-matrix";
import type { RatingQuartileMatrixRow } from "@/app/helpers/dashboard-types";
import { getPerformanceLevelColor } from "@/app/helpers/dashboard-helpers";
import type { MatrixScoreType } from "@/lib/performance-rating";
import { cn } from "@/lib/utils";

interface CalibrationDistributionMatrixProps {
  rows: RatingQuartileMatrixRow[];
  columns: MatrixQuartileColumn[];
  employeeCount: number;
  isLoading?: boolean;
}

const SCORE_TYPE_LABELS: Record<MatrixScoreType, string> = {
  scoreO: "Score (O)",
  adjusted: "Score (A)",
  normalized: "Score (N)",
};

export function MatrixScoreTypeSelect({
  value,
  onChange,
}: {
  value: MatrixScoreType;
  onChange: (scoreType: MatrixScoreType) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label
        htmlFor="matrix-score-type"
        className="text-[11px] font-medium text-slate-500 dark:text-slate-400"
      >
        Score:
      </label>
      <select
        id="matrix-score-type"
        value={value}
        onChange={(e) => onChange(e.target.value as MatrixScoreType)}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-amber-400 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
        aria-label="Select score type for rating curve and matrix"
      >
        {(Object.keys(SCORE_TYPE_LABELS) as MatrixScoreType[]).map((st) => (
          <option key={st} value={st}>
            {SCORE_TYPE_LABELS[st]}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CalibrationDistributionMatrix({
  rows,
  columns,
  isLoading,
}: CalibrationDistributionMatrixProps) {
  const levelColWidth = columns.length > 0 ? 26 : 100;
  const dataColWidth =
    columns.length > 0 ? (100 - levelColWidth) / (columns.length + 1) : 0;

  return (
    <div className="flex h-full min-w-0 flex-col">
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-slate-200 px-4 py-12 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          Loading performance matrix…
        </div>
      ) : rows.length === 0 || columns.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-slate-200 px-4 py-12 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          No performance levels or quartiles configured yet.
        </div>
      ) : (
        <div className="min-w-0 w-full overflow-hidden rounded-md border border-slate-200 dark:border-neutral-700">
          <table className="w-full table-fixed border-collapse text-xs border-primary">
            <colgroup>
              <col style={{ width: `${levelColWidth}%` }} />
              {columns.map((column) => (
                <col
                  key={`col-${column.label}-${column.index}`}
                  style={{ width: `${dataColWidth}%` }}
                />
              ))}
              <col style={{ width: `${dataColWidth}%` }} />
            </colgroup>
            <thead className="border-b border-slate-300 text-left text-sm font-semibold text-slate-900 dark:border-neutral-600 dark:text-slate-50">
              <tr className="divide-x divide-slate-300 dark:divide-neutral-600">
                <th className="bg-primary px-2 py-2 text-left font-semibold text-white dark:text-slate-300 sm:px-3 sm:py-2.5">
                  <span className="block wrap-break-words leading-tight">
                    Performance Level
                  </span>
                </th>
                {columns.map((column) => (
                  <th
                    key={`${column.label}-${column.index}`}
                    className="bg-primary px-1 py-2 text-center font-semibold text-white dark:text-slate-300 sm:px-2 sm:py-2.5"
                  >
                    <span className="block wrap-break-words leading-tight">
                      {column.label}
                    </span>
                  </th>
                ))}
                <th className="bg-primary px-1 py-2 text-center font-semibold text-white dark:text-slate-300 sm:px-2 sm:py-2.5">
                  <span className="block wrap-break-words leading-tight">Total</span>
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
                      "px-2 py-2 font-bold text-white dark:text-slate-200 sm:px-3 sm:py-2.5 sm:text-base lg:text-lg",
                      getPerformanceLevelColor(row.rating),
                    )}
                  >
                    <span className="block break-words leading-tight">
                      {row.rating}
                    </span>
                  </td>
                  {row.quartiles.map((cell) => (
                    <td
                      key={`${row.levelId}-${cell.id ?? cell.sortOrder}`}
                      className={cn(
                        "px-1 py-2 text-center sm:px-2 sm:py-2.5",
                        getPerformanceLevelColor(row.rating),
                      )}
                    >
                      {cell.count === null ? (
                        <span className="text-slate-300 dark:text-slate-600">
                          
                        </span>
                      ) : (
                        <div className="min-w-0 space-y-0.5">
                          <span
                            className={cn(
                              "inline-flex max-w-full items-center justify-center rounded-md text-base font-bold tabular-nums sm:text-lg dark:text-slate-200",
                              cell.count > 0
                                ? "text-white  text-bold dark:bg-amber-950/40 dark:text-amber-300"
                                : "text-slate-400 dark:text-slate-600",
                            )}
                          >
                            {cell.count === 0 ? "" : cell.count}
                          </span>
                          {cell.sublabel ? (
                            <p className="break-words text-[10px] leading-tight text-white dark:text-slate-500">
                              {cell.sublabel}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="bg-primary px-1 py-2 text-center text-sm font-bold tabular-nums text-white sm:px-2 sm:py-2.5 sm:text-base">
                    {row.rowTotal === 0 ? "" : row.rowTotal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
