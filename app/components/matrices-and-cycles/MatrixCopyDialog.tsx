"use client";

import { type FormEvent, useState } from "react";
import { Copy, X } from "lucide-react";
import type { FinancialYearRecord } from "@/types/financial-years";

function suggestCopyValue(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Copy";
  }
  const suffix = " (Copy)";
  if (trimmed.toLowerCase().endsWith("(copy)")) {
    const next = `${trimmed} 2`;
    return next.slice(0, maxLength);
  }
  if (trimmed.length + suffix.length <= maxLength) {
    return `${trimmed}${suffix}`;
  }
  return `${trimmed.slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`;
}

interface MatrixCopyDialogProps {
  open: boolean;
  kind: "performance" | "increment";
  sourceTitle: string;
  sourceLabel: string;
  sourceFinancialYearId: number;
  financialYears: FinancialYearRecord[];
  isSaving?: boolean;
  error?: string | null;
  idPrefix?: string;
  onClose: () => void;
  onCopy: (input: {
    targetFinancialYearId: number;
    title: string;
    newMatrixLabel: string;
  }) => void;
}

export default function MatrixCopyDialog({
  open,
  kind,
  sourceTitle,
  sourceLabel,
  sourceFinancialYearId,
  financialYears,
  isSaving = false,
  error = null,
  idPrefix = "copy-matrix",
  onClose,
  onCopy,
}: MatrixCopyDialogProps) {
  const [targetFinancialYearId, setTargetFinancialYearId] = useState(
    sourceFinancialYearId,
  );
  const [title, setTitle] = useState(suggestCopyValue(sourceTitle, 200));
  const [label, setLabel] = useState(suggestCopyValue(sourceLabel, 120));

  if (!open) {
    return null;
  }

  const handleTargetYearChange = (nextYearId: number) => {
    setTargetFinancialYearId(nextYearId);
    if (nextYearId === sourceFinancialYearId) {
      setTitle(suggestCopyValue(sourceTitle, 200));
      setLabel(suggestCopyValue(sourceLabel, 120));
      return;
    }
    setTitle(sourceTitle);
    setLabel(sourceLabel);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onCopy({
      targetFinancialYearId,
      title: title.trim(),
      newMatrixLabel: label.trim(),
    });
  };

  const structureNote =
    kind === "performance"
      ? "Levels, quartile names, and score ranges are copied. Employee assignments are not."
      : "Increment percentages on quartile cells are copied. Employee assignments are not.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-md border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">
              Copy {kind} matrix
            </p>
            <h3 className="mt-1 text-base font-semibold text-text-primary">
              {sourceTitle || sourceLabel}
            </h3>
            <p className="mt-1 text-sm text-foreground/60">{structureNote}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-foreground/60 hover:bg-slate-100 dark:hover:bg-white/10"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor={`${idPrefix}-financial-year`}
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Financial year
            </label>
            <select
              id={`${idPrefix}-financial-year`}
              value={targetFinancialYearId}
              onChange={(event) =>
                handleTargetYearChange(Number(event.target.value))
              }
              className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
            >
              {financialYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label}
                  {year.isActive ? " — Active" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor={`${idPrefix}-title`}
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Title
            </label>
            <input
              id={`${idPrefix}-title`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={200}
              className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
            />
          </div>
          <div>
            <label
              htmlFor={`${idPrefix}-label`}
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Label
            </label>
            <input
              id={`${idPrefix}-label`}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              required
              maxLength={120}
              className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-semibold text-text-primary hover:bg-primary/10 dark:border-white/15"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim() || !label.trim()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              <Copy className="size-4" />
              {isSaving ? "Copying..." : "Copy matrix"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
