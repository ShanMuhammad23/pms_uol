"use client";

import { useEffect, useState } from "react";
import { useIsClient } from "@/app/hooks/use-is-client";
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
import type { MatrixScoreType } from "@/lib/performance-rating";

interface DashboardPrimaryChartsProps {
  calibrationData: Array<{ rating: string; quota: number; actual: number }>;
  ratingQuartileMatrix: RatingQuartileMatrixData;
  employeeCount: number;
  performanceMatrixLoading: boolean;
  role?: string | null;
  matrixScoreType?: MatrixScoreType;
  onMatrixScoreTypeChange?: (scoreType: MatrixScoreType) => void;
}

export function DashboardPrimaryCharts({
  calibrationData,
  ratingQuartileMatrix,
  employeeCount,
  performanceMatrixLoading,
  role,
  matrixScoreType,
  onMatrixScoreTypeChange,
}: DashboardPrimaryChartsProps) {
  const isHead = role === "MANAGER";
  const isClient = useIsClient();
  const [chartsKey, setChartsKey] = useState(0);
  const [chartReady, setChartReady] = useState(false);

  if (isClient && !chartReady) {
    setChartReady(true);
    setChartsKey(1);
  }

  useEffect(() => {
    if (!chartReady) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chartReady]);

  return (
    <motion.section
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mb-0"
    >
      <div key={chartsKey} className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <ChartCard
          title="Performance Rating Curve"
          delay={0.35}
          className={isHead ? "lg:col-span-12" : "lg:col-span-6"}
        >
          <div className="h-80">
            {chartReady ? (
            <ResponsiveContainer key={chartsKey} width="100%" height="100%">
              <AreaChart
                data={calibrationData}
                margin={{ top: 20, right: 10, left: -10, bottom: 0 }}
              >
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
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="rating"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }}
                  iconType="circle"
                  iconSize={8}
                />
                <Area
                  type="monotone"
                  dataKey="quota"
                  name="Quota"
                  stroke="#64748b"
                  strokeWidth={2}
                  fill="url(#quotaGrad)"
                  dot={{ r: 4, fill: "#64748b", strokeWidth: 0 }}
                >
                  <LabelList
                    dataKey="quota"
                    position="top"
                    offset={8}
                    style={{
                      fontSize: 11,
                      fill: "#64748b",
                      fontWeight: 600,
                    }}
                  />
                </Area>
                {isHead ? null : (
                  <Area
                    type="monotone"
                    dataKey="actual"
                    name="Actual Distribution"
                    stroke="#d97706"
                    strokeWidth={2}
                    fill="url(#actualGrad)"
                    dot={{ r: 4, fill: "#d97706", strokeWidth: 0 }}
                  >
                    <LabelList
                      dataKey="actual"
                      position="top"
                      offset={8}
                      style={{
                        fontSize: 11,
                        fill: "#d97706",
                        fontWeight: 600,
                      }}
                    />
                  </Area>
                )}
              </AreaChart>
            </ResponsiveContainer>
            ) : null}
          </div>
        </ChartCard>

        {isHead ? null : (
          <ChartCard
            title="Performance Rating Quartile Matrix"
            delay={0.36}
            className="lg:col-span-6"
          >
            <CalibrationDistributionMatrix
              rows={ratingQuartileMatrix.rows}
              columns={ratingQuartileMatrix.columns}
              employeeCount={employeeCount}
              isLoading={performanceMatrixLoading}
              hideHeader
              scoreType={matrixScoreType}
              onScoreTypeChange={onMatrixScoreTypeChange}
            />
          </ChartCard>
        )}
      </div>
    </motion.section>
  );
}
