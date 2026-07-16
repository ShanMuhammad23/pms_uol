"use client";

import { useMemo, useState } from "react";
import { CATEGORY_COLOR_PALETTE } from "@/app/helpers/dashboard-chart-config";
import { useIsDarkMode } from "@/app/helpers/dashboard-theme";
import { cn } from "@/lib/utils";
import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";

interface Category0DistributionBarProps {
  options: MultiSelectOption[];
  className?: string;
}

type Segment = {
  value: string;
  label: string;
  count: number;
  percent: number;
  color: string;
};

export function Category0DistributionBar({
  options,
  className,
}: Category0DistributionBarProps) {
  const isDarkMode = useIsDarkMode();
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);

  const segments = useMemo<Segment[]>(() => {
    const total = options.reduce((sum, option) => sum + option.count, 0);

    if (total === 0) {
      return [];
    }

    return options
      .filter((option) => option.count > 0)
      .map((option, index) => {
        const palette = CATEGORY_COLOR_PALETTE[index % CATEGORY_COLOR_PALETTE.length];

        return {
          value: option.value,
          label: option.label,
          count: option.count,
          percent: (option.count / total) * 100,
          color: isDarkMode ? palette.dark : palette.light,
        };
      });
  }, [isDarkMode, options]);

  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <div
        className="flex h-7 w-full overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800"
        role="img"
        aria-label={
          segments.length > 0
            ? `Staff distribution across Category 0: ${segments
                .map((segment) => `${segment.label} ${segment.count}`)
                .join(", ")}`
            : "No staff distribution data for Category 0"
        }
        onMouseLeave={() => setHoveredValue(null)}
      >
        {segments.length > 0 ? (
          segments.map((segment) => (
            <div
              key={segment.value}
              className={cn(
                "flex h-full min-w-0 items-center justify-center px-1.5 transition-[flex-grow,opacity] duration-300 first:rounded-l-md last:rounded-r-md",
                hoveredValue !== null && hoveredValue !== segment.value && "opacity-40",
              )}
              style={{
                flexGrow: segment.count,
                flexBasis: 0,
                backgroundColor: segment.color,
              }}
              title={`${segment.label}: ${segment.count} (${segment.percent.toFixed(1)}%)`}
              onMouseEnter={() => setHoveredValue(segment.value)}
            >
              <span className="truncate text-[11px] font-medium leading-none text-white">
                {segment.label} ({segment.count})
              </span>
            </div>
          ))
        ) : (
          <div className="h-full w-full rounded-md bg-slate-200 dark:bg-slate-700" />
        )}
      </div>
    </div>
  );
}
