"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ElementType,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  value: string;
  label: string;
  count: number;
};

interface MultiSelectFilterDropdownProps {
  label: string;
  icon?: ElementType;
  options: MultiSelectOption[];
  /** `null` means all selected (no filter). `[]` means none selected. */
  selectedValues: string[] | null;
  onChange: (next: string[] | null) => void;
  disabled?: boolean;
  placeholder?: string;
  searchable?: boolean;
  /** Softer chrome for dense filter panels. */
  quiet?: boolean;
  className?: string;
}

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openUpward: boolean;
};

function selectionLabel(
  selectedValues: string[] | null,
  options: MultiSelectOption[],
  placeholder: string,
): string {
  if (selectedValues === null || selectedValues.length === options.length) {
    return placeholder;
  }

  if (selectedValues.length === 0) {
    return "None selected";
  }

  if (selectedValues.length === 1) {
    return options.find((option) => option.value === selectedValues[0])?.label
      ?? selectedValues[0];
  }

  return `${selectedValues.length} selected`;
}

function getMenuPosition(trigger: HTMLElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const gap = 4;
  const preferredMaxHeight = 280;
  const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
  const spaceAbove = rect.top - gap - 8;
  const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    160,
    Math.min(preferredMaxHeight, openUpward ? spaceAbove : spaceBelow),
  );

  return {
    top: openUpward ? rect.top - gap : rect.bottom + gap,
    left: rect.left,
    width: Math.max(rect.width, 220),
    maxHeight,
    openUpward,
  };
}

export function MultiSelectFilterDropdown({
  label,
  icon: Icon,
  options,
  selectedValues,
  onChange,
  disabled = false,
  placeholder = "All",
  searchable = false,
  quiet = false,
  className,
}: MultiSelectFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const allValues = options.map((option) => option.value);
  const selectedSet = new Set(
    selectedValues === null ? allValues : selectedValues,
  );
  const allSelected =
    options.length > 0 &&
    (selectedValues === null || selectedValues.length === options.length);
  const noneSelected = selectedValues !== null && selectedValues.length === 0;

  useEffect(() => {
    setMounted(true);
  }, []);

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
        rootRef.current?.contains(target) ||
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

  const filteredOptions = options.filter((option) => {
    if (!query.trim()) {
      return true;
    }

    return option.label.toLowerCase().includes(query.trim().toLowerCase());
  });

  const commitSelection = (nextSelected: string[]) => {
    if (nextSelected.length === 0) {
      onChange([]);
      return;
    }

    if (nextSelected.length === allValues.length) {
      onChange(null);
      return;
    }

    onChange(nextSelected);
  };

  const handleSelectAll = () => {
    onChange(null);
  };

  const handleUnselectAll = () => {
    onChange([]);
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
      if (!disabled) {
        setOpen(true);
      }
    }
  };

  const menu =
    open && mounted && position
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-multiselectable="true"
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
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={allSelected || options.length === 0}
                className={cn(
                  "text-xs font-semibold hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline",
                  quiet
                    ? "text-slate-600 dark:text-slate-300"
                    : "text-amber-700 dark:text-amber-400",
                )}
              >
                Select all
              </button>
              <button
                type="button"
                onClick={handleUnselectAll}
                disabled={noneSelected || options.length === 0}
                className="text-xs font-semibold text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline dark:text-slate-300"
              >
                Unselect all
              </button>
            </div>

            {searchable ? (
              <div className="relative shrink-0 border-b border-slate-100 px-2 py-2 dark:border-white/5">
                <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
                />
              </div>
            ) : null}

            <ul className="min-h-0 flex-1 overflow-y-auto py-1">
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  No options
                </li>
              ) : (
                filteredOptions.map((option) => {
                  const checked = selectedSet.has(option.value);

                  return (
                    <li key={option.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={checked}
                        onClick={() => handleToggle(option.value)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/4"
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            checked
                              ? quiet
                                ? "border-slate-700 bg-slate-700 text-white dark:border-slate-300 dark:bg-slate-300 dark:text-slate-900"
                                : "border-amber-500 bg-amber-500 text-white"
                              : "border-slate-300 dark:border-white/20",
                          )}
                        >
                          {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        {option.count > 0 ? (
                          <span className="shrink-0 tabular-nums text-xs text-slate-400 dark:text-slate-500">
                            {option.count}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative min-w-[180px] flex-1",
        quiet ? "space-y-1" : "space-y-1.5",
        className,
      )}
    >
      <label
        className={cn(
          "text-slate-500 dark:text-slate-400",
          quiet
            ? "text-[11px] font-medium"
            : "text-xs font-semibold uppercase tracking-wider",
        )}
      >
        {label}
      </label>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => {
            if (!disabled) {
              setOpen((current) => !current);
            }
          }}
          onKeyDown={handleTriggerKeyDown}
          className={cn(
            "flex w-full items-center border bg-white pr-10 text-left text-sm text-slate-700",
            quiet
              ? "rounded-md border-slate-200/80 bg-white/90 py-1.5"
              : "rounded-lg border-slate-200 py-2",
            Icon ? "pl-10" : "pl-3",
            "outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50",
            "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300",
            quiet
              ? "focus:border-slate-400 focus:ring-1 focus:ring-slate-300/50 dark:focus:border-slate-500 dark:focus:ring-slate-600/40"
              : "focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
            open &&
              (quiet
                ? "border-slate-400 ring-1 ring-slate-300/50 dark:border-slate-500 dark:ring-slate-600/40"
                : "border-amber-500/50 ring-2 ring-amber-500/20"),
            !allSelected &&
              !noneSelected &&
              (quiet
                ? "border-slate-400 dark:border-slate-500"
                : "border-amber-300 dark:border-amber-700/50"),
          )}
        >
          {Icon ? (
            <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          ) : null}
          <span className="truncate">
            {selectionLabel(selectedValues, options, placeholder)}
          </span>
          <ChevronDown
            className={cn(
              "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        {menu}
      </div>
    </div>
  );
}
