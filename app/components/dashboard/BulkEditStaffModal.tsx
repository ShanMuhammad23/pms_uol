"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/app/queries/keys";
import { bulkUpdateEmployeeListingFields } from "@/lib/queries/form-submissions-client";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { cn } from "@/lib/utils";

interface BulkEditStaffModalProps {
  open: boolean;
  selectedEmployeeIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkEditStaffModal({
  open,
  selectedEmployeeIds,
  onClose,
  onSuccess,
}: BulkEditStaffModalProps) {
  const queryClient = useQueryClient();
  const [roleCategory, setRoleCategory] = useState("");
  const [gradeGroup, setGradeGroup] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRoleCategory("");
      setGradeGroup("");
      setError(null);
    }
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const fields: {
        roleCategory?: string | null;
        gradeGroup?: string | null;
      } = {};

      const roleValue = roleCategory.trim();
      const gradeValue = gradeGroup.trim();

      if (roleValue) {
        fields.roleCategory = roleValue;
      }
      if (gradeValue) {
        fields.gradeGroup = gradeValue;
      }

      if (!("roleCategory" in fields) && !("gradeGroup" in fields)) {
        throw new Error("Enter a value for Role Category and/or Column 1.");
      }

      return bulkUpdateEmployeeListingFields(selectedEmployeeIds, fields);
    },
    onMutate: async () => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: queryKeys.formSubmissions });

      const previous = queryClient.getQueryData<FormSubmissionListItem[]>(
        queryKeys.formSubmissions,
      );

      const selected = new Set(selectedEmployeeIds);
      const roleValue = roleCategory.trim() || null;
      const gradeValue = gradeGroup.trim() || null;

      queryClient.setQueryData<FormSubmissionListItem[]>(
        queryKeys.formSubmissions,
        (current) =>
          current?.map((row) => {
            if (!selected.has(row.employeeId)) return row;
            return {
              ...row,
              ...(roleValue ? { roleCategory: roleValue } : {}),
              ...(gradeValue ? { gradeGroup: gradeValue } : {}),
            };
          }),
      );

      return { previous };
    },
    onError: (mutationError, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.formSubmissions, context.previous);
      }
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to apply bulk edit.",
      );
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="bulk-edit-staff-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-edit-staff-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-100 flex items-center justify-center p-4"
        >
          <motion.button
            type="button"
            aria-label="Close bulk edit dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            disabled={saveMutation.isPending}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="bulk-edit-staff-modal-title"
                  className="text-lg font-semibold text-slate-900 dark:text-white"
                >
                  Bulk edit
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Apply values to {selectedEmployeeIds.length} selected staff.
                  Leave a field blank to keep existing values.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={saveMutation.isPending}
                aria-label="Close"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-white/15 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Role Category
                </span>
                <input
                  type="text"
                  value={roleCategory}
                  onChange={(event) => setRoleCategory(event.target.value)}
                  disabled={saveMutation.isPending}
                  placeholder="Enter role category"
                  className={cn(
                    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-white",
                    saveMutation.isPending && "opacity-70",
                  )}
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Column 1
                </span>
                <input
                  type="text"
                  value={gradeGroup}
                  onChange={(event) => setGradeGroup(event.target.value)}
                  disabled={saveMutation.isPending}
                  placeholder="Enter value"
                  className={cn(
                    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-white",
                    saveMutation.isPending && "opacity-70",
                  )}
                />
              </label>
            </div>

            {error ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saveMutation.isPending}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-500"
              >
                <Pencil className="h-3.5 w-3.5" />
                {saveMutation.isPending ? "Applying..." : "Apply to selected"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
