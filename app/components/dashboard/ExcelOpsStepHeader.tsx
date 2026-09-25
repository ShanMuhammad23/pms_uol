"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Section accents for the Bulk Excel Ops flows.
 * - `sheet` (green): data that comes from, or will be written to, the Excel file.
 * - `pms` (blue): columns/fields stored in the PMS database.
 * - `mixed`: steps that connect the two sides (column mapping, review).
 */
export type ExcelOpsStepTone = "sheet" | "pms" | "mixed";

const TONE_CLASSES: Record<ExcelOpsStepTone, string> = {
  sheet: "bg-[#217346] text-white",
  pms: "bg-sky-600 text-white",
  mixed: "bg-gradient-to-r from-[#217346] to-sky-600 text-white",
};

export function ExcelOpsStepHeader({
  step,
  tone,
  title,
  hint,
  icon,
  children,
}: {
  step: number;
  tone: ExcelOpsStepTone;
  title: string;
  hint?: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 px-3 py-2",
        TONE_CLASSES[tone],
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-white/20 px-1.5 text-[10px] font-bold text-white">
          {step}
        </span>
        {icon ? (
          <span className="shrink-0 text-white/90" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="truncate text-xs font-semibold tracking-wide">
            {title}
          </h3>
          {hint ? (
            <p className="truncate text-[10px] leading-tight text-white/80">
              {hint}
            </p>
          ) : null}
        </div>
      </div>
      {children ? (
        <div className="flex shrink-0 items-center gap-2 text-[11px] font-medium text-white/90">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function ExcelOpsLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Legend
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="size-2.5 rounded-sm bg-[#217346]"
          aria-hidden="true"
        />
        Excel sheet
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-sky-600" aria-hidden="true" />
        PMS database
      </span>
    </div>
  );
}
