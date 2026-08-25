"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ClipboardCheck, X } from "lucide-react";

interface SelfAssessmentConfirmModalProps {
  open: boolean;
  /** When true, self assessment will be disabled after confirmation. */
  disabled: boolean;
  employeeName?: string;
  employeeCount?: number;
  onConfirm: () => void;
  onClose: () => void;
  isPending?: boolean;
}

export default function SelfAssessmentConfirmModal({
  open,
  disabled,
  employeeName,
  employeeCount,
  onConfirm,
  onClose,
  isPending = false,
}: SelfAssessmentConfirmModalProps) {
  const isBulk = employeeCount != null && employeeCount > 1;
  const title = disabled ? "Disable Self Assessment" : "Enable Self Assessment";

  const message = isBulk
    ? disabled
      ? `Disable self assessment for ${employeeCount} assigned employees? They will be assessed directly by their manager instead.`
      : `Enable self assessment for ${employeeCount} assigned employees? They will be able to complete their own assessment.`
    : disabled
      ? `Disable self assessment for ${employeeName}? They will be assessed directly by their manager instead.`
      : `Enable self assessment for ${employeeName}? They will be able to complete their own assessment.`;

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
                <ClipboardCheck
                  className={`h-5 w-5 ${disabled ? "text-amber-500" : "text-emerald-600"}`}
                />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {title}
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

            <div className="px-5 py-4">
              {employeeName && !isBulk ? (
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/5">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Employee
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {employeeName}
                  </span>
                </div>
              ) : null}
              <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
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
                onClick={onConfirm}
                disabled={isPending}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
                  disabled
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {isPending ? "Saving..." : disabled ? "Disable" : "Enable"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
