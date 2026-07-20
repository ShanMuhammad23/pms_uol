"use client";

import { DashboardFilterBar } from "@/app/components/dashboard/DashboardFilterBar";
import { DashboardPrimaryCharts } from "@/app/components/dashboard/DashboardPrimaryCharts";
import { DashboardSubmissionsTable } from "@/app/components/dashboard/DashboardSubmissionsTable";
import { DashboardWorkflowStatsRow } from "@/app/components/dashboard/DashboardWorkflowStatsRow";
import { useDashboardPage } from "@/app/queries/dashboard";

interface HRDashboardPageProps {
  role?: string | null;
}

export default function HRDashboardPage({ role }: HRDashboardPageProps) {
  const {
    selectedCategory0EntityIds,
    selectedCategory1EntityIds,
    selectedCategory2EntityIds,
    selectedRoleCategories,
    selectedDesignations,
    selectedFormStates,
    category0Options,
    category0DistributionOptions,
    category1Options,
    category2Options,
    roleCategoryOptions,
    designationOptions,
    formStateOptions,
    entitiesLoading,
    designationsLoading,
    submissionsLoading,
    submissionsError,
    performanceMatrixLoading,
    filteredSubmissions,
    submissions,
    activeFilters,
    handleCategory0EntityChange,
    handleCategory0DistributionSelect,
    handleCategory1EntityChange,
    handleCategory2EntityChange,
    handleRoleCategoryChange,
    handleDesignationChange,
    handleFormStateChange,
    clearAllFilters,
    filterByFormState,
    eligibilityData,
    selfAssessmentStats,
    managerReviewStats,
    hrAlignmentStats,
    boardApprovalStats,
    filteredCalibrationData,
    ratingQuartileMatrix,
  } = useDashboardPage();

  return (
    <div className="min-h-screen w-full max-w-full min-w-0 overflow-x-hidden bg-slate-50 dark:bg-slate-950 p-2">
      <div className="mx-auto w-full max-w-full min-w-0 ">
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
          designationsLoading={designationsLoading}
          selectedFormStates={selectedFormStates}
          onFormStateChange={handleFormStateChange}
          formStateOptions={formStateOptions}
          entitiesLoading={entitiesLoading}
          activeFilters={activeFilters}
          onClearAllFilters={clearAllFilters}
        />

        <DashboardWorkflowStatsRow
          eligibilityData={eligibilityData}
          selfAssessmentStats={selfAssessmentStats}
          managerReviewStats={managerReviewStats}
          hrAlignmentStats={hrAlignmentStats}
          boardApprovalStats={boardApprovalStats}
          selectedFormStates={selectedFormStates}
          onFilterByFormState={filterByFormState}
        />

        <DashboardPrimaryCharts
          calibrationData={filteredCalibrationData}
          ratingQuartileMatrix={ratingQuartileMatrix}
          employeeCount={filteredSubmissions.length}
          performanceMatrixLoading={performanceMatrixLoading}
          role={role}
        />

        <DashboardSubmissionsTable
          submissions={filteredSubmissions}
          allSubmissions={submissions}
          isLoading={submissionsLoading}
          error={submissionsError}
          onClearAllFilters={clearAllFilters}
        />
      </div>
    </div>
  );
}
