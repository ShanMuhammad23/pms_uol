"use client";

import { WORKFLOW_CHART_SERIES } from "@/app/helpers/dashboard-chart-config";

interface WorkflowLegendPayloadItem {
  value?: string;
  color?: string;
}

interface WorkflowProgressLegendProps {
  payload?: ReadonlyArray<WorkflowLegendPayloadItem>;
}

export function WorkflowProgressLegend({ payload }: WorkflowProgressLegendProps) {
  if (!payload?.length) {
    return null;
  }

  const order = new Map<string, number>(
    WORKFLOW_CHART_SERIES.map((series, index) => [series.name, index]),
  );

  const sorted = [...payload].sort(
    (a, b) =>
      (order.get(String(a.value)) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(String(b.value)) ?? Number.MAX_SAFE_INTEGER),
  );

  return (
    <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-4">
      {sorted.map((entry) => (
        <li
          key={String(entry.value)}
          className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}
