"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/app/queries/keys";
import {
  updateSubmissionScoreAdjustments,
  type ScoreAdjustmentField,
} from "@/lib/queries/form-submissions-client";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { cn } from "@/lib/utils";

interface InlineScoreAdjustmentCellProps {
  submissionId: number;
  field: ScoreAdjustmentField;
  value: number | null;
  disabled?: boolean;
  mode?: "integer" | "decimal";
}

const FIELD_LABELS: Record<ScoreAdjustmentField, string> = {
  creditHrsErpScoreAdj: "CH Adj",
  pubOricScoreAdj: "ORIC Adj",
  calibrationFactor: "Cal. Fr",
  calibratedScoreNumeric: "HR Calibration",
};

export function InlineScoreAdjustmentCell({
  submissionId,
  field,
  value,
  disabled = false,
  mode = "integer",
}: InlineScoreAdjustmentCellProps) {
  const isDecimal = mode === "decimal";
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const committingRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    value != null ? String(isDecimal ? value : Math.round(value)) : isDecimal ? "1" : "",
  );
  const [error, setError] = useState<string | null>(null);
  const fieldLabel = FIELD_LABELS[field];

  useEffect(() => {
    if (!editing) {
      setDraft(value != null ? String(isDecimal ? value : Math.round(value)) : isDecimal ? "1" : "");
    }
  }, [editing, value, isDecimal]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const saveMutation = useMutation({
    mutationFn: (nextValue: number | null) =>
      updateSubmissionScoreAdjustments(submissionId, field, nextValue),
    onMutate: async (nextValue) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: queryKeys.formSubmissions });

      const previous = queryClient.getQueryData<FormSubmissionListItem[]>(
        queryKeys.formSubmissions,
      );

      queryClient.setQueryData<FormSubmissionListItem[]>(
        queryKeys.formSubmissions,
        (current) =>
          current?.map((row) =>
            row.id === submissionId ? { ...row, [field]: nextValue } : row,
          ),
      );

      return { previous };
    },
    onError: (mutationError, _nextValue, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.formSubmissions, context.previous);
      }
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : `Failed to save ${fieldLabel}.`,
      );
      setEditing(true);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<FormSubmissionListItem[]>(
        queryKeys.formSubmissions,
        (current) =>
          current?.map((row) =>
            row.id === result.id ? { ...row, [field]: result[field] } : row,
          ),
      );
      setEditing(false);
    },
  });

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
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

    if (isDecimal && (parsed < 0.1 || parsed > 1.0)) {
      setError("Value must be between 0.1 and 1.0.");
      return;
    }

    const currentValue = value != null ? value : null;
    if (parsed === currentValue) {
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

    setDraft(value != null ? String(isDecimal ? value : Math.round(value)) : "");
    setError(null);
    setEditing(false);
  };

  if (disabled) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  if (editing) {
    return (
      <div className="min-w-[80px]">
        <input
          ref={inputRef}
          type="number"
          step={isDecimal ? 0.01 : 1}
          min={isDecimal ? 0.1 : undefined}
          max={isDecimal ? 1.0 : undefined}
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
            "w-16 rounded border border-slate-400 bg-white px-2 py-1 text-right text-sm tabular-nums text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-slate-300/60 dark:border-slate-500 dark:bg-slate-950 dark:text-white",
            saveMutation.isPending && "opacity-70",
          )}
          aria-label={`Edit ${fieldLabel}`}
          placeholder={isDecimal ? "0.1–1.0" : "+/-"}
        />
        {error ? (
          <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <p className="mt-1 text-[11px] text-slate-400">Enter to save · Esc to cancel</p>
        )}
      </div>
    );
  }

  const displayValue = isDecimal ? (value ?? 1) : value;

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "block w-full rounded px-1.5 py-0.5 text-center text-sm tabular-nums text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white",
        displayValue == null && "text-slate-400 italic dark:text-slate-500",
      )}
      title={displayValue != null ? `${displayValue} (click to edit)` : `Click to set ${fieldLabel}`}
    >
      {displayValue != null ? (isDecimal ? displayValue.toFixed(1) : Math.round(displayValue)) : "—"}
    </button>
  );
}
