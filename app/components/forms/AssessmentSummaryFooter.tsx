"use client";

import { formatScoreValue } from "@/app/helpers/form-rating-scoring";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AssessmentSummaryEntry {
  label: string;
  awardedMarks: number;
  totalMarks: number;
  accentClass: string;
  /** Optional person line (name + SAP) shown under the assessment label. */
  personLabel?: string | null;
  /** When true, shows a large completed-review checkmark in the card. */
  completed?: boolean;
}

interface AssessmentSummaryFooterProps {
  entries: AssessmentSummaryEntry[];
  /**
   * When false, hides the awarded/total marks and shows only the percentage.
   * Defaults to true (preserves existing behavior for EmployeeFormFill).
   */
  showMarks?: boolean;
}

export default function AssessmentSummaryFooter({
  entries,
  showMarks = true,
}: AssessmentSummaryFooterProps) {
  if (entries.length === 0) return null;

  return (
    <div className="print-assessment-summary mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => {
          const percentage =
            entry.totalMarks > 0
              ? Math.round((entry.awardedMarks / entry.totalMarks) * 1000) / 10
              : 0;

          return (
            <div
              key={entry.label}
              className={cn(
                "flex items-center justify-between rounded-md border px-4 py-3",
                entry.completed
                  ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/30"
                  : "border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/30",
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {entry.label}
                </p>
                {entry.personLabel ? (
                  <p
                    className="mt-0.5 truncate text-sm font-semibold text-slate-800 dark:text-slate-100"
                    title={entry.personLabel}
                  >
                    {entry.personLabel}
                  </p>
                ) : null}
                {showMarks ? (
                  <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatScoreValue(entry.awardedMarks)}
                    <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
                      {" "}
                      / {formatScoreValue(entry.totalMarks)}
                    </span>
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1.5">
                {entry.completed ? (
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300"
                    aria-label="Review completed"
                  >
                    <Check className="size-10" strokeWidth={2.75} aria-hidden="true" />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex h-14 w-14 flex-col items-center justify-center rounded-full text-sm font-bold tabular-nums",
                      entry.accentClass,
                    )}
                  >
                    {percentage}%
                  </div>
                )}
                {entry.completed ? (
                  <p className="text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {percentage}%
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
