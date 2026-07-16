"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Columns3 } from "lucide-react";
import {
  DASHBOARD_TABLE_COLUMN_STORAGE_KEY,
  PINNED_DASHBOARD_TABLE_COLUMNS,
  TOGGLEABLE_DASHBOARD_TABLE_COLUMNS,
  getDefaultColumnOrder,
  getDefaultVisibleColumnIds,
  type DashboardTableColumnId,
} from "@/app/helpers/dashboard-table-columns";
import { cn } from "@/lib/utils";

type StoredColumnPrefs = {
  version: 2;
  order: DashboardTableColumnId[];
  visible: DashboardTableColumnId[];
};

function normalizeOrder(order: DashboardTableColumnId[]): DashboardTableColumnId[] {
  const defaults = getDefaultColumnOrder();
  const allowed = new Set(defaults);
  const seen = new Set<DashboardTableColumnId>();
  const next: DashboardTableColumnId[] = [];

  for (const id of [...order, ...defaults]) {
    if (!allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }

  return next;
}

function normalizeVisible(
  visible: DashboardTableColumnId[],
): DashboardTableColumnId[] {
  const defaults = getDefaultVisibleColumnIds();
  const allowed = new Set(defaults);
  const pinned = PINNED_DASHBOARD_TABLE_COLUMNS.map((column) => column.id);
  const toggleable = visible.filter(
    (id) =>
      allowed.has(id) &&
      !PINNED_DASHBOARD_TABLE_COLUMNS.some((column) => column.id === id),
  );

  return Array.from(new Set([...pinned, ...toggleable]));
}

function readStoredPrefs(): {
  order: DashboardTableColumnId[];
  visible: DashboardTableColumnId[];
} | null {
  try {
    const raw = localStorage.getItem(DASHBOARD_TABLE_COLUMN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      const visible = parsed.filter(
        (value): value is DashboardTableColumnId => typeof value === "string",
      );
      return {
        order: getDefaultColumnOrder(),
        visible: normalizeVisible(visible),
      };
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      "version" in parsed &&
      (parsed as StoredColumnPrefs).version === 2
    ) {
      const prefs = parsed as StoredColumnPrefs;
      return {
        order: normalizeOrder(
          Array.isArray(prefs.order)
            ? prefs.order.filter(
                (value): value is DashboardTableColumnId =>
                  typeof value === "string",
              )
            : [],
        ),
        visible: normalizeVisible(
          Array.isArray(prefs.visible)
            ? prefs.visible.filter(
                (value): value is DashboardTableColumnId =>
                  typeof value === "string",
              )
            : [],
        ),
      };
    }

    return null;
  } catch {
    return null;
  }
}

function moveIdToPosition(
  order: DashboardTableColumnId[],
  id: DashboardTableColumnId,
  position: number,
): DashboardTableColumnId[] {
  const max = order.length;
  const target = Math.min(max, Math.max(1, Math.round(position)));
  const without = order.filter((item) => item !== id);
  without.splice(target - 1, 0, id);
  return without;
}

export function useDashboardColumnVisibility() {
  const [visibleIds, setVisibleIds] = useState<DashboardTableColumnId[]>(
    getDefaultVisibleColumnIds,
  );
  const [columnOrder, setColumnOrder] = useState<DashboardTableColumnId[]>(
    getDefaultColumnOrder,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredPrefs();
    if (stored) {
      setVisibleIds(
        stored.visible.length > 0
          ? stored.visible
          : getDefaultVisibleColumnIds(),
      );
      setColumnOrder(stored.order);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: StoredColumnPrefs = {
      version: 2,
      order: columnOrder,
      visible: visibleIds,
    };
    localStorage.setItem(
      DASHBOARD_TABLE_COLUMN_STORAGE_KEY,
      JSON.stringify(payload),
    );
  }, [visibleIds, columnOrder, hydrated]);

  const toggleColumn = (id: DashboardTableColumnId) => {
    if (PINNED_DASHBOARD_TABLE_COLUMNS.some((column) => column.id === id)) {
      return;
    }

    setVisibleIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      return [...current, id];
    });
  };

  const showAll = () => setVisibleIds(getDefaultVisibleColumnIds());

  const hideAll = () =>
    setVisibleIds(PINNED_DASHBOARD_TABLE_COLUMNS.map((column) => column.id));

  const setColumnPosition = (
    id: DashboardTableColumnId,
    position: number,
  ) => {
    setColumnOrder((current) =>
      normalizeOrder(moveIdToPosition(current, id, position)),
    );
  };

  const isVisible = (id: DashboardTableColumnId) => visibleIds.includes(id);

  return {
    visibleIds,
    columnOrder,
    toggleColumn,
    showAll,
    hideAll,
    setColumnPosition,
    isVisible,
    hydrated,
  };
}

interface ColumnVisibilityDropdownProps {
  visibleIds: DashboardTableColumnId[];
  columnOrder: DashboardTableColumnId[];
  onToggle: (id: DashboardTableColumnId) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onSetColumnPosition: (id: DashboardTableColumnId, position: number) => void;
}

export function ColumnVisibilityDropdown({
  visibleIds,
  columnOrder,
  onToggle,
  onShowAll,
  onHideAll,
  onSetColumnPosition,
}: ColumnVisibilityDropdownProps) {
  const [open, setOpen] = useState(false);
  const [draftOrders, setDraftOrders] = useState<Record<string, string>>({});
  const rootRef = useRef<HTMLDivElement>(null);

  const orderedToggleable = useMemo(() => {
    const byId = new Map(
      TOGGLEABLE_DASHBOARD_TABLE_COLUMNS.map((column) => [column.id, column]),
    );
    return columnOrder
      .map((id) => byId.get(id))
      .filter((column): column is (typeof TOGGLEABLE_DASHBOARD_TABLE_COLUMNS)[number] =>
        Boolean(column),
      );
  }, [columnOrder]);

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

  useEffect(() => {
    const next: Record<string, string> = {};
    orderedToggleable.forEach((column, index) => {
      next[column.id] = String(index + 1);
    });
    setDraftOrders(next);
  }, [orderedToggleable]);

  const selectedCount = useMemo(
    () =>
      TOGGLEABLE_DASHBOARD_TABLE_COLUMNS.filter((column) =>
        visibleIds.includes(column.id),
      ).length,
    [visibleIds],
  );

  const commitOrder = (id: DashboardTableColumnId) => {
    const raw = draftOrders[id];
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      const currentIndex = columnOrder.indexOf(id);
      setDraftOrders((current) => ({
        ...current,
        [id]: String(currentIndex >= 0 ? currentIndex + 1 : 1),
      }));
      return;
    }
    onSetColumnPosition(id, parsed);
  };

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
          className="absolute right-0 z-30 mt-2 w-88 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-slate-900"
        >
          <div className="mb-2 flex items-center justify-between gap-2 px-2 py-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Visible columns
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onShowAll}
                className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={onHideAll}
                disabled={selectedCount === 0}
                className="text-xs font-medium text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline dark:text-slate-300"
              >
                Unselect all
              </button>
            </div>
          </div>
          <div className="mb-1 grid grid-cols-[2.5rem_1fr] gap-2 px-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">
            <span>Order</span>
            <span>Column</span>
          </div>
          <ul className="max-h-80 space-y-0.5 overflow-y-auto">
            {orderedToggleable.map((column, index) => {
              const checked = visibleIds.includes(column.id);
              return (
                <li key={column.id}>
                  <div
                    className={cn(
                      "grid grid-cols-[2.5rem_1fr] items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition",
                      checked
                        ? "bg-amber-50 text-slate-900 dark:bg-amber-950/30 dark:text-slate-100"
                        : "text-slate-600 dark:text-slate-300",
                    )}
                  >
                    <input
                      type="number"
                      min={1}
                      max={orderedToggleable.length}
                      value={draftOrders[column.id] ?? String(index + 1)}
                      onChange={(event) =>
                        setDraftOrders((current) => ({
                          ...current,
                          [column.id]: event.target.value,
                        }))
                      }
                      onBlur={() => commitOrder(column.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          (event.target as HTMLInputElement).blur();
                        }
                      }}
                      className="h-7 w-10 rounded border border-slate-200 bg-white px-1 text-center text-xs tabular-nums text-slate-700 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300/50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
                      aria-label={`Order for ${column.label}`}
                    />
                    <label className="flex min-w-0 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(column.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="truncate">{column.label}</span>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
