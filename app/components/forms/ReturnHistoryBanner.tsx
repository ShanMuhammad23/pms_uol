"use client";

import { RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReturnHistoryEntry, ReturnLevel } from "@/types/form-submissions";
import { cn } from "@/lib/utils";

interface ReturnHistoryBannerProps {
  /** Full return history. The component filters by level based on `view`. */
  returnHistory: ReturnHistoryEntry[];
  /**
   * "employee" — show returns to employee and manager 1 only.
   * "manager" — show returns to employee, manager 1, and manager 2.
   */
  view: "employee" | "manager";
}

const LEVEL_LABELS: Record<ReturnLevel, string> = {
  employee: "Employee",
  manager1: "Manager 1",
  manager2: "Manager 2",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function ReturnHistoryBanner({
  returnHistory,
  view,
}: ReturnHistoryBannerProps) {
  const visibleLevels: ReturnLevel[] =
    view === "employee"
      ? ["employee", "manager1"]
      : ["employee", "manager1", "manager2"];

  // Group entries by level
  const grouped = new Map<ReturnLevel, ReturnHistoryEntry[]>();
  for (const level of visibleLevels) {
    grouped.set(level, []);
  }
  for (const entry of returnHistory) {
    if (visibleLevels.includes(entry.returnLevel)) {
      const list = grouped.get(entry.returnLevel) ?? [];
      list.push(entry);
      grouped.set(entry.returnLevel, list);
    }
  }

  // If no returns at all for visible levels, don't render.
  const totalVisible = visibleLevels.reduce(
    (sum, level) => sum + (grouped.get(level)?.length ?? 0),
    0,
  );
  if (totalVisible === 0) return null;

  return (
    <div className="no-print rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <RotateCcw className="size-4" />
          Returns
        </div>
        {visibleLevels.map((level) => {
          const entries = grouped.get(level) ?? [];
          if (entries.length === 0) return null;
          return (
            <ReturnLevelGroup
              key={level}
              level={level}
              entries={entries}
            />
          );
        })}
      </div>
    </div>
  );
}

function ReturnLevelGroup({
  level,
  entries,
}: {
  level: ReturnLevel;
  entries: ReturnHistoryEntry[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
        {LEVEL_LABELS[level]}:
      </span>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums transition-colors",
          "bg-amber-200/70 text-amber-900 hover:bg-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60",
        )}
        aria-expanded={expanded}
        aria-label={`Show return reasons for ${LEVEL_LABELS[level]}`}
      >
        {entries.length}
        {expanded ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="order-last ml-0 w-full overflow-hidden"
          >
            <ul className="mt-2 space-y-1.5">
              {entries.map((entry, idx) => (
                <li
                  key={entry.id}
                  className="rounded-md border border-amber-200/60 bg-white/70 px-3 py-2 text-xs dark:border-amber-800/30 dark:bg-slate-900/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-amber-800 dark:text-amber-300">
                      Return #{entries.length - idx}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {formatDate(entry.returnedAt)}
                      {entry.returnedByName
                        ? ` · ${entry.returnedByName}`
                        : ""}
                    </span>
                  </div>
                  {entry.returnReason ? (
                    <p className="mt-1 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {entry.returnReason}
                    </p>
                  ) : (
                    <p className="mt-1 italic text-slate-400">No reason provided.</p>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
