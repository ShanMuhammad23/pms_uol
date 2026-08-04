"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Columns3, GripVertical, Pin, PinOff, RotateCcw, X } from "lucide-react";
import {
  MIN_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  type ColumnDef,
} from "@/app/hooks/use-column-config";
import type { ColumnConfig } from "@/lib/queries/column-widths-client";
import { cn } from "@/lib/utils";

interface ColumnManagementPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: readonly ColumnDef[];
  config: ColumnConfig;
  defaults: ColumnConfig;
  onApply: (next: ColumnConfig) => void;
  onReset: () => void;
}

interface DraftColumn {
  id: string;
  label: string;
  pinned: boolean;
  visible: boolean;
  frozen: boolean;
}

function buildDraft(
  columns: readonly ColumnDef[],
  config: ColumnConfig,
): DraftColumn[] {
  const visibleSet = new Set(config.visible);
  const frozenSet = new Set(config.frozen);
  const orderIndex = new Map(config.order.map((id, i) => [id, i]));

  const sorted = [...columns].sort((a, b) => {
    const ai = orderIndex.get(a.id) ?? 9999;
    const bi = orderIndex.get(b.id) ?? 9999;
    return ai - bi;
  });

  return sorted.map((col) => ({
    id: col.id,
    label: col.label,
    pinned: col.pinned ?? false,
    visible: visibleSet.has(col.id),
    frozen: frozenSet.has(col.id),
  }));
}

function draftToConfig(draft: DraftColumn[], prev: ColumnConfig): ColumnConfig {
  return {
    order: draft.map((d) => d.id),
    visible: draft.filter((d) => d.visible).map((d) => d.id),
    frozen: draft.filter((d) => d.frozen && d.visible).map((d) => d.id),
    widths: prev.widths,
  };
}

export function ColumnManagementPanelTrigger({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenChange(!open)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.04]"
      aria-expanded={open}
    >
      <Columns3 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
      Columns
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 text-slate-400 transition-transform duration-300",
          open && "rotate-180",
        )}
      />
    </button>
  );
}

export function ColumnManagementPanel({
  open,
  onOpenChange,
  columns,
  config,
  defaults,
  onApply,
  onReset,
}: ColumnManagementPanelProps) {
  const [draft, setDraft] = useState<DraftColumn[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(buildDraft(columns, config));
    }
  }, [open, columns, config]);

  const toggleVisible = (id: string) => {
    setDraft((current) =>
      current.map((d) =>
        d.id === id && !d.pinned
          ? { ...d, visible: !d.visible, frozen: !d.visible ? false : d.frozen }
          : d,
      ),
    );
  };

  const toggleFrozen = (id: string) => {
    setDraft((current) =>
      current.map((d) =>
        d.id === id && d.visible
          ? { ...d, frozen: !d.frozen }
          : d,
      ),
    );
  };

  const showAll = () => {
    setDraft((current) =>
      current.map((d) => ({ ...d, visible: true })),
    );
  };

  const hideAll = () => {
    setDraft((current) =>
      current.map((d) => (d.pinned ? d : { ...d, visible: false, frozen: false })),
    );
  };

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    const from = dragIndexRef.current;
    if (from == null || from === index) {
      dragIndexRef.current = null;
      setDragOverIndex(null);
      return;
    }

    setDraft((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });

    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  const handleApply = () => {
    onApply(draftToConfig(draft, config));
    onOpenChange(false);
  };

  const handleReset = () => {
    const defaultDraft = buildDraft(columns, defaults);
    setDraft(defaultDraft);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const visibleCount = draft.filter((d) => d.visible).length;
  const frozenCount = draft.filter((d) => d.frozen && d.visible).length;

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="column-management-panel"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden border-b border-slate-200/80 bg-white dark:border-white/5 dark:bg-slate-950/40"
        >
          <div className="px-5 pb-5 pt-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Columns3 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Column Management
                </p>
                <span className="text-xs text-slate-400">
                  {visibleCount} visible · {frozenCount} frozen
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={showAll}
                  className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
                >
                  Show all
                </button>
                <button
                  type="button"
                  onClick={hideAll}
                  className="text-xs font-medium text-slate-600 hover:underline dark:text-slate-300"
                >
                  Hide all
                </button>
              </div>
            </div>

            <div className="mb-2 flex items-center gap-4 px-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1">
                <Pin className="h-3 w-3" />
                Freeze
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded border border-slate-300" />
                Show
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200/80 p-1.5 dark:border-white/10">
              <div className="grid gap-1 [grid-template-columns:repeat(auto-fill,minmax(155px,1fr))]">
                {draft.map((col, index) => (
                  <div
                    key={col.id}
                    draggable={!col.pinned}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2 py-1.5 transition",
                      dragOverIndex === index && "ring-2 ring-amber-400/50",
                      !col.visible && "opacity-50",
                      col.pinned
                        ? "cursor-default bg-slate-50 dark:bg-slate-900/50"
                        : "cursor-grab hover:bg-slate-50 dark:hover:bg-white/[0.03] active:cursor-grabbing",
                    )}
                  >
                    <div className="flex shrink-0 items-center justify-center">
                      {col.pinned ? (
                        <span className="text-[10px] text-slate-300" title="Pinned column">
                          ●
                        </span>
                      ) : (
                        <GripVertical className="h-3.5 w-3.5 text-slate-400" />
                      )}
                    </div>

                    <span
                      className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-300"
                      title={col.label}
                    >
                      <span className="mr-1 text-[12px] font-semibold text-orange-600 dark:text-slate-500 tabular-nums">
                        {index + 1}.
                      </span>
                      {col.label}
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleFrozen(col.id)}
                      disabled={!col.visible || col.pinned}
                      className={cn(
                        "flex shrink-0 items-center justify-center rounded p-1 transition-colors disabled:opacity-30",
                        col.frozen
                          ? "text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                          : "text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5",
                      )}
                      title={col.frozen ? "Unfreeze column" : "Freeze column"}
                      aria-label={col.frozen ? `Unfreeze ${col.label}` : `Freeze ${col.label}`}
                    >
                      {col.frozen ? (
                        <Pin className="h-3.5 w-3.5" />
                      ) : (
                        <PinOff className="h-3.5 w-3.5" />
                      )}
                    </button>

                    <label className="flex shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={col.visible}
                        disabled={col.pinned}
                        onChange={() => toggleVisible(col.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Show ${col.label}`}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.04]"
              >
                <RotateCcw className="h-3 w-3" />
                Reset to Default
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.04]"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500"
                >
                  Apply Changes
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
