"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  id?: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Label for the empty/keep-existing option (e.g. "— Keep existing —"). */
  emptyOptionLabel?: string;
  className?: string;
}

export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Select...",
  emptyOptionLabel,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Build the full selectable list (empty option + filtered options) for keyboard nav.
  const selectableItems = useMemo(
    () => (emptyOptionLabel ? [{ value: "", label: emptyOptionLabel }, ...filtered] : filtered),
    [emptyOptionLabel, filtered],
  );

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery("");
      setActiveIndex(0);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
        setActiveIndex(0);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Clamp activeIndex inline (avoids setState-in-effect).
  const clampedActiveIndex = Math.min(
    activeIndex,
    Math.max(0, selectableItems.length - 1),
  );

  // Scroll active item into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const activeEl = listRef.current.querySelector(
      `[data-idx="${clampedActiveIndex}"]`,
    ) as HTMLElement | null;
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [clampedActiveIndex, open]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        Math.min(current + 1, selectableItems.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = selectableItems[clampedActiveIndex];
      if (item) {
        handleSelect(item.value);
      }
    }
  };

  const displayText = selectedOption
    ? selectedOption.label
    : emptyOptionLabel ?? placeholder;

  const showPlaceholderStyle = !selectedOption;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => {
              const next = !prev;
              if (next) {
                setTimeout(() => inputRef.current?.focus(), 0);
              } else {
                setQuery("");
                setActiveIndex(0);
              }
              return next;
            });
          }
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors disabled:opacity-70 dark:border-white/10 dark:bg-slate-950 dark:text-white",
          "focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20",
          open && "border-amber-400 ring-2 ring-amber-500/20",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            showPlaceholderStyle && "text-slate-400 dark:text-slate-500",
          )}
          title={selectedOption ? displayText : undefined}
        >
          {displayText}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900">
          <div className="relative shrink-0 border-b border-slate-100 p-2 dark:border-white/5">
            <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search..."
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
            />
          </div>
          <div ref={listRef} className="max-h-48 overflow-y-auto py-1">
            {selectableItems.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-400">
                No matches found
              </p>
            ) : (
              selectableItems.map((item, idx) => {
                const isEmptyOption = item.value === "" && emptyOptionLabel;
                const isSelected = item.value === value;
                const isActive = idx === clampedActiveIndex;
                return (
                  <button
                    key={`${item.value}-${idx}`}
                    type="button"
                    data-idx={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelect(item.value)}
                    className={cn(
                      "flex w-full items-center px-3 py-2 text-left text-sm transition-colors",
                      isActive && "bg-slate-50 dark:bg-white/5",
                      isSelected
                        ? "font-medium text-amber-700 dark:text-amber-400"
                        : "text-slate-700 dark:text-slate-300",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {isEmptyOption ? emptyOptionLabel : item.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
