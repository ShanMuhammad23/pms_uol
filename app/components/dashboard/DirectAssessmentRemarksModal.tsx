"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageSquareText, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import OverallRemarksSection from "@/app/components/forms/OverallRemarksSection";

export interface DirectAssessmentRemarksModalValue {
  manager1: string;
  manager2: string;
}

interface DirectAssessmentRemarksModalProps {
  open: boolean;
  employeeName: string;
  employeeId: string;
  managerLevel: number | null;
  manager2UserId: number | null;
  /** Whether the current user can edit this submission's remarks. */
  canEdit: boolean;
  /** Initial remarks shown when the modal opens. */
  initialRemarks: DirectAssessmentRemarksModalValue;
  /** Whether the form template has additional_remarks_enabled = TRUE. */
  additionalRemarksEnabled: boolean;
  onClose: () => void;
  onSave: (value: DirectAssessmentRemarksModalValue) => void;
  isPending?: boolean;
}

/**
 * Reusable modal that wraps the existing OverallRemarksSection so Direct
 * Assessment can present Additional Remarks compactly without duplicating the
 * rendering, validation, or business logic. The save path is delegated to the
 * parent, which calls the same saveDirectAssessmentScores API used by the
 * inline flow — no new endpoints or DB fields.
 */
export default function DirectAssessmentRemarksModal({
  open,
  employeeName,
  employeeId,
  managerLevel,
  manager2UserId,
  canEdit,
  initialRemarks,
  additionalRemarksEnabled,
  onClose,
  onSave,
  isPending = false,
}: DirectAssessmentRemarksModalProps) {
  const isManager1 = (managerLevel ?? 1) === 1;
  const isManager2 = (managerLevel ?? 1) === 2;

  const [manager1, setManager1] = useState(initialRemarks.manager1);
  const [manager2, setManager2] = useState(initialRemarks.manager2);

  // Reset the local draft whenever the modal is (re)opened so it always
  // reflects the latest persisted state.
  useEffect(() => {
    if (open) {
      setManager1(initialRemarks.manager1);
      setManager2(initialRemarks.manager2);
    }
    // We intentionally only re-seed on open transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = () => {
    if (isPending) return;
    onSave({ manager1, manager2 });
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
            className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-white/10">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                <div className="flex flex-col">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Additional Remarks
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {employeeName} ({employeeId}) — Manager {managerLevel ?? 1}
                    {canEdit ? "" : " · read-only"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              {additionalRemarksEnabled ? (
                <OverallRemarksSection
                  enabled={additionalRemarksEnabled}
                  manager1Remarks={manager1}
                  manager2Remarks={manager2}
                  hasManager2={manager2UserId != null}
                  canEditManager1={canEdit && isManager1}
                  canEditManager2={canEdit && isManager2}
                  onManager1Change={canEdit && isManager1 ? setManager1 : undefined}
                  onManager2Change={canEdit && isManager2 ? setManager2 : undefined}
                />
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Additional Remarks are not enabled for this form.
                </p>
              )}
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
                onClick={handleSave}
                disabled={isPending || !canEdit}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-60",
                  "bg-violet-600 hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-800",
                )}
              >
                <Save className="h-3.5 w-3.5" />
                {isPending ? "Saving..." : "Save Remarks"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
