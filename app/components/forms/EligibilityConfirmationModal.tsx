"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ShieldOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface EligibilityConfirmationModalProps {
  open: boolean;
  employeeName: string;
  currentEligibility: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  isPending?: boolean;
  error?: string | null;
}

export default function EligibilityConfirmationModal({
  open,
  employeeName,
  currentEligibility,
  onConfirm,
  onClose,
  isPending = false,
  error = null,
}: EligibilityConfirmationModalProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
    }
  }, [open]);

  const isDisabling = currentEligibility;
  const reasonTrimmed = reason.trim();
  const canConfirm = !isDisabling || reasonTrimmed.length > 0;

  const handleConfirm = () => {
    if (!canConfirm || isPending) return;
    onConfirm(reasonTrimmed);
  };

  return (
    <AnimatePresence>
      {open ? (
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
                <ShieldOff className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {isDisabling
                    ? "Disable Employee Eligibility"
                    : "Enable Employee Eligibility"}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Employee
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {employeeName}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-slate-500 dark:text-slate-400">
                  Current status:
                </span>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 font-semibold",
                    currentEligibility
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
                  )}
                >
                  {currentEligibility ? "Eligible" : "Not Applicable"}
                </span>
              </div>

              {isDisabling ? (
                <div className="space-y-2">
                  <label
                    htmlFor="ineligibility-reason"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="ineligibility-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Enter the reason for disabling eligibility..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                    autoFocus
                  />
                  <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                    This reason will be visible to relevant users during assessment workflows.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Re-enabling eligibility will allow the employee to participate in
                  assessments again. The previous not applicable reason will be cleared.
                </p>
              )}

              {error ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm || isPending}
                className={cn(
                  "rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-60",
                  isDisabling
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700",
                )}
              >
                {isPending
                  ? "Processing..."
                  : isDisabling
                    ? "Confirm Disable"
                    : "Confirm Enable"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
