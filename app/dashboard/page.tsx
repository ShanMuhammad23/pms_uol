"use client";

import { DashboardFilterBar } from "@/app/components/dashboard/DashboardFilterBar";
import { DashboardPrimaryCharts } from "@/app/components/dashboard/DashboardPrimaryCharts";
import { DashboardSubmissionsTable } from "@/app/components/dashboard/DashboardSubmissionsTable";
import { DashboardWorkflowStatsRow } from "@/app/components/dashboard/DashboardWorkflowStatsRow";
import { useDashboardPage } from "@/app/queries/dashboard";

export default function HRDashboardPage() {
  const {
    selectedCategory0EntityIds,
    selectedCategory1EntityIds,
    selectedCategory2EntityIds,
    selectedCategoryIds,
    selectedSubCategoryIds,
    selectedDesignations,
    selectedFormStates,
    category0Options,
    category1Options,
    category2Options,
    staffCategoryOptions,
    staffSubCategoryOptions,
    designationOptions,
    formStateOptions,
    entitiesLoading,
    staffCategoriesLoading,
    designationsLoading,
    submissionsLoading,
    submissionsError,
    performanceMatrixLoading,
    filteredSubmissions,
    activeFilters,
    handleCategory0EntityChange,
    handleCategory1EntityChange,
    handleCategory2EntityChange,
    handleStaffCategoryChange,
    handleSubCategoryChange,
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
          category1Options={category1Options}
          category2Options={category2Options}
          selectedCategoryIds={selectedCategoryIds}
          onStaffCategoryChange={handleStaffCategoryChange}
          selectedSubCategoryIds={selectedSubCategoryIds}
          onSubCategoryChange={handleSubCategoryChange}
          staffCategoryOptions={staffCategoryOptions}
          staffSubCategoryOptions={staffSubCategoryOptions}
          selectedDesignations={selectedDesignations}
          onDesignationChange={handleDesignationChange}
          designationOptions={designationOptions}
          designationsLoading={designationsLoading}
          selectedFormStates={selectedFormStates}
          onFormStateChange={handleFormStateChange}
          formStateOptions={formStateOptions}
          entitiesLoading={entitiesLoading}
          staffCategoriesLoading={staffCategoriesLoading}
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
        />

        <DashboardSubmissionsTable
          submissions={filteredSubmissions}
          isLoading={submissionsLoading}
          error={submissionsError}
          onClearAllFilters={clearAllFilters}
        />
      </div>
    </div>
  );
}
