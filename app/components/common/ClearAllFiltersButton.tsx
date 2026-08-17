"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, RotateCcw, X } from "lucide-react";
import { useCallback, useState } from "react";

interface ClearAllFiltersButtonProps {
  /** Whether any filter is currently active across any source. */
  hasActiveFilters: boolean;
  /** Called when the user confirms clearing all filters. */
  onClearAllFilters: () => void;
  /** Optional label override. Defaults to "Clear All Filters". */
  label?: string;
}

export function ClearAllFiltersButton({
  hasActiveFilters,
  onClearAllFilters,
  label = "Clear All Filters",
}: ClearAllFiltersButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleConfirm = useCallback(() => {
    onClearAllFilters();
    setModalOpen(false);
  }, [onClearAllFilters]);

  if (!hasActiveFilters) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg mr-12 border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5"
        title="Reset all filters and show the complete dataset"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {label}
      </button>

      <AnimatePresence>
        {modalOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalOpen(false)}
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
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Clear All Filters
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 px-5 py-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  This will remove all currently applied filters and display the
                  complete dataset.
                </p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Do you want to continue?
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  Clear Filters
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
