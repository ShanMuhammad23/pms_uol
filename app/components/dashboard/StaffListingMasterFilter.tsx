"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Filter, RotateCcw, Search } from "lucide-react";
import {
  MultiSelectFilterDropdown,
  type MultiSelectOption,
} from "@/app/components/dashboard/MultiSelectFilterDropdown";
import {
  MASTER_FILTER_MULTI_COLUMNS,
  MASTER_FILTER_TEXT_COLUMNS,
  buildMasterFilterOptions,
  countActiveMasterFilters,
  type MasterFilterMultiSelection,
  type MasterFilterState,
  type MasterFilterTextColumnId,
} from "@/app/helpers/dashboard-master-filters";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { cn } from "@/lib/utils";

interface StaffListingMasterFilterProps {
  submissions: FormSubmissionListItem[];
  filters: MasterFilterState;
  onTextChange: (columnId: MasterFilterTextColumnId, next: string) => void;
  onMultiChange: (
    columnId: (typeof MASTER_FILTER_MULTI_COLUMNS)[number]["id"],
    next: MasterFilterMultiSelection,
  ) => void;
  onClearAll: () => void;
}

function TextFilterField({
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
    <label className="flex min-w-[200px] flex-1 flex-col gap-1.5 sm:max-w-[240px]">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </span>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>
    </label>
  );
}

export function StaffListingMasterFilter({
  submissions,
  filters,
  onTextChange,
  onMultiChange,
  onClearAll,
}: StaffListingMasterFilterProps) {
  const [open, setOpen] = useState(false);
  const activeCount = countActiveMasterFilters(filters);

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, MultiSelectOption[]>();

    for (const column of MASTER_FILTER_MULTI_COLUMNS) {
      map.set(column.id, buildMasterFilterOptions(submissions, column));
    }

    return map;
  }, [submissions]);

  return (
    <div className="border-b border-slate-200 dark:border-white/5">
      <div className="flex items-center justify-between gap-3 px-5 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex items-center gap-2 rounded-md px-1.5 py-1 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-expanded={open}
        >
          <Filter className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span>Master Filter</span>
          {activeCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              {activeCount}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-slate-400 transition-transform duration-300",
              open && "rotate-180",
            )}
          />
        </button>

        {activeCount > 0 ? (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <RotateCcw className="h-3 w-3" />
            Clear master filters
          </button>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="master-filter-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-slate-100 px-5 pb-4 pt-3 dark:border-white/5">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Text search
                </p>
                <div className="flex flex-wrap gap-3">
                  {MASTER_FILTER_TEXT_COLUMNS.map((column) => (
                    <TextFilterField
                      key={column.id}
                      label={column.label}
                      value={filters.text[column.id as MasterFilterTextColumnId] ?? ""}
                      placeholder={`Search ${column.label.toLowerCase()}...`}
                      onChange={(next) =>
                        onTextChange(column.id as MasterFilterTextColumnId, next)
                      }
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Multi-select
                </p>
                <div className="flex flex-wrap gap-3">
                  {MASTER_FILTER_MULTI_COLUMNS.map((column) => {
                    const options = optionsByColumn.get(column.id) ?? [];

                    return (
                      <MultiSelectFilterDropdown
                        key={column.id}
                        label={column.label}
                        options={options}
                        selectedValues={filters.multi[column.id] ?? null}
                        onChange={(next) => onMultiChange(column.id, next)}
                        placeholder={`All ${column.label}`}
                        searchable={options.length > 8}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
