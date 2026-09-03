"use client";

import { useState } from "react";
import type { NumericRangeFilter } from "@/app/helpers/numeric-range-filter";
import { cn } from "@/lib/utils";

interface NumericRangeFilterControlsProps {
  filter: NumericRangeFilter | undefined;
  onChange: (filter: NumericRangeFilter | undefined) => void;
  variant?: "dropdown" | "panel";
}

export function NumericRangeFilterControls({
  filter,
  onChange,
  variant = "dropdown",
}: NumericRangeFilterControlsProps) {
  const [gtText, setGtText] = useState("");
  const [ltText, setLtText] = useState("");
  const filterKey = `${filter?.gt ?? ""}:${filter?.lt ?? ""}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setGtText(filter?.gt != null ? String(filter.gt) : "");
    setLtText(filter?.lt != null ? String(filter.lt) : "");
  }

  const commit = (nextGt: string, nextLt: string) => {
    const gtNum = nextGt.trim() === "" ? undefined : Number(nextGt);
    const ltNum = nextLt.trim() === "" ? undefined : Number(nextLt);

    const next: NumericRangeFilter = {};
    if (gtNum != null && !Number.isNaN(gtNum)) next.gt = gtNum;
    if (ltNum != null && !Number.isNaN(ltNum)) next.lt = ltNum;

    if (next.gt === undefined && next.lt === undefined) {
      onChange(undefined);
    } else {
      onChange(next);
    }
  };

  const handleGtChange = (value: string) => {
    setGtText(value);
    commit(value, ltText);
  };

  const handleLtChange = (value: string) => {
    setLtText(value);
    commit(gtText, value);
  };

  const handleClear = () => {
    setGtText("");
    setLtText("");
    onChange(undefined);
  };

  const hasValue = gtText.trim() !== "" || ltText.trim() !== "";

  if (variant === "panel") {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            ≥
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={gtText}
            onChange={(e) => handleGtChange(e.target.value)}
            placeholder="—"
            className="w-full min-w-0 rounded border border-slate-200/80 bg-white/90 px-1.5 py-1 text-xs text-slate-800 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300/50 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100"
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            ≤
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={ltText}
            onChange={(e) => handleLtChange(e.target.value)}
            placeholder="—"
            className="w-full min-w-0 rounded border border-slate-200/80 bg-white/90 px-1.5 py-1 text-xs text-slate-800 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300/50 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100"
          />
        </div>
        {hasValue ? (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-[10px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Clear
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-slate-100 px-3 py-2 dark:border-white/5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Range
        </span>
        {hasValue ? (
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Clear
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1">
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
            ≥
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={gtText}
            onChange={(e) => handleGtChange(e.target.value)}
            placeholder="—"
            className={cn(
              "w-full min-w-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs text-slate-700 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300/60",
              "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300",
            )}
          />
        </div>
        <div className="flex flex-1 items-center gap-1">
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
            ≤
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={ltText}
            onChange={(e) => handleLtChange(e.target.value)}
            placeholder="—"
            className={cn(
              "w-full min-w-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs text-slate-700 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300/60",
              "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300",
            )}
          />
        </div>
      </div>
    </div>
  );
}
