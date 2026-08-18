"use client";

import { type FormEvent } from "react";
import { cn } from "@/lib/utils";

interface MatrixIdentityEditorProps {
  financialYearLabel: string;
  title: string;
  label: string;
  onTitleChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  isSaving?: boolean;
  dirty?: boolean;
  idPrefix?: string;
  performanceMatrixLabel?: string;
  performanceMatrixOptions?: string[];
  onPerformanceMatrixChange?: (value: string) => void;
}

export default function MatrixIdentityEditor({
  financialYearLabel,
  title,
  label,
  onTitleChange,
  onLabelChange,
  onSave,
  isSaving = false,
  dirty = false,
  idPrefix = "matrix",
  performanceMatrixLabel,
  performanceMatrixOptions,
  onPerformanceMatrixChange,
}: MatrixIdentityEditorProps) {
  const showPerformanceMatrixSelect = Boolean(onPerformanceMatrixChange);

  return (
    <form
      onSubmit={onSave}
      className="rounded-md border border-slate-300/80 bg-background p-4 dark:border-white/15"
    >
      <div
        className={cn(
          "grid gap-3 sm:grid-cols-2",
          showPerformanceMatrixSelect ? "lg:grid-cols-5" : "lg:grid-cols-4",
        )}
      >
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-foreground/60">
            Financial Year
          </p>
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-semibold text-text-primary dark:border-white/10 dark:bg-white/5">
            {financialYearLabel}
          </p>
        </div>
        <div>
          <label
            htmlFor={`${idPrefix}-edit-title`}
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground/60"
          >
            Title
          </label>
          <input
            id={`${idPrefix}-edit-title`}
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="e.g. Academic Faculty Matrix"
            className="w-full rounded-lg border border-slate-300 bg-background px-2.5 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
          />
        </div>
        <div>
          <label
            htmlFor={`${idPrefix}-edit-label`}
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground/60"
          >
            Label
          </label>
          <input
            id={`${idPrefix}-edit-label`}
            value={label}
            onChange={(event) => onLabelChange(event.target.value)}
            placeholder="e.g. Academic"
            className="w-full rounded-lg border border-slate-300 bg-background px-2.5 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
          />
        </div>

        {showPerformanceMatrixSelect ? (
          <div>
            <label
              htmlFor={`${idPrefix}-performance-matrix`}
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground/60"
            >
              Performance Matrix
            </label>
            <select
              id={`${idPrefix}-performance-matrix`}
              value={performanceMatrixLabel ?? ""}
              onChange={(event) =>
                onPerformanceMatrixChange?.(event.target.value)
              }
              disabled={!performanceMatrixOptions?.length}
              className="w-full rounded-lg border border-slate-300 bg-background px-2.5 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
            >
              {!performanceMatrixOptions?.length ? (
                <option value="">No performance matrices</option>
              ) : (
                performanceMatrixOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))
              )}
            </select>
          </div>
        ) : null}

        <div className="flex items-end">
          <button
            type="submit"
            disabled={!dirty || isSaving || !title.trim() || !label.trim()}
            className="w-full rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save title & label"}
          </button>
        </div>
      </div>
    </form>
  );
}
