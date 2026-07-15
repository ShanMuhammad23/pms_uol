"use client";

import { DashboardCategoryCharts } from "@/app/components/dashboard/DashboardCategoryCharts";
import { DashboardFilterBar } from "@/app/components/dashboard/DashboardFilterBar";
import { DashboardPrimaryCharts } from "@/app/components/dashboard/DashboardPrimaryCharts";
import { DashboardSubmissionsTable } from "@/app/components/dashboard/DashboardSubmissionsTable";
import { DashboardWorkflowStatsRow } from "@/app/components/dashboard/DashboardWorkflowStatsRow";
import { useDashboardPage } from "@/app/queries/dashboard";

export default function HRDashboardPage() {
  const {
    isDarkMode,
    searchQuery,
    setSearchQuery,
    selectedCategory0EntityId,
    selectedCategory1EntityId,
    selectedCategory2EntityId,
    setSelectedCategory2EntityId,
    selectedCategoryId,
    selectedSubCategoryId,
    setSelectedSubCategoryId,
    selectedFormState,
    setSelectedFormState,
    category0Entities,
    category1Entities,
    category2Entities,
    staffCategories,
    availableSubCategories,
    entitiesLoading,
    staffCategoriesLoading,
    submissionsLoading,
    submissionsError,
    performanceMatrixLoading,
    filteredSubmissions,
    activeFilters,
    handleCategory0EntityChange,
    handleCategory1EntityChange,
    handleStaffCategoryChange,
    clearAllFilters,
    filterByFormState,
    eligibilityData,
    selfAssessmentStats,
    managerReviewStats,
    hrAlignmentStats,
    filteredCalibrationData,
    ratingQuartileMatrix,
    themedCategoryDistribution,
    filteredCompletionByCategory,
    pieLabelRenderer,
  } = useDashboardPage();

  return (
    <div className="min-h-screen w-full max-w-full min-w-0 overflow-x-hidden bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-full min-w-0 ">
        <DashboardFilterBar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          selectedCategory0EntityId={selectedCategory0EntityId}
          onCategory0EntityChange={handleCategory0EntityChange}
          selectedCategory1EntityId={selectedCategory1EntityId}
          onCategory1EntityChange={handleCategory1EntityChange}
          selectedCategory2EntityId={selectedCategory2EntityId}
          onCategory2EntityChange={setSelectedCategory2EntityId}
          category0Entities={category0Entities}
          category1Entities={category1Entities}
          category2Entities={category2Entities}
          selectedCategoryId={selectedCategoryId}
          onStaffCategoryChange={handleStaffCategoryChange}
          selectedSubCategoryId={selectedSubCategoryId}
          onSubCategoryChange={setSelectedSubCategoryId}
          selectedFormState={selectedFormState}
          onFormStateChange={setSelectedFormState}
          staffCategories={staffCategories}
          availableSubCategories={availableSubCategories}
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
          selectedFormState={selectedFormState}
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
