"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, Filter, Search, X } from "lucide-react";
import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import {
  buildMasterFilterOptions,
  isColumnFilterActive,
  isMasterFilterTextColumn,
  type MasterFilterMultiSelection,
  type MasterFilterState,
  type MasterFilterTextColumnId,
} from "@/app/helpers/dashboard-master-filters";
import type {
  DashboardTableColumnDef,
  DashboardTableColumnId,
} from "@/app/helpers/dashboard-table-columns";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { cn } from "@/lib/utils";

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openUpward: boolean;
};

interface TableColumnHeaderFilterProps {
  column: DashboardTableColumnDef;
  submissions: FormSubmissionListItem[];
  allSubmissions?: FormSubmissionListItem[];
  filters: MasterFilterState;
  onTextChange: (columnId: MasterFilterTextColumnId, next: string) => void;
  onMultiChange: (
    columnId: DashboardTableColumnId,
    next: MasterFilterMultiSelection,
  ) => void;
}

function getMenuPosition(trigger: HTMLElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const gap = 4;
  const preferredMaxHeight = 300;
  const preferredWidth = 240;
  const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
  const spaceAbove = rect.top - gap - 8;
  const openUpward = spaceBelow < 200 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    180,
    Math.min(preferredMaxHeight, openUpward ? spaceAbove : spaceBelow),
  );

  let left = rect.left;
  if (left + preferredWidth > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - preferredWidth - 8);
  }

  return {
    top: openUpward ? rect.top - gap : rect.bottom + gap,
    left,
    width: preferredWidth,
    maxHeight,
    openUpward,
  };
}

export function TableColumnHeaderFilter({
  column,
  submissions,
  allSubmissions,
  filters,
  onTextChange,
  onMultiChange,
}: TableColumnHeaderFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draftText, setDraftText] = useState("");
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const isText = isMasterFilterTextColumn(column.id);
  const active = isColumnFilterActive(filters, column.id);

  const selectedValues = filters.multi[column.id] ?? null;

  const options = useMemo(
    () =>
      isText
        ? []
        : buildMasterFilterOptions(
            submissions,
            column,
            filters,
            selectedValues,
            allSubmissions,
          ),
    [allSubmissions, column, filters, isText, selectedValues, submissions],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open && isText) {
      setDraftText(filters.text[column.id as MasterFilterTextColumnId] ?? "");
    }
  }, [column.id, filters.text, isText, open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }

    const updatePosition = () => {
      if (!triggerRef.current) {
        return;
      }
      setPosition(getMenuPosition(triggerRef.current));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
      setQuery("");
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const allValues = options.map((option) => option.value);
  const selectedSet = new Set(
    selectedValues === null ? allValues : selectedValues,
  );
  const allSelected =
    options.length > 0 &&
    (selectedValues === null || selectedValues.length === options.length);
  const noneSelected = selectedValues !== null && selectedValues.length === 0;

  const filteredOptions = options.filter((option) => {
    if (!query.trim()) {
      return true;
    }
    return option.label.toLowerCase().includes(query.trim().toLowerCase());
  });

  const commitSelection = (nextSelected: string[]) => {
    if (nextSelected.length === 0) {
      onMultiChange(column.id, []);
      return;
    }

    if (nextSelected.length === allValues.length) {
      onMultiChange(column.id, null);
      return;
    }

    onMultiChange(column.id, nextSelected);
  };

  const handleToggle = (value: string) => {
    const current = selectedValues === null ? allValues : selectedValues;
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    commitSelection(next);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  };

  const applyTextFilter = () => {
    onTextChange(column.id as MasterFilterTextColumnId, draftText);
    setOpen(false);
  };

  const clearFilter = () => {
    if (isText) {
      setDraftText("");
      onTextChange(column.id as MasterFilterTextColumnId, "");
    } else {
      onMultiChange(column.id, null);
    }
    setQuery("");
    setOpen(false);
  };

  const menu =
    open && mounted && position
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="dialog"
            aria-label={`Filter ${column.label}`}
            style={{
              position: "fixed",
              top: position.openUpward ? undefined : position.top,
              bottom: position.openUpward
                ? window.innerHeight - position.top
                : undefined,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              zIndex: 1000,
            }}
            className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-white/5">
              <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                {column.label}
              </p>
              <button
                type="button"
                onClick={clearFilter}
                disabled={!active}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            </div>

            {isText ? (
              <div className="space-y-2 p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    autoFocus
                    value={draftText}
                    onChange={(event) => setDraftText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        applyTextFilter();
                      }
                    }}
                    placeholder={`Contains...`}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300/60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyTextFilter}
                  className="w-full rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
                >
                  Apply
                </button>
              </div>
            ) : (
              <>
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => onMultiChange(column.id, null)}
                    disabled={allSelected || options.length === 0}
                    className="text-[11px] font-semibold text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline dark:text-slate-300"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => onMultiChange(column.id, [])}
                    disabled={noneSelected || options.length === 0}
                    className="text-[11px] font-semibold text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline dark:text-slate-300"
                  >
                    Unselect all
                  </button>
                </div>

                {options.length > 8 ? (
                  <div className="relative shrink-0 border-b border-slate-100 px-2 py-2 dark:border-white/5">
                    <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search..."
                      className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300/60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
                    />
                  </div>
                ) : null}

                <ul className="min-h-0 flex-1 overflow-y-auto py-1">
                  {filteredOptions.length === 0 ? (
                    <li className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                      No options
                    </li>
                  ) : (
                    filteredOptions.map((option: MultiSelectOption) => {
                      const checked = selectedSet.has(option.value);

                      return (
                        <li key={option.value}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={checked}
                            onClick={() => handleToggle(option.value)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/4"
                          >
                            <span
                              className={cn(
                                "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                                checked
                                  ? "border-slate-700 bg-slate-700 text-white dark:border-slate-300 dark:bg-slate-300 dark:text-slate-900"
                                  : "border-slate-300 dark:border-white/20",
                              )}
                            >
                              {checked ? (
                                <Check className="h-2.5 w-2.5" strokeWidth={3} />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              {option.label}
                            </span>
                            <span className="shrink-0 tabular-nums text-[10px] text-slate-400 dark:text-slate-500">
                              {option.count}
                            </span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="inline-flex items-center gap-1">
      <span>{column.label}</span>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Filter by ${column.label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded transition-colors",
          active
            ? "bg-white text-primary"
            : "text-white/70 hover:bg-white/15 hover:text-white",
          open && !active && "bg-white/15 text-white",
        )}
      >
        <Filter className="h-3 w-3" />
      </button>
      {menu}
    </div>
  );
}
