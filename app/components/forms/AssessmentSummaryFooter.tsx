"use client";

import { cn } from "@/lib/utils";

export interface AssessmentSummaryEntry {
  label: string;
  awardedMarks: number;
  totalMarks: number;
  accentClass: string;
}

interface AssessmentSummaryFooterProps {
  entries: AssessmentSummaryEntry[];
}

export default function AssessmentSummaryFooter({
  entries,
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
              className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/30"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {entry.label}
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {entry.awardedMarks}
                  <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
                    {" "}
                    / {entry.totalMarks}
                  </span>
                </p>
              </div>
              <div
                className={cn(
                  "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full text-sm font-bold tabular-nums",
                  entry.accentClass,
                )}
              >
                {percentage}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
