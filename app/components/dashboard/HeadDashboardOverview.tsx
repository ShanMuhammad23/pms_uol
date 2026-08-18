"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
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
import { ChartCard } from "@/app/components/dashboard/ChartCard";
import { CustomTooltip } from "@/app/components/dashboard/CustomTooltip";
import { EligibilityStatCard } from "@/app/components/dashboard/EligibilityStatCard";
import { FormStatusStatCard } from "@/app/components/dashboard/FormStatusStatCard";
import { ManagerReviewStatCard } from "@/app/components/dashboard/ManagerReviewStatCard";
import { StatCard } from "@/app/components/dashboard/StatCard";
import { containerVariants } from "@/app/helpers/dashboard-animations";
import type { CardFilterId } from "@/app/helpers/dashboard-types";
import type {
  ManagerReviewDualStats,
  WorkflowStageStats,
} from "@/app/helpers/dashboard-workflow-stats";
import { cn } from "@/lib/utils";

interface HeadDashboardOverviewProps {
  eligibilityData: Array<{ name: string; value: number; color: string }>;
  selfAssessmentStats: WorkflowStageStats;
  managerReviewStats: ManagerReviewDualStats;
  selectedCardFilter: CardFilterId | null;
  onFilterByCard: (cardId: CardFilterId) => void;
  calibrationData: Array<{ rating: string; quota: number; actual: number }>;
  statsVisible?: boolean;
  chartsVisible?: boolean;
}

const panelTransition = {
  duration: 0.35,
  ease: [0.23, 1, 0.32, 1] as const,
};

export function HeadDashboardOverview({
  eligibilityData,
  selfAssessmentStats,
  managerReviewStats,
  selectedCardFilter,
  onFilterByCard,
  calibrationData,
  statsVisible = true,
  chartsVisible = true,
}: HeadDashboardOverviewProps) {
  const [chartsKey, setChartsKey] = useState(0);
  const [chartReady, setChartReady] = useState(chartsVisible);
  const [wasChartsVisible, setWasChartsVisible] = useState(chartsVisible);

  if (chartsVisible !== wasChartsVisible) {
    setWasChartsVisible(chartsVisible);
    setChartReady(false);
  }

  useEffect(() => {
    if (!chartsVisible) {
      return;
    }

    if (chartReady) {
      const frame = window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const showTimer = window.setTimeout(() => {
      setChartsKey((key) => key + 1);
      setChartReady(true);
      window.dispatchEvent(new Event("resize"));
    }, 380);

    return () => window.clearTimeout(showTimer);
  }, [chartsVisible, statsVisible, chartReady]);

  if (!statsVisible && !chartsVisible) {
    return null;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "mb-8 grid grid-cols-1 gap-4 lg:items-stretch",
        statsVisible && chartsVisible ? "lg:grid-cols-2" : "lg:grid-cols-1",
      )}
    >
      <AnimatePresence initial={false}>
        {statsVisible ? (
          <motion.div
            key="head-stats"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={panelTransition}
            className="grid grid-cols-1 gap-4 overflow-hidden sm:grid-cols-2 lg:items-stretch"
          >
            <FormStatusStatCard delay={0.05} />
            <EligibilityStatCard
              data={eligibilityData}
              delay={0}
              onCategoryClick={(name) => onFilterByCard(`eligibility:${name}` as CardFilterId)}
              activeCategory={
                selectedCardFilter?.startsWith("eligibility:")
                  ? selectedCardFilter.slice("eligibility:".length)
                  : null
              }
            />
            <StatCard
              title="Staff Assessment"
              awaiting={selfAssessmentStats.awaiting}
              completed={selfAssessmentStats.completed}
              percentageLabel={selfAssessmentStats.percentageLabel}
              awaitingtitle="Eligible"
              completedtitle="Submitted"
              tone="slate"
              icon={User}
              delay={0.1}
              onAwaitingClick={() => onFilterByCard("selfAssessment:eligible")}
              onCompletedClick={() => onFilterByCard("selfAssessment:submitted")}
              awaitingActive={selectedCardFilter === "selfAssessment:eligible"}
              completedActive={selectedCardFilter === "selfAssessment:submitted"}
            />
            <ManagerReviewStatCard
              manager1={managerReviewStats.manager1}
              manager2={managerReviewStats.manager2}
              delay={0.2}
              onManager1SubmittedClick={() => onFilterByCard("manager1:submitted")}
              onManager1ReviewedClick={() => onFilterByCard("manager1:reviewed")}
              onManager2SubmittedClick={() => onFilterByCard("manager2:submitted")}
              onManager2ReviewedClick={() => onFilterByCard("manager2:reviewed")}
              manager1SubmittedActive={selectedCardFilter === "manager1:submitted"}
              manager1ReviewedActive={selectedCardFilter === "manager1:reviewed"}
              manager2SubmittedActive={selectedCardFilter === "manager2:submitted"}
              manager2ReviewedActive={selectedCardFilter === "manager2:reviewed"}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {chartsVisible ? (
          <motion.div
            key="head-charts"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={panelTransition}
            className="overflow-hidden"
          >
            <ChartCard
              title="Performance Rating Curve"
              delay={0.35}
              className="h-full min-h-80"
            >
              <div className="h-80">
                {chartReady ? (
                  <ResponsiveContainer
                    key={chartsKey}
                    width="100%"
                    height="100%"
                  >
                    <AreaChart
                      data={calibrationData}
                      margin={{ top: 20, right: 10, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id={`headQuotaGrad-${chartsKey}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#64748b"
                            stopOpacity={0.1}
                          />
                          <stop
                            offset="95%"
                            stopColor="#64748b"
                            stopOpacity={0}
                          />
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
                        fill={`url(#headQuotaGrad-${chartsKey})`}
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
                    </AreaChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </ChartCard>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
