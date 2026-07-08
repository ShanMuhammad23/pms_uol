"use client";

import type { PieLabelRenderProps } from "recharts";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/app/components/dashboard/ChartCard";
import { CustomTooltip } from "@/app/components/dashboard/CustomTooltip";
import { WorkflowProgressLegend } from "@/app/components/dashboard/WorkflowProgressLegend";
import { containerVariants } from "@/app/helpers/dashboard-animations";
import { WORKFLOW_CHART_SERIES } from "@/app/helpers/dashboard-chart-config";
import { formatStackBarLabel } from "@/app/helpers/dashboard-chart-utils";

interface DashboardCategoryChartsProps {
  themedCategoryDistribution: Array<{ name: string; value: number; color: string }>;
  filteredCompletionByCategory: Array<{
    category: string;
    draft: number;
    selfAssessment: number;
    headReview: number;
    hrCalibration: number;
    approved: number;
    rejected: number;
  }>;
  pieLabelRenderer: (props: PieLabelRenderProps) => React.ReactElement;
  isDarkMode: boolean;
  submissionsLoading: boolean;
  submissionsError: unknown;
}

export function DashboardCategoryCharts({
  themedCategoryDistribution,
  filteredCompletionByCategory,
  pieLabelRenderer,
  isDarkMode,
  submissionsLoading,
  submissionsError,
}: DashboardCategoryChartsProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-12"
    >
      <ChartCard
        title="Employee Category Mix"
        subtitle="Headcount distribution across university staff types"
        delay={0.4}
        className="lg:col-span-5"
        clipOverflow={false}
      >
        <div className="h-[360px] overflow-visible px-1">
          {submissionsLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              Loading submissions...
            </div>
          ) : submissionsError ? (
            <div className="flex h-full items-center justify-center text-sm text-red-600 dark:text-red-400">
              Failed to load submissions.
            </div>
          ) : themedCategoryDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 20, right: 24, bottom: 20, left: 24 }}>
                <Pie
                  data={themedCategoryDistribution}
                  cx="52%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={pieLabelRenderer}
                  labelLine={{ stroke: isDarkMode ? "#64748b" : "#94a3b8", strokeWidth: 1 }}
                >
                  {themedCategoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              No submissions match the current filters
            </div>
          )}
        </div>
      </ChartCard>

      <ChartCard
        title="Workflow Progress by Employee Category"
        subtitle="Form state advancement across organizational tiers"
        delay={0.45}
        className="lg:col-span-7"
      >
        <div className="h-[320px]">
          {submissionsLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              Loading submissions...
            </div>
          ) : submissionsError ? (
            <div className="flex h-full items-center justify-center text-sm text-red-600 dark:text-red-400">
              Failed to load submissions.
            </div>
          ) : filteredCompletionByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredCompletionByCategory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Legend content={(props) => <WorkflowProgressLegend payload={props.payload} />} />
                {WORKFLOW_CHART_SERIES.map((series, index) => (
                  <Bar
                    key={series.dataKey}
                    dataKey={series.dataKey}
                    name={series.name}
                    stackId="a"
                    fill={series.fill}
                    radius={
                      index === WORKFLOW_CHART_SERIES.length - 1
                        ? [4, 4, 0, 0]
                        : [0, 0, 0, 0]
                    }
                  >
                    <LabelList
                      dataKey={series.dataKey}
                      position="center"
                      formatter={formatStackBarLabel}
                      style={{
                        fill: series.labelFill,
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              No submissions match the current filters
            </div>
          )}
        </div>
      </ChartCard>
    </motion.div>
  );
}
