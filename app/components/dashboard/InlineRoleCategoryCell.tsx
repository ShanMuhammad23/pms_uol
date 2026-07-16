"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/app/queries/keys";
import { updateEmployeeRoleCategory } from "@/lib/queries/form-submissions-client";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { cn } from "@/lib/utils";

interface InlineRoleCategoryCellProps {
  employeeId: string;
  value: string | null;
}

export function InlineRoleCategoryCell({
  employeeId,
  value,
}: InlineRoleCategoryCellProps) {
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
      updateEmployeeRoleCategory(employeeId, nextValue),
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
              ? { ...row, roleCategory: nextValue }
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
          : "Failed to save role category.",
      );
      setEditing(true);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<FormSubmissionListItem[]>(
        queryKeys.formSubmissions,
        (current) =>
          current?.map((row) =>
            row.employeeId === result.employeeId
              ? { ...row, roleCategory: result.roleCategory }
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
      <div className="min-w-[140px]">
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
            "w-full min-w-[140px] rounded border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-slate-300/60 dark:border-slate-500 dark:bg-slate-950 dark:text-white",
            saveMutation.isPending && "opacity-70",
          )}
          aria-label="Edit role category"
          placeholder="Enter role category"
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
        "block max-w-[220px] truncate rounded px-1.5 py-0.5 text-left text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white",
        !value && "text-slate-400 italic dark:text-slate-500",
      )}
      title={value ? `${value} (click to edit)` : "Click to enter role category"}
    >
      {value || "—"}
    </button>
  );
}
