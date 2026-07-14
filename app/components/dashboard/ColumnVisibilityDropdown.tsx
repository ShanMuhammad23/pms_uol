"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Columns3 } from "lucide-react";
import {
  DASHBOARD_TABLE_COLUMN_STORAGE_KEY,
  TOGGLEABLE_DASHBOARD_TABLE_COLUMNS,
  getDefaultVisibleColumnIds,
  type DashboardTableColumnId,
} from "@/app/helpers/dashboard-table-columns";
import { cn } from "@/lib/utils";

function readStoredVisibility(): DashboardTableColumnId[] | null {
  try {
    const raw = localStorage.getItem(DASHBOARD_TABLE_COLUMN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((value): value is DashboardTableColumnId => typeof value === "string");
  } catch {
    return null;
  }
}

export function useDashboardColumnVisibility() {
  const [visibleIds, setVisibleIds] = useState<DashboardTableColumnId[]>(
    getDefaultVisibleColumnIds,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredVisibility();
    if (stored && stored.length > 0) {
      const defaults = getDefaultVisibleColumnIds();
      const pinned = defaults.filter(
        (id) =>
          !TOGGLEABLE_DASHBOARD_TABLE_COLUMNS.some((column) => column.id === id),
      );
      const allowed = new Set(defaults);
      const next = Array.from(
        new Set([...pinned, ...stored.filter((id) => allowed.has(id))]),
      );
      setVisibleIds(next.length > 0 ? next : defaults);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(DASHBOARD_TABLE_COLUMN_STORAGE_KEY, JSON.stringify(visibleIds));
  }, [visibleIds, hydrated]);

  const toggleColumn = (id: DashboardTableColumnId) => {
    setVisibleIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      return [...current, id];
    });
  };

  const showAll = () => setVisibleIds(getDefaultVisibleColumnIds());

  const isVisible = (id: DashboardTableColumnId) => visibleIds.includes(id);

  return { visibleIds, toggleColumn, showAll, isVisible, hydrated };
}

interface ColumnVisibilityDropdownProps {
  visibleIds: DashboardTableColumnId[];
  onToggle: (id: DashboardTableColumnId) => void;
  onShowAll: () => void;
}

export function ColumnVisibilityDropdown({
  visibleIds,
  onToggle,
  onShowAll,
}: ColumnVisibilityDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const selectedCount = useMemo(
    () =>
      TOGGLEABLE_DASHBOARD_TABLE_COLUMNS.filter((column) =>
        visibleIds.includes(column.id),
      ).length,
    [visibleIds],
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Columns3 className="h-3.5 w-3.5" />
        Columns
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-500 dark:bg-slate-800">
          {selectedCount}/{TOGGLEABLE_DASHBOARD_TABLE_COLUMNS.length}
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-slate-900"
        >
          <div className="mb-2 flex items-center justify-between px-2 py-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Visible columns
            </p>
            <button
              type="button"
              onClick={onShowAll}
              className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
            >
              Show all
            </button>
          </div>
          <ul className="max-h-80 space-y-0.5 overflow-y-auto">
            {TOGGLEABLE_DASHBOARD_TABLE_COLUMNS.map((column) => {
              const checked = visibleIds.includes(column.id);
              return (
                <li key={column.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition",
                      checked
                        ? "bg-amber-50 text-slate-900 dark:bg-amber-950/30 dark:text-slate-100"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(column.id)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="truncate">{column.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
