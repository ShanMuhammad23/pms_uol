"use client";

import { useMemo, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Filter,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  MultiSelectFilterDropdown,
  type MultiSelectOption,
} from "@/app/components/dashboard/MultiSelectFilterDropdown";
import { NumericRangeFilterControls } from "@/app/components/common/NumericRangeFilterControls";
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
  type DashboardColumnSectionId,
  type DashboardTableColumnId,
} from "@/app/helpers/dashboard-table-columns";
import type { NumericRangeFilter } from "@/app/helpers/numeric-range-filter";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { cn } from "@/lib/utils";

const SECTION_STYLE: Record<DashboardColumnSectionId, string> = {
  basic:
    "bg-slate-100 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/50",
  performance:
    "bg-emerald-100 border-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-700/50",
  compensation:
    "bg-amber-100 border-amber-200 dark:bg-amber-900/40 dark:border-amber-700/50",
};

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
  onNumericChange?: (
    columnId: DashboardTableColumnId,
    filter: NumericRangeFilter | undefined,
  ) => void;
  onClearAll: () => void;
  allowedColumnIds?: readonly DashboardTableColumnId[];
}

function TextFilterControl({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="block truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {label}
      </label>
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
    </div>
  );
}

function ColumnFilterRow({
  columnId,
  children,
}: {
  columnId: DashboardTableColumnId;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border border-slate-200/70 bg-white/80 p-2 dark:border-white/10 dark:bg-slate-950/40",
      )}
    >
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
  onNumericChange,
  onClearAll,
  allowedColumnIds,
}: StaffListingMasterFilterProps) {
  const activeCount = countActiveMasterFilters(filters);

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
                Filter values for the staff listing.
              </p>
              <div className="flex flex-wrap items-center gap-3">
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
                  className={cn(
                    "min-w-0 rounded-lg border p-3",
                    SECTION_STYLE[section.id] ??
                      "bg-slate-50/80 border-slate-200/80 dark:bg-slate-800/30 dark:border-slate-700/40",
                  )}
                >
                  <h3 className="mb-3 border-b border-slate-200/80 pb-2 text-xs font-semibold uppercase tracking-wider text-primary dark:border-white/10">
                    {section.label}
                  </h3>
                  <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {section.columns.map((column) => {
                      return (
                        <ColumnFilterRow
                          key={column.id}
                          columnId={column.id}
                        >
                          {isMasterFilterTextColumn(column.id) ? (
                            <TextFilterControl
                              label={column.label}
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
                            <div className="space-y-1.5">
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
                                className="min-w-0 flex-none"
                              />
                              {column.numeric && onNumericChange ? (
                                <NumericRangeFilterControls
                                  filter={filters.numeric[column.id]}
                                  onChange={(next) =>
                                    onNumericChange(column.id, next)
                                  }
                                  variant="panel"
                                />
                              ) : null}
                            </div>
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
