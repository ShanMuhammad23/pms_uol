"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ExportColumnDef } from "@/app/helpers/excel-export-service";
import { cn } from "@/lib/utils";

interface ExportColumnSelectorModalProps<T> {
  open: boolean;
  onClose: () => void;
  columns: readonly ExportColumnDef<T>[];
  onExport: (selectedColumns: ExportColumnDef<T>[]) => void;
  title?: string;
  description?: string;
  /** Number of records that will be exported. */
  recordCount: number;
  /** Label for the scope of records, e.g. "3 selected records" or "250 filtered records". */
  scopeLabel: string;
  /** localStorage key for persisting column selection. */
  storageKey?: string;
  isExporting?: boolean;
}

export function ExportColumnSelectorModal<T>({
  open,
  onClose,
  columns,
  onExport,
  title = "Export Excel",
  description = "Select columns to include in the export.",
  recordCount,
  scopeLabel,
  storageKey,
  isExporting = false,
}: ExportColumnSelectorModalProps<T>) {
  const allIds = useMemo(() => columns.map((c) => c.id), [columns]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() =>
    new Set(allIds),
  );

  useEffect(() => {
    if (!open) return;

    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as string[];
          const valid = parsed.filter((id) => allIds.includes(id));
          if (valid.length > 0) {
            setSelectedIds(new Set(valid));
            return;
          }
        }
      } catch {
        // ignore parse errors
      }
    }
    setSelectedIds(new Set(allIds));
  }, [open, storageKey, allIds]);

  const toggleColumn = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => setSelectedIds(new Set(allIds));

  const handleClearAll = () => setSelectedIds(new Set());

  const handleExport = () => {
    const selected = columns.filter((col) => selectedIds.has(col.id));
    if (selected.length === 0) return;

    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify([...selectedIds]));
      } catch {
        // ignore storage errors
      }
    }

    onExport(selected);
  };

  const allSelected = selectedIds.size === allIds.length;
  const noneSelected = selectedIds.size === 0;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="export-column-selector-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-column-selector-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-100 flex items-center justify-center p-4"
        >
          <motion.button
            type="button"
            aria-label="Close export dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            disabled={isExporting}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="export-column-selector-title"
                  className="text-lg font-semibold text-slate-900 dark:text-white"
                >
                  {title}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {description}
                </p>
                <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {scopeLabel} ({recordCount} record{recordCount !== 1 ? "s" : ""})
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={isExporting}
                aria-label="Close"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-white/15 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-white/5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Select Columns
                  <span className="ml-1.5 text-slate-400 dark:text-slate-500">
                    ({selectedIds.size}/{allIds.length})
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    disabled={allSelected}
                    className="text-xs font-semibold text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline dark:text-slate-300"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={noneSelected}
                    className="text-xs font-semibold text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline dark:text-slate-300"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 dark:border-white/10 dark:bg-slate-950">
                {columns.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                    No columns available for export.
                  </p>
                ) : (
                  <div className="grid gap-1 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
                    {columns.map((col) => {
                      const checked = selectedIds.has(col.id);
                      return (
                        <label
                          key={col.id}
                          className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                              checked
                                ? "border-amber-500 bg-amber-500 text-white"
                                : "border-slate-300 dark:border-white/20",
                            )}
                          >
                            {checked ? (
                              <Check className="h-3 w-3" strokeWidth={3} />
                            ) : null}
                          </span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleColumn(col.id)}
                            className="sr-only"
                          />
                          <span className="min-w-0 flex-1 truncate" title={col.label}>
                            {col.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isExporting}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={noneSelected || isExporting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-amber-600 dark:hover:bg-amber-500"
              >
                <Download className="h-4 w-4" />
                {isExporting
                  ? "Exporting..."
                  : `Export (${selectedIds.size})`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
