"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cancelStaffListingQueries,
  getStaffListingSnapshots,
  patchStaffListingCaches,
  restoreStaffListingSnapshots,
} from "@/app/helpers/dashboard-listing-cache";
import { updateSubmissionRemarks } from "@/lib/queries/form-submissions-client";
import { cn } from "@/lib/utils";

export type RemarksField = "remarksEvaluation" | "remarksCompensation";

interface InlineRemarksCellProps {
  submissionId: number;
  field: RemarksField;
  value: string | null;
  disabled?: boolean;
}

const FIELD_LABELS: Record<RemarksField, string> = {
  remarksEvaluation: "evaluation remarks",
  remarksCompensation: "compensation remarks",
};

export function InlineRemarksCell({
  submissionId,
  field,
  value,
  disabled = false,
}: InlineRemarksCellProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const committingRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const fieldLabel = FIELD_LABELS[field];
  const nextDraft = value ?? "";
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
    mutationFn: (nextValue: string | null) =>
      updateSubmissionRemarks(submissionId, field, nextValue),
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
    onSuccess: (result) => {
      patchStaffListingCaches(queryClient, (row) =>
        row.id === result.id ? { ...row, [field]: result[field] } : row,
      );
      setEditing(false);
    },
  });

  const commit = () => {
    const nextValue = draft.trim() || null;
    const currentValue = value?.trim() || null;

    if (nextValue === currentValue) {
      setEditing(false);
      setError(null);
      return;
    }

    committingRef.current = true;
    saveMutation.mutate(nextValue, {
      onSettled: () => {
        committingRef.current = false;
      },
    });
  };

  const cancel = () => {
    if (committingRef.current || saveMutation.isPending) {
      return;
    }

    setDraft(value ?? "");
    setError(null);
    setEditing(false);
  };

  if (disabled) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  if (editing) {
    return (
      <div className="min-w-[180px]">
        <input
          ref={inputRef}
          type="text"
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
            "w-full min-w-[180px] rounded border border-amber-400 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-amber-500 dark:bg-slate-950 dark:text-white",
            saveMutation.isPending && "opacity-70",
          )}
          aria-label={`Edit ${fieldLabel}`}
          placeholder={`Enter ${fieldLabel}`}
        />
        {error ? (
          <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <p className="mt-1 text-[11px] text-slate-400">Enter to save · Esc to cancel</p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "block max-w-[260px] truncate rounded px-1.5 py-0.5 text-left text-slate-700 transition-colors hover:bg-amber-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-amber-500/10 dark:hover:text-white",
        !value && "text-slate-400 italic dark:text-slate-500",
      )}
      title={value ? `${value} (click to edit)` : `Click to add ${fieldLabel}`}
    >
      {value || "Click to edit"}
    </button>
  );
}
