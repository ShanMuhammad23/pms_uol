"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEmployeeAssignedForms } from "@/lib/queries/form-submissions-client";
import { cn } from "@/lib/utils";

interface FormAssignmentCellProps {
  employeeId: string;
  employeeName: string;
  formAssigned: boolean;
  directScoreEntry?: boolean;
  selfAssessmentEnabled?: boolean;
}

export function FormAssignmentCell({
  employeeId,
  employeeName,
  formAssigned,
  directScoreEntry = false,
  selfAssessmentEnabled = true,
}: FormAssignmentCellProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["employee-assigned-forms", employeeId],
    queryFn: () => fetchEmployeeAssignedForms(employeeId),
    enabled: open && formAssigned,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  if (directScoreEntry && !formAssigned) {
    return (
      <span
        className="inline-flex items-center rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
        title="Direct Score Entry"
      >
        DS
      </span>
    );
  }

  if (!formAssigned) {
    return (
      <span
        className="inline-flex size-6 items-center justify-center rounded-md text-slate-400 dark:text-slate-500"
        title="No form assigned"
        aria-label="No form assigned"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={
          selfAssessmentEnabled
            ? "View assigned form"
            : "Will be Assessed by Manager directly"
        }
        aria-label={`View form assigned to ${employeeName}`}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-xs font-semibold transition-colors",
          selfAssessmentEnabled
            ? "size-6 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
            : "px-1.5 py-0.5 text-violet-700 hover:bg-violet-50 hover:text-violet-800 dark:text-violet-300 dark:hover:bg-violet-500/10 dark:hover:text-violet-200",
        )}
      >
        {selfAssessmentEnabled ? (
          <Check className="h-3.5 w-3.5" strokeWidth={2.75} />
        ) : (
          "MA"
        )}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            key={`assigned-form-${employeeId}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-100 flex items-center justify-center p-4"
          >
            <button
              type="button"
              aria-label="Close dialog"
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 6 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="relative w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/15 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2
                    id={titleId}
                    className="text-base font-semibold text-slate-900 dark:text-white"
                  >
                    Assigned form
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {employeeName} · {employeeId}
                  </p>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 min-h-16">
                {isLoading || isFetching ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading assigned form…
                  </div>
                ) : isError ? (
                  <div className="space-y-2">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {error instanceof Error
                        ? error.message
                        : "Failed to load assigned form."}
                    </p>
                    <button
                      type="button"
                      onClick={() => void refetch()}
                      className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
                    >
                      Try again
                    </button>
                  </div>
                ) : !data?.forms.length ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No form assignment found for the current cycle.
                  </p>
                ) : data.forms.length === 1 ? (
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {data.forms[0].title}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.forms.map((form) => (
                      <li
                        key={form.templateId}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 dark:border-white/10 dark:text-white"
                      >
                        {form.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
