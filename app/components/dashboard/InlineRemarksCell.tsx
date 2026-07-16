"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/app/queries/keys";
import { updateSubmissionRemarksEvaluation } from "@/lib/queries/form-submissions-client";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { cn } from "@/lib/utils";

interface InlineRemarksCellProps {
  submissionId: number;
  value: string | null;
  disabled?: boolean;
}

export function InlineRemarksCell({
  submissionId,
  value,
  disabled = false,
}: InlineRemarksCellProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const committingRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(value ?? "");
    }
  }, [editing, value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const saveMutation = useMutation({
    mutationFn: (nextValue: string | null) =>
      updateSubmissionRemarksEvaluation(submissionId, nextValue),
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
            row.id === submissionId
              ? { ...row, remarksEvaluation: nextValue }
              : row,
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
          : "Failed to save remarks.",
      );
      setEditing(true);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<FormSubmissionListItem[]>(
        queryKeys.formSubmissions,
        (current) =>
          current?.map((row) =>
            row.id === result.id
              ? { ...row, remarksEvaluation: result.remarksEvaluation }
              : row,
          ),
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
              cancel();
            }
          }}
          className={cn(
            "w-full min-w-[180px] rounded border border-amber-400 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-amber-500 dark:bg-slate-950 dark:text-white",
            saveMutation.isPending && "opacity-70",
          )}
          aria-label="Edit evaluation remarks"
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
      title={value ? `${value} (click to edit)` : "Click to add remarks"}
    >
      {value || "Click to edit"}
    </button>
  );
}
