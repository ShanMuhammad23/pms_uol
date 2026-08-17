"use client";

import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { ReturnLevel } from "@/lib/queries/form-submissions-client";

export interface ReturnSubmissionTarget {
  level: ReturnLevel;
  label: string;
  /** Display name of the assigned user, or null when unassigned. */
  userName: string | null;
  /** Whether this level is available for the current submission. */
  available: boolean;
}

interface ReturnSubmissionModalProps {
  open: boolean;
  employeeName: string;
  targets: ReturnSubmissionTarget[];
  /** Unique key to force fresh form state per submission. */
  submissionKey: string | number;
  onConfirm: (returnLevel: ReturnLevel, reason: string) => void;
  onClose: () => void;
  isPending?: boolean;
  error?: string | null;
}

export function ReturnSubmissionModal({
  open,
  employeeName,
  targets,
  submissionKey,
  onConfirm,
  onClose,
  isPending = false,
  error = null,
}: ReturnSubmissionModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <ReturnSubmissionModalInner
          key={submissionKey}
          employeeName={employeeName}
          targets={targets}
          onConfirm={onConfirm}
          onClose={onClose}
          isPending={isPending}
          error={error}
        />
      ) : null}
    </AnimatePresence>
  );
}

interface ReturnSubmissionModalInnerProps {
  employeeName: string;
  targets: ReturnSubmissionTarget[];
  onConfirm: (returnLevel: ReturnLevel, reason: string) => void;
  onClose: () => void;
  isPending?: boolean;
  error?: string | null;
}

function ReturnSubmissionModalInner({
  employeeName,
  targets,
  onConfirm,
  onClose,
  isPending = false,
  error = null,
}: ReturnSubmissionModalInnerProps) {
  // Initialize selected level to the first available target.
  // This runs once on mount (fresh each time due to the key prop).
  const [selectedLevel, setSelectedLevel] = useState<ReturnLevel | null>(() => {
    const firstAvailable = targets.find((t) => t.available);
    return firstAvailable?.level ?? null;
  });
  const [reason, setReason] = useState("");

  // Keep the selected level valid when targets change — if the currently
  // selected level becomes unavailable, fall back to the first available.
  if (selectedLevel) {
    const target = targets.find((t) => t.level === selectedLevel);
    if (target && !target.available) {
      const firstAvailable = targets.find((t) => t.available);
      setSelectedLevel(firstAvailable?.level ?? null);
    }
  }

  const reasonTrimmed = reason.trim();
  const canSubmit =
    selectedLevel != null && reasonTrimmed.length > 0 && !isPending;

  const sortedTargets = useMemo(
    () =>
      [...targets].sort((a, b) => {
        const order: ReturnLevel[] = ["manager2", "manager1", "employee"];
        return order.indexOf(a.level) - order.indexOf(b.level);
      }),
    [targets],
  );

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-white/10">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Return Submission
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
            Return the submission for{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {employeeName}
            </span>{" "}
            to which level?
          </p>

          {/* Return level selector */}
          <div className="mb-4 space-y-2">
            {sortedTargets.map((target) => {
              const isSelected = selectedLevel === target.level;
              const isDisabled = !target.available;

              return (
                <label
                  key={target.level}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                    isDisabled
                      ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-800/30"
                      : isSelected
                        ? "border-amber-400 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-900/20"
                        : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50",
                  )}
                >
                  <input
                    type="radio"
                    name="returnLevel"
                    value={target.level}
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() =>
                      !isDisabled && setSelectedLevel(target.level)
                    }
                    className="h-4 w-4 border-slate-300 text-amber-600 focus:ring-amber-500/30 disabled:opacity-40"
                  />
                  <div className="flex min-w-0 flex-1 items-center justify-between">
                    <span
                      className={cn(
                        "font-medium",
                        isDisabled
                          ? "text-slate-400 dark:text-slate-500"
                          : "text-slate-700 dark:text-slate-200",
                      )}
                    >
                      {target.label}
                    </span>
                    <span
                      className={cn(
                        "ml-2 truncate text-xs",
                        target.userName
                          ? "text-slate-500 dark:text-slate-400"
                          : "italic text-slate-400 dark:text-slate-500",
                      )}
                    >
                      {target.userName ?? "Not assigned"}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Return reason */}
          <div className="mb-1">
            <label
              htmlFor="return-reason"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              Return Reason
            </label>
            <textarea
              id="return-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
              rows={3}
              placeholder="Provide a reason for returning this submission..."
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
            />
          </div>

          {error ? (
            <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (canSubmit && selectedLevel) {
                onConfirm(selectedLevel, reasonTrimmed);
              }
            }}
            disabled={!canSubmit}
            className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "..." : "Return Submission"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
