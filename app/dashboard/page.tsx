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
    selectedEntityId,
    setSelectedEntityId,
    selectedCategoryId,
    selectedSubCategoryId,
    setSelectedSubCategoryId,
    selectedFormState,
    setSelectedFormState,
    sortedEntities,
    staffCategories,
    availableSubCategories,
    entitiesLoading,
    staffCategoriesLoading,
    submissionsLoading,
    submissionsError,
    performanceMatrixLoading,
    filteredSubmissions,
    activeFilters,
    handleCategoryChange,
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto px-4 sm:px-6">
        <DashboardFilterBar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          selectedEntityId={selectedEntityId}
          onEntityChange={setSelectedEntityId}
          selectedCategoryId={selectedCategoryId}
          onCategoryChange={handleCategoryChange}
          selectedSubCategoryId={selectedSubCategoryId}
          onSubCategoryChange={setSelectedSubCategoryId}
          selectedFormState={selectedFormState}
          onFormStateChange={setSelectedFormState}
          sortedEntities={sortedEntities}
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
