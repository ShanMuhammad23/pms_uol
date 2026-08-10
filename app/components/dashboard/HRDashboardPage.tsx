"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardList, LayoutDashboard } from "lucide-react";
import { DashboardFilterBar } from "@/app/components/dashboard/DashboardFilterBar";
import { DashboardPrimaryCharts } from "@/app/components/dashboard/DashboardPrimaryCharts";
import { DashboardSectionToggles } from "@/app/components/dashboard/DashboardSectionToggles";
import { DashboardSubmissionsTable } from "@/app/components/dashboard/DashboardSubmissionsTable";
import { DashboardWorkflowStatsRow } from "@/app/components/dashboard/DashboardWorkflowStatsRow";
import DirectAssessmentTab from "@/app/components/dashboard/DirectAssessmentTab";
import { HeadDashboardOverview } from "@/app/components/dashboard/HeadDashboardOverview";
import { useDashboardPage } from "@/app/queries/dashboard";
import {
  HEAD_DASHBOARD_TABLE_COLUMN_IDS,
  ADDITIONAL_ACCESS_MODULE_COLUMNS,
} from "@/app/helpers/dashboard-table-columns";
import { isHeadRole } from "@/lib/auth/home-path";
import { canAccessDashboardSubmissions } from "@/lib/auth/submission-review-roles";
import { useAdditionalAccess } from "@/app/queries/use-additional-access";
import { useSession } from "next-auth/react";
import { useMemo } from "react";
import type { DashboardTableColumnId } from "@/app/helpers/dashboard-table-columns";
import type { AdditionalAccessModule } from "@/types/additional-access";
import { cn } from "@/lib/utils";

interface HRDashboardPageProps {
  role?: string | null;
}

const panelTransition = {
  duration: 0.35,
  ease: [0.23, 1, 0.32, 1] as const,
};

type DashboardTab = "overview" | "direct-assessment";

export default function HRDashboardPage({ role }: HRDashboardPageProps) {
  const isHead = isHeadRole(role);
  const canAccessDirectAssessment = canAccessDashboardSubmissions(role ?? undefined);
  const { data: session } = useSession();
  const { canView, permissions } = useAdditionalAccess(
    session?.user?.id ? Number(session.user.id) : undefined,
    session?.user?.role,
  );

  const allowedColumnIds = useMemo(() => {
    if (!isHead) return undefined;
    const base = HEAD_DASHBOARD_TABLE_COLUMN_IDS as readonly DashboardTableColumnId[];
    const extra: DashboardTableColumnId[] = [];
    for (const module of Object.keys(ADDITIONAL_ACCESS_MODULE_COLUMNS) as AdditionalAccessModule[]) {
      if (canView(module)) {
        extra.push(...ADDITIONAL_ACCESS_MODULE_COLUMNS[module]);
      }
    }
    if (extra.length === 0) return base;
    return [...base, ...extra];
    // canView is excluded from deps because it is a new function reference on
    // every render. It closes over `permissions`, so depending on `permissions`
    // is sufficient to recompute when access actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHead, permissions]);

  const [statsVisible, setStatsVisible] = useState(true);
  const [chartsVisible, setChartsVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const {
    selectedCategory0EntityIds,
    selectedCategory1EntityIds,
    selectedCategory2EntityIds,
    selectedRoleCategories,
    selectedDesignations,
    selectedFormStates,
    selectedCardFilter,
    category0Options,
    category0DistributionOptions,
    category1Options,
    category2Options,
    roleCategoryOptions,
    designationOptions,
    formStateOptions,
    entitiesLoading,
    designationsLoading,
    overviewLoading,
    filterParams,
    performanceMatrixLoading,
    activeFilters,
    handleCategory0EntityChange,
    handleCategory0DistributionSelect,
    handleCategory1EntityChange,
    handleCategory2EntityChange,
    handleRoleCategoryChange,
    handleDesignationChange,
    handleFormStateChange,
    clearAllFilters,
    filterByCard,
    eligibilityData,
    selfAssessmentStats,
    managerReviewStats,
    hrAlignmentStats,
    boardApprovalStats,
    filteredCalibrationData,
    ratingQuartileMatrix,
    chartSubmissionsCount,
    matrixForDistribution,
  } = useDashboardPage();

  const tableClearAllRef = useRef<(() => void) | null>(null);
  const [tableHasActiveFilters, setTableHasActiveFilters] = useState(false);
  const registerTableClearAll = useCallback((clearFn: () => void) => {
    tableClearAllRef.current = clearFn;
  }, []);
  const globalClearAllFilters = useCallback(() => {
    tableClearAllRef.current?.();
  }, []);

  return (
    <div className="relative min-h-screen w-full max-w-full min-w-0 overflow-x-hidden bg-slate-50 p-2 dark:bg-slate-950">
      {canAccessDirectAssessment ? (
        <div className="mb-2 flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("overview")}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
              activeTab === "overview"
                ? "border-violet-500 text-violet-700 dark:border-violet-400 dark:text-violet-300"
                : "border-transparent text-foreground/60 hover:text-text-primary",
            )}
          >
            <LayoutDashboard className="size-3.5" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab("direct-assessment")}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
              activeTab === "direct-assessment"
                ? "border-violet-500 text-violet-700 dark:border-violet-400 dark:text-violet-300"
                : "border-transparent text-foreground/60 hover:text-text-primary",
            )}
          >
            <ClipboardList className="size-3.5" />
            Direct Assessment
          </button>
        </div>
      ) : null}

      {activeTab === "direct-assessment" && canAccessDirectAssessment ? (
        <div className="mx-auto w-full max-w-full min-w-0">
          <DirectAssessmentTab />
        </div>
      ) : (
        <>
      <DashboardSectionToggles
        statsVisible={statsVisible}
        onToggleStats={() => setStatsVisible((current) => !current)}
        chartsVisible={chartsVisible}
        onToggleCharts={() => setChartsVisible((current) => !current)}
      />

      <div className="mx-auto w-full max-w-full min-w-0">
        <DashboardFilterBar
          selectedCategory0EntityIds={selectedCategory0EntityIds}
          onCategory0EntityChange={handleCategory0EntityChange}
          selectedCategory1EntityIds={selectedCategory1EntityIds}
          onCategory1EntityChange={handleCategory1EntityChange}
          selectedCategory2EntityIds={selectedCategory2EntityIds}
          onCategory2EntityChange={handleCategory2EntityChange}
          category0Options={category0Options}
          category0DistributionOptions={category0DistributionOptions}
          onCategory0DistributionSelect={handleCategory0DistributionSelect}
          category1Options={category1Options}
          category2Options={category2Options}
          selectedRoleCategories={selectedRoleCategories}
          onRoleCategoryChange={handleRoleCategoryChange}
          roleCategoryOptions={roleCategoryOptions}
          selectedDesignations={selectedDesignations}
          onDesignationChange={handleDesignationChange}
          designationOptions={designationOptions}
          designationsLoading={designationsLoading || overviewLoading}
          selectedFormStates={selectedFormStates}
          onFormStateChange={handleFormStateChange}
          formStateOptions={formStateOptions}
          entitiesLoading={entitiesLoading || overviewLoading}
          activeFilters={activeFilters}
          onClearAllFilters={clearAllFilters}
          hasGlobalActiveFilters={tableHasActiveFilters}
          onGlobalClearAllFilters={globalClearAllFilters}
        />

        {isHead ? (
          <HeadDashboardOverview
            eligibilityData={eligibilityData}
            selfAssessmentStats={selfAssessmentStats}
            managerReviewStats={managerReviewStats}
            selectedCardFilter={selectedCardFilter}
            onFilterByCard={filterByCard}
            calibrationData={filteredCalibrationData}
            statsVisible={statsVisible}
            chartsVisible={chartsVisible}
          />
        ) : (
          <>
            <AnimatePresence initial={false}>
              {statsVisible ? (
                <motion.div
                  key="workflow-stats"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 32 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={panelTransition}
                  className="overflow-hidden"
                >
                  <DashboardWorkflowStatsRow
                    eligibilityData={eligibilityData}
                    selfAssessmentStats={selfAssessmentStats}
                    managerReviewStats={managerReviewStats}
                    hrAlignmentStats={hrAlignmentStats}
                    boardApprovalStats={boardApprovalStats}
                    selectedCardFilter={selectedCardFilter}
                    onFilterByCard={filterByCard}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {chartsVisible ? (
                <motion.div
                  key="primary-charts"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={panelTransition}
                  className="overflow-hidden"
                >
                  <DashboardPrimaryCharts
                    calibrationData={filteredCalibrationData}
                    ratingQuartileMatrix={ratingQuartileMatrix}
                    employeeCount={chartSubmissionsCount}
                    performanceMatrixLoading={performanceMatrixLoading}
                    role={role}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </>
        )}

        <DashboardSubmissionsTable
          filterParams={filterParams}
          onClearAllFilters={clearAllFilters}
          allowedColumnIds={allowedColumnIds}
          role={role}
          performanceMatrix={matrixForDistribution}
          onRegisterClearAll={registerTableClearAll}
          onActiveFiltersChange={setTableHasActiveFilters}
        />
      </div>
        </>
      )}
    </div>
  );
}
