"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterChipColor = "slate" | "amber" | "orange" | "emerald" | "blue";

interface FilterChipProps {
  label: string;
  onRemove: () => void;
  color?: FilterChipColor;
}

export function FilterChip({ label, onRemove, color = "slate" }: FilterChipProps) {
  const colors = {
    slate: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50",
    orange: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/50",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50",
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/50",
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", colors[color])}>
      {label}
      <button onClick={onRemove} className="ml-1 rounded-full p-0.5 hover:bg-black/5 dark:hover:bg-white/10">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
