"use client";

import { motion } from "framer-motion";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { itemVariants } from "@/app/helpers/dashboard-animations";
import { CustomTooltip } from "@/app/components/dashboard/CustomTooltip";

interface EligibilityStatCardProps {
  data: Array<{ name: string; value: number; color: string }>;
  delay: number;
}

export function EligibilityStatCard({ data, delay }: EligibilityStatCardProps) {
  const hasData = data.some((entry) => entry.value > 0);

  return (
    <motion.div
      variants={itemVariants}
      transition={{ delay }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600" />
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Appraisal Eligibility
      </p>

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
                <span className="flex min-w-0 items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-white">
                  {entry.value}
                </span>
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
