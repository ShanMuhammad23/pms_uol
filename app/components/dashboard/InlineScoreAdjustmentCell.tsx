"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cancelStaffListingQueries,
  getStaffListingSnapshots,
  patchStaffListingCaches,
  restoreStaffListingSnapshots,
} from "@/app/helpers/dashboard-listing-cache";
import {
  updateSubmissionScoreAdjustments,
  updateSubmissionCompensationWorksheet,
  type ScoreAdjustmentField,
  type CompensationWorksheetField,
} from "@/lib/queries/form-submissions-client";
import { cn } from "@/lib/utils";

interface InlineScoreAdjustmentCellProps {
  submissionId: number;
  field: ScoreAdjustmentField | CompensationWorksheetField;
  value: number | null;
  disabled?: boolean;
  mode?: "integer" | "decimal" | "score" | "money";
  /** When provided, the cell buffers changes locally and calls this callback instead of auto-saving. */
  onBufferedChange?: (field: ScoreAdjustmentField, value: number | null) => void;
  /** Pending buffered value (from parent). When set, cell shows this instead of the saved value. */
  pendingValue?: number | null;
  /** When false, the cell is read-only (no edit button). Defaults to true. */
  canEdit?: boolean;
}

const FIELD_LABELS: Record<ScoreAdjustmentField | CompensationWorksheetField, string> = {
  creditHrsErpScoreAdj: "CH Adj",
  pubOricScoreAdj: "ORIC Adj",
  qecScoreAdj: "QEC Adj",
  calibrationFactor: "Cal. Fr",
  calibratedScoreNumeric: "HR Calibration",
  initialScoreNumeric: "Score (O)",
  incrementAdjusted: "Increment Adjustment",
  revisedSalaryRo: "Revised Salary (RO)",
};

function isCompensationField(
  field: ScoreAdjustmentField | CompensationWorksheetField,
): field is CompensationWorksheetField {
  return field === "incrementAdjusted" || field === "revisedSalaryRo";
}

function formatNumericDisplay(
  value: number | null,
  mode: "integer" | "decimal" | "score" | "money",
): string {
  if (value == null) return "—";
  if (mode === "money") return value.toFixed(2);
  if (mode === "decimal" || mode === "score") return value.toFixed(1);
  return String(Math.round(value));
}

export function InlineScoreAdjustmentCell({
  submissionId,
  field,
  value,
  disabled = false,
  mode = "integer",
  onBufferedChange,
  pendingValue,
  canEdit = true,
}: InlineScoreAdjustmentCellProps) {
  const isMoney = mode === "money";
  const isDecimal = mode === "decimal" || mode === "score" || isMoney;
  const hasRangeConstraint = mode === "decimal";
  const isBuffered = onBufferedChange != null && !isCompensationField(field);
  const displayValue = isBuffered ? (pendingValue ?? value) : value;
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const committingRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const draftFromValue = (next: number | null) =>
    next != null
      ? String(isMoney ? next.toFixed(2) : isDecimal ? next : Math.round(next))
      : isDecimal && !isMoney
        ? "1"
        : "";
  const [draft, setDraft] = useState(draftFromValue(displayValue));
  const [error, setError] = useState<string | null>(null);
  const fieldLabel = FIELD_LABELS[field];
  const nextDraft = draftFromValue(displayValue);
  if (!editing && draft !== nextDraft) {
    setDraft(nextDraft);
  }

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const saveMutation = useMutation({
    mutationFn: async (nextValue: number | null): Promise<{ id: number }> => {
      if (isCompensationField(field)) {
        return updateSubmissionCompensationWorksheet(submissionId, field, nextValue);
      }
      return updateSubmissionScoreAdjustments(submissionId, field, nextValue);
    },
    onMutate: async (nextValue) => {
      setError(null);
      await cancelStaffListingQueries(queryClient);
      const snapshots = getStaffListingSnapshots(queryClient);

      patchStaffListingCaches(queryClient, (row) =>
        row.id === submissionId ? { ...row, [field]: nextValue } : row,
      );

      return { snapshots };
    },
    onError: (mutationError, _nextValue, context) => {
      if (context?.snapshots) {
        restoreStaffListingSnapshots(queryClient, context.snapshots);
      }
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : `Failed to save ${fieldLabel}.`,
      );
      setEditing(true);
    },
    onSuccess: (_result, nextValue) => {
      patchStaffListingCaches(queryClient, (row) =>
        row.id === submissionId ? { ...row, [field]: nextValue } : row,
      );
      setEditing(false);
    },
  });

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      if (isBuffered && !isCompensationField(field)) {
        onBufferedChange?.(field, null);
        setEditing(false);
        setError(null);
        return;
      }
      const currentValue = value != null ? String(value) : "";
      if (currentValue === "") {
        setEditing(false);
        setError(null);
        return;
      }
      committingRef.current = true;
      saveMutation.mutate(null, {
        onSettled: () => {
          committingRef.current = false;
        },
      });
      return;
    }

    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) {
      setError("Must be a number.");
      return;
    }

    if (hasRangeConstraint && (parsed < 0.1 || parsed > 1.0)) {
      setError("Value must be between 0.1 and 1.0.");
      return;
    }

    const currentValue = displayValue != null ? displayValue : null;
    if (parsed === currentValue) {
      setEditing(false);
      setError(null);
      return;
    }

    if (isBuffered && !isCompensationField(field)) {
      onBufferedChange?.(field, parsed);
      setEditing(false);
      setError(null);
      return;
    }

    committingRef.current = true;
    saveMutation.mutate(parsed, {
      onSettled: () => {
        committingRef.current = false;
      },
    });
  };

  const cancel = () => {
    if (committingRef.current || saveMutation.isPending) {
      return;
    }

    setDraft(draftFromValue(displayValue));
    setError(null);
    setEditing(false);
  };

  if (disabled) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const displayText = formatNumericDisplay(displayValue, mode);

  if (!canEdit) {
    return (
      <span
        className="block w-full px-1.5 py-0.5 text-right text-sm tabular-nums text-slate-700 dark:text-slate-300"
        title={displayValue != null ? String(displayValue) : undefined}
      >
        {displayText}
      </span>
    );
  }

  if (editing) {
    return (
      <div className={isMoney ? "min-w-[96px]" : "min-w-[80px]"}>
        <input
          ref={inputRef}
          type="number"
          step={isDecimal ? 0.01 : 1}
          min={hasRangeConstraint ? 0.1 : undefined}
          max={hasRangeConstraint ? 1.0 : undefined}
          value={draft}
          disabled={saveMutation.isPending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          onBlur={() => {
            if (!saveMutation.isPending) {
              commit();
            }
          }}
          className={cn(
            "rounded border border-slate-400 bg-white px-2 py-1 text-right text-sm tabular-nums text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-slate-300/60 dark:border-slate-500 dark:bg-slate-950 dark:text-white",
            isMoney ? "w-24" : "w-16",
            saveMutation.isPending && "opacity-70",
          )}
          aria-label={`Edit ${fieldLabel}`}
          placeholder={hasRangeConstraint ? "0.1–1.0" : isDecimal ? "0.00" : "+/-"}
        />
        {error ? (
          <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <p className="mt-1 text-[11px] text-slate-400">{isBuffered ? "Enter to confirm · Esc to cancel" : "Enter to save · Esc to cancel"}</p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "block w-full rounded px-1.5 py-0.5 text-right text-sm tabular-nums text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white",
        displayValue == null && "text-slate-400 italic dark:text-slate-500",
        isBuffered && pendingValue != null && pendingValue !== value && "ring-2 ring-orange-400/60",
      )}
      title={displayValue != null ? `${displayValue} (click to edit)` : `Click to set ${fieldLabel}`}
    >
      {displayText}
    </button>
  );
}
