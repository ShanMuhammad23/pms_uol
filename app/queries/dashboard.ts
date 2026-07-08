"use client";

import { useDashboardChartMetrics } from "@/app/queries/charts";
import { useDashboardFilters } from "@/app/queries/dashboard-filters";
import { useFormSubmissionsQuery } from "@/app/queries/forms";
import {
  useEntitiesQuery,
  useSortedEntities,
  useStaffCategoriesWithSubCategoriesQuery,
} from "@/app/queries/organization";
import {
  useActiveFinancialYearId,
  useFinancialYearsQuery,
  useMatrixForDistribution,
  usePerformanceMatrixQuery,
} from "@/app/queries/performance";
import { useIsDarkMode } from "@/app/helpers/dashboard-theme";

export function useDashboardPage() {
  const isDarkMode = useIsDarkMode();

  const { data: financialYears } = useFinancialYearsQuery();
  const activeFinancialYearId = useActiveFinancialYearId(financialYears);

  const { data: performanceMatrix, isLoading: performanceMatrixLoading } =
    usePerformanceMatrixQuery(activeFinancialYearId);

  const { data: staffCategories = [], isLoading: staffCategoriesLoading } =
    useStaffCategoriesWithSubCategoriesQuery();

  const { data: entities = [], isLoading: entitiesLoading } = useEntitiesQuery();

  const {
    data: submissions = [],
    isLoading: submissionsLoading,
    error: submissionsError,
  } = useFormSubmissionsQuery();

  const matrixForDistribution = useMatrixForDistribution(performanceMatrix);
  const sortedEntities = useSortedEntities(entities);

  const {
    searchQuery,
    setSearchQuery,
    selectedEntityId,
    setSelectedEntityId,
    selectedCategoryId,
    selectedSubCategoryId,
    setSelectedSubCategoryId,
    selectedFormState,
    setSelectedFormState,
    availableSubCategories,
    filteredSubmissions,
    activeFilters,
    handleCategoryChange,
    clearAllFilters,
    filterByFormState,
  } = useDashboardFilters({
    submissions,
    staffCategories,
    entities,
  });

  const chartMetrics = useDashboardChartMetrics({
    filteredSubmissions,
    staffCategories,
    isDarkMode,
    matrixForDistribution,
  });

  return {
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
    ...chartMetrics,
  };
}
