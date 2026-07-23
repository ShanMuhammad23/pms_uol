"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Eye, EyeOff, Filter, RotateCcw, Search } from "lucide-react";
import {
  MultiSelectFilterDropdown,
  type MultiSelectOption,
} from "@/app/components/dashboard/MultiSelectFilterDropdown";
import {
  MASTER_FILTER_SECTIONS,
  buildMasterFilterOptions,
  countActiveMasterFilters,
  isMasterFilterTextColumn,
  type MasterFilterMultiSelection,
  type MasterFilterState,
  type MasterFilterTextColumnId,
} from "@/app/helpers/dashboard-master-filters";
import {
  PINNED_DASHBOARD_TABLE_COLUMNS,
  type DashboardTableColumnId,
} from "@/app/helpers/dashboard-table-columns";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { cn } from "@/lib/utils";

interface StaffListingMasterFilterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissions: FormSubmissionListItem[];
  allSubmissions?: FormSubmissionListItem[];
  filters: MasterFilterState;
  onTextChange: (columnId: MasterFilterTextColumnId, next: string) => void;
  onMultiChange: (
    columnId: DashboardTableColumnId,
    next: MasterFilterMultiSelection,
  ) => void;
  onClearAll: () => void;
  visibleIds: DashboardTableColumnId[];
  columnOrder: DashboardTableColumnId[];
  onToggleColumn: (id: DashboardTableColumnId) => void;
  onShowAllColumns: () => void;
  onHideAllColumns: () => void;
  onSetColumnPosition: (id: DashboardTableColumnId, position: number) => void;
  allowedColumnIds?: readonly DashboardTableColumnId[];
}

function TextFilterControl({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-200/80 bg-white/90 py-1.5 pl-8 pr-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-300/50 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-600/40"
      />
    </div>
  );
}

function ColumnFilterRow({
  columnId,
  label,
  orderValue,
  orderMax,
  visible,
  pinned,
  onToggleVisible,
  onOrderChange,
  onOrderCommit,
  children,
}: {
  columnId: DashboardTableColumnId;
  label: string;
  orderValue: string;
  orderMax: number;
  visible: boolean;
  pinned: boolean;
  onToggleVisible: () => void;
  onOrderChange: (next: string) => void;
  onOrderCommit: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border border-slate-200/70 bg-white/80 p-2 dark:border-white/10 dark:bg-slate-950/40",
        !visible && "opacity-60",
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <label
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5",
            pinned ? "cursor-default opacity-60" : "cursor-pointer",
          )}
          title={
            pinned
              ? "Pinned column (always visible)"
              : visible
                ? "Hide column"
                : "Show column"
          }
        >
          <input
            type="checkbox"
            checked={visible}
            disabled={pinned}
            onChange={onToggleVisible}
            className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 disabled:cursor-not-allowed"
            aria-label={`Show ${label} column`}
          />
          {visible ? (
            <Eye className="h-3 w-3 text-slate-400" aria-hidden />
          ) : (
            <EyeOff className="h-3 w-3 text-slate-400" aria-hidden />
          )}
        </label>

        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-600 dark:text-slate-300">
          {label}
        </span>

        <label className="inline-flex shrink-0 items-center gap-1 text-[10px] text-slate-400">
          <span className="sr-only">Display order for {label}</span>
          <span aria-hidden>Order</span>
          <input
            type="number"
            min={1}
            max={orderMax}
            value={orderValue}
            onChange={(event) => onOrderChange(event.target.value)}
            onBlur={onOrderCommit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                (event.target as HTMLInputElement).blur();
              }
            }}
            className="h-6 w-10 rounded border border-slate-200 bg-white px-1 text-center text-xs tabular-nums text-slate-700 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300/50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
            aria-label={`Display order for ${label}`}
            data-column-id={columnId}
          />
        </label>
      </div>
      {children}
    </div>
  );
}

export function StaffListingMasterFilterTrigger({
  open,
  onOpenChange,
  activeCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenChange(!open)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.04]"
      aria-expanded={open}
    >
      <Filter className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
      Master filter
      {activeCount > 0 ? (
        <span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-700 dark:bg-white/10 dark:text-slate-200">
          {activeCount}
        </span>
      ) : null}
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 text-slate-400 transition-transform duration-300",
          open && "rotate-180",
        )}
      />
    </button>
  );
}

export function StaffListingMasterFilter({
  open,
  onOpenChange,
  submissions,
  allSubmissions,
  filters,
  onTextChange,
  onMultiChange,
  onClearAll,
  visibleIds,
  columnOrder,
  onToggleColumn,
  onShowAllColumns,
  onHideAllColumns,
  onSetColumnPosition,
  allowedColumnIds,
}: StaffListingMasterFilterProps) {
  const activeCount = countActiveMasterFilters(filters);
  const [draftOrders, setDraftOrders] = useState<Record<string, string>>({});

  const filterSections = useMemo(() => {
    if (!allowedColumnIds) {
      return MASTER_FILTER_SECTIONS;
    }

    const allowed = new Set(allowedColumnIds);
    return MASTER_FILTER_SECTIONS.map((section) => ({
      ...section,
      columns: section.columns.filter((column) => allowed.has(column.id)),
    })).filter((section) => section.columns.length > 0);
  }, [allowedColumnIds]);

  const orderIndexById = useMemo(() => {
    const map = new Map<DashboardTableColumnId, number>();
    columnOrder.forEach((id, index) => {
      map.set(id, index + 1);
    });
    return map;
  }, [columnOrder]);

  const orderMax = Math.max(columnOrder.length, 1);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const id of columnOrder) {
      next[id] = String(orderIndexById.get(id) ?? 1);
    }
    setDraftOrders(next);
  }, [columnOrder, orderIndexById]);

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, MultiSelectOption[]>();

    for (const section of filterSections) {
      for (const column of section.columns) {
        if (isMasterFilterTextColumn(column.id)) continue;

        map.set(
          column.id,
          buildMasterFilterOptions(
            submissions,
            column,
            filters,
            filters.multi[column.id] ?? null,
            allSubmissions,
          ),
        );
      }
    }

    return map;
  }, [allSubmissions, filterSections, filters, submissions]);

  const visibleToggleableCount = useMemo(
    () =>
      columnOrder.filter((id) => {
        const pinned = PINNED_DASHBOARD_TABLE_COLUMNS.some(
          (column) => column.id === id,
        );
        return !pinned && visibleIds.includes(id);
      }).length,
    [columnOrder, visibleIds],
  );

  const commitOrder = (id: DashboardTableColumnId) => {
    const raw = draftOrders[id];
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setDraftOrders((current) => ({
        ...current,
        [id]: String(orderIndexById.get(id) ?? 1),
      }));
      return;
    }
    onSetColumnPosition(id, parsed);
  };

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="master-filter-panel"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden border-b border-slate-200/80 
           dark:border-white/5 dark:bg-slate-950/40 bg-white"
        >
          <div className="px-5 pb-5 pt-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Filter values, toggle column visibility, and set display order.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onShowAllColumns}
                  className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
                >
                  Show all columns
                </button>
                <button
                  type="button"
                  onClick={onHideAllColumns}
                  disabled={visibleToggleableCount === 0}
                  className="text-xs font-medium text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline dark:text-slate-300"
                >
                  Hide all columns
                </button>
                {activeCount > 0 ? (
                  <button
                    type="button"
                    onClick={onClearAll}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Clear filters
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
              {filterSections.map((section) => (
                <section
                  key={section.id}
                  className="min-w-0 rounded-lg border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-slate-900/50"
                >
                  <h3 className="mb-3 border-b border-slate-200/80 pb-2 text-xs font-semibold uppercase tracking-wider text-primary dark:border-white/10">
                    {section.label}
                  </h3>
                  <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {section.columns.map((column) => {
                      const pinned = Boolean(column.pinned);
                      const visible = visibleIds.includes(column.id);

                      return (
                        <ColumnFilterRow
                          key={column.id}
                          columnId={column.id}
                          label={column.label}
                          orderValue={
                            draftOrders[column.id] ??
                            String(orderIndexById.get(column.id) ?? 1)
                          }
                          orderMax={orderMax}
                          visible={visible}
                          pinned={pinned}
                          onToggleVisible={() => onToggleColumn(column.id)}
                          onOrderChange={(next) =>
                            setDraftOrders((current) => ({
                              ...current,
                              [column.id]: next,
                            }))
                          }
                          onOrderCommit={() => commitOrder(column.id)}
                        >
                          {isMasterFilterTextColumn(column.id) ? (
                            <TextFilterControl
                              value={
                                filters.text[
                                  column.id as MasterFilterTextColumnId
                                ] ?? ""
                              }
                              placeholder={`Search ${column.label.toLowerCase()}...`}
                              onChange={(next) =>
                                onTextChange(
                                  column.id as MasterFilterTextColumnId,
                                  next,
                                )
                              }
                            />
                          ) : (
                            <MultiSelectFilterDropdown
                              label={column.label}
                              options={optionsByColumn.get(column.id) ?? []}
                              selectedValues={filters.multi[column.id] ?? null}
                              onChange={(next) =>
                                onMultiChange(column.id, next)
                              }
                              placeholder="All"
                              searchable={
                                (optionsByColumn.get(column.id) ?? []).length >
                                8
                              }
                              quiet
                              className="min-w-0 flex-none [&_label]:sr-only"
                            />
                          )}
                        </ColumnFilterRow>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function getMasterFilterActiveCount(filters: MasterFilterState): number {
  return countActiveMasterFilters(filters);
}
