"use client";

import { APPRAISAL_STATUSES, APPRAISAL_STATUS_LABELS } from "@/types/forms";
import { cn } from "@/lib/utils";

export default function WorkflowStepper() {
  return (
    <div className="rounded-xl border border-slate-300/80 bg-surface p-5 dark:border-white/15">
      <h3 className="text-sm font-semibold text-text-primary">
        Appraisal Workflow
      </h3>
      <p className="mt-1 text-xs text-foreground/70">
        This workflow is fixed and applies to all appraisals using this form.
      </p>

      <ol className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {APPRAISAL_STATUSES.map((status, index) => (
          <li
            key={status}
            className={cn(
              "flex min-w-[140px] flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-xs",
              "border-slate-300/80 bg-background dark:border-white/15",
            )}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
              {index + 1}
            </span>
            <span className="font-medium text-text-primary">
              {APPRAISAL_STATUS_LABELS[status]}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
