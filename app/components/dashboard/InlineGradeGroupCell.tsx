"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/app/queries/keys";
import { updateEmployeeGradeGroup } from "@/lib/queries/form-submissions-client";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { cn } from "@/lib/utils";

interface InlineGradeGroupCellProps {
  employeeId: string;
  value: string | null;
}

export function InlineGradeGroupCell({
  employeeId,
  value,
}: InlineGradeGroupCellProps) {
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
      updateEmployeeGradeGroup(employeeId, nextValue),
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
            row.employeeId === employeeId
              ? { ...row, gradeGroup: nextValue }
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
          : "Failed to save value.",
      );
      setEditing(true);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<FormSubmissionListItem[]>(
        queryKeys.formSubmissions,
        (current) =>
          current?.map((row) =>
            row.employeeId === result.employeeId
              ? { ...row, gradeGroup: result.gradeGroup }
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

  if (editing) {
    return (
      <div className="min-w-[120px]">
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
            "w-full min-w-[120px] rounded border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-slate-300/60 dark:border-slate-500 dark:bg-slate-950 dark:text-white",
            saveMutation.isPending && "opacity-70",
          )}
          aria-label="Edit column 1"
          placeholder="Enter value"
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
        "block max-w-[180px] truncate rounded px-1.5 py-0.5 text-left text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white",
        !value && "text-slate-400 italic dark:text-slate-500",
      )}
      title={value ? `${value} (click to edit)` : "Click to enter value"}
    >
      {value || "—"}
    </button>
  );
}
