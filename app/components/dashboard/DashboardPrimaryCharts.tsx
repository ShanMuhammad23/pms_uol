"use client";

import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalibrationDistributionMatrix } from "@/app/components/dashboard/CalibrationDistributionMatrix";
import { ChartCard } from "@/app/components/dashboard/ChartCard";
import { CustomTooltip } from "@/app/components/dashboard/CustomTooltip";
import { containerVariants } from "@/app/helpers/dashboard-animations";
import type { RatingQuartileMatrixData } from "@/app/helpers/dashboard-types";

interface DashboardPrimaryChartsProps {
  calibrationData: Array<{ rating: string; quota: number; actual: number }>;
  ratingQuartileMatrix: RatingQuartileMatrixData;
  employeeCount: number;
  performanceMatrixLoading: boolean;
}

export function DashboardPrimaryCharts({
  calibrationData,
  ratingQuartileMatrix,
  employeeCount,
  performanceMatrixLoading,
}: DashboardPrimaryChartsProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-12"
    >
      <ChartCard
        title="Rating Calibration Curve"
        subtitle="Institutional Quota vs. Actual Distribution — Identifies Grade Inflation"
        delay={0.35}
        className="lg:col-span-6"
      >
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={calibrationData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="quotaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748b" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="rating" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }} iconType="circle" iconSize={8} />
              <Area
                type="monotone"
                dataKey="quota"
                name="Institutional Quota"
                stroke="#64748b"
                strokeWidth={2}
                fill="url(#quotaGrad)"
                dot={{ r: 4, fill: "#64748b", strokeWidth: 0 }}
              >
                <LabelList dataKey="quota" position="top" offset={8} style={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
              </Area>
              <Area
                type="monotone"
                dataKey="actual"
                name="Actual Distribution"
                stroke="#d97706"
                strokeWidth={2}
                fill="url(#actualGrad)"
                dot={{ r: 4, fill: "#d97706", strokeWidth: 0 }}
              >
                <LabelList dataKey="actual" position="bottom" offset={8} style={{ fontSize: 11, fill: "#d97706", fontWeight: 600 }} />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Rating × Quartile Matrix"
        subtitle="Employee headcount by performance level and quartile (sorted by configured order)"
        delay={0.36}
        className="lg:col-span-6"
      >
        <CalibrationDistributionMatrix
          rows={ratingQuartileMatrix.rows}
          columns={ratingQuartileMatrix.columns}
          employeeCount={employeeCount}
          isLoading={performanceMatrixLoading}
          hideHeader
        />
      </ChartCard>
    </motion.div>
  );
}
