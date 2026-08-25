"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PerformanceMatrixAssignmentCellProps {
  employeeName: string;
  matrixTitle: string | null;
}

export function PerformanceMatrixAssignmentCell({
  employeeName,
  matrixTitle,
}: PerformanceMatrixAssignmentCellProps) {
  const title = matrixTitle?.trim();

  if (!title) {
    return (
      <span
        className="inline-flex size-6 items-center justify-center rounded-md text-slate-400 dark:text-slate-500"
        title="No performance matrix assigned"
        aria-label="No performance matrix assigned"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400",
      )}
      title={title}
      aria-label={`Performance matrix assigned to ${employeeName}: ${title}`}
    >
      <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.75} />
      <span className="truncate">{title}</span>
    </span>
  );
}
