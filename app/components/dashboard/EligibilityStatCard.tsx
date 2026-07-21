"use client";

import { motion } from "framer-motion";
import type { PieLabelRenderProps } from "recharts";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { itemVariants } from "@/app/helpers/dashboard-animations";
import { CustomTooltip } from "@/app/components/dashboard/CustomTooltip";

interface EligibilityStatCardProps {
  data: Array<{ name: string; value: number; color: string }>;
  delay: number;
}

function renderSlicePercentLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: PieLabelRenderProps) {
  const value = percent ?? 0;
  if (value < 0.05) {
    return null;
  }

  const RADIAN = Math.PI / 180;
  const radius =
    Number(innerRadius ?? 0) +
    (Number(outerRadius ?? 0) - Number(innerRadius ?? 0)) * 0.55;
  const x = Number(cx ?? 0) + radius * Math.cos(-Number(midAngle ?? 0) * RADIAN);
  const y = Number(cy ?? 0) + radius * Math.sin(-Number(midAngle ?? 0) * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-[9px] font-semibold"
    >
      {`${Math.round(value * 100)}%`}
    </text>
  );
}

export function EligibilityStatCard({ data, delay }: EligibilityStatCardProps) {
  const hasData = data.some((entry) => entry.value > 0);
  const fullyEligible =
    data.find((entry) => entry.name === "Fully Eligible")?.value ?? 0;
  const partiallyEligible =
    data.find((entry) => entry.name === "Partially Eligible")?.value ?? 0;
  const notEligible =
    data.find((entry) => entry.name === "Not Eligible")?.value ?? 0;
  const eligibleCount = fullyEligible + partiallyEligible;
  const totalCount = eligibleCount + notEligible;
  const eligibilityPercentage =
    totalCount > 0 ? Math.round((eligibleCount / totalCount) * 100) : 0;
  const resolveEntryName = (name: string) => {
    if (name === "Fully Eligible") return "Full";
    if (name === "Partially Eligible") return "Partial";
    if (name === "Not Eligible") return "None";
    return name;
  };
  return (
    <motion.div
      variants={itemVariants}
      transition={{ delay }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="group flex-1 relative overflow-hidden rounded-xl border border-slate-200 bg-primary text-white p-5 shadow-sm transition-all duration-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider ">
          Appraisal Eligibility
        </p>
        <span
          className="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
          title="(Fully Eligible + Partially Eligible) / Total"
        >
          {eligibilityPercentage}%
        </span>
      </div>
      {hasData ? (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-[88px] w-[88px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={24}
                  outerRadius={40}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  strokeWidth={0}
                  label={renderSlicePercentLabel}
                  labelLine={false}
                >
                  {data.map((entry, index) => (
                    <Cell key={`eligibility-mini-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="min-w-0 flex-1 space-y-1.5">
            {data.map((entry) => (
              <li
                key={entry.name}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-white">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="truncate">{resolveEntryName(entry.name)}</span>
                  
                </span>
                <span className="text-xs text-white">{entry.value}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          No employees match the current filters
        </p>
      )}
    </motion.div>
  );
}
