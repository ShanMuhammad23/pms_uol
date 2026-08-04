"use client";

import {
  getPerformanceLevelColor,
  getQuartileShade,
} from "@/app/helpers/dashboard-helpers";
import { cn } from "@/lib/utils";

interface QuartileBadgeProps {
  performanceLevelName: string | null;
  quartileName: string | null;
  /**
   * Zero-based quartile index within the performance level (used for the
   * shade overlay). When omitted, derived from `quartileName` (e.g. "Q1" → 0).
   */
  quartileIndex?: number;
  className?: string;
}

/**
 * Reusable quartile badge that applies the same colour mapping used by the
 * Staff Listing / Dashboard / Performance Matrix.
 *
 * The outer span receives the performance-level solid colour
 * ({@link getPerformanceLevelColor}) and the inner span receives the
 * quartile shade overlay ({@link getQuartileShade}), matching the rendering
 * in `DashboardSubmissionsTable`.
 */
export default function QuartileBadge({
  performanceLevelName,
  quartileName,
  quartileIndex,
  className,
}: QuartileBadgeProps) {
  if (!performanceLevelName || !quartileName) {
    return <span className={cn("text-slate-400 italic dark:text-slate-500", className)}>—</span>;
  }

  const resolvedIndex =
    quartileIndex ??
    parseQuartileIndexFromName(quartileName);

  const levelColor = getPerformanceLevelColor(performanceLevelName, 0);
  const quartileShade =
    resolvedIndex >= 0 ? getQuartileShade(resolvedIndex) : "";

  return (
    <span className={cn("inline-flex rounded-md", levelColor, className)}>
      <span
        className={cn(
          "rounded-md px-2 py-0.5 text-xs font-medium text-white",
          quartileShade,
        )}
      >
        {quartileName}
      </span>
    </span>
  );
}

/** Extract a zero-based quartile index from a name like "Q1", "Q2", etc. */
function parseQuartileIndexFromName(name: string): number {
  const match = name.match(/(\d+)/);
  if (!match) return -1;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n - 1 : -1;
}
