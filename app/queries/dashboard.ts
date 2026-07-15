"use client";

import { useDashboardChartMetrics } from "@/app/queries/charts";
import { useDashboardFilters } from "@/app/queries/dashboard-filters";
import { useFormSubmissionsQuery } from "@/app/queries/forms";
import {
  useEntitiesQuery,
  useStaffCategoriesWithSubCategoriesQuery,
} from "@/app/queries/organization";
import {
  useActiveFinancialYearId,
  useFinancialYearsQuery,
  useInstitutionalQuotaChartQuery,
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

  const { data: institutionalQuotaRows } =
    useInstitutionalQuotaChartQuery(activeFinancialYearId);

  const { data: staffCategories = [], isLoading: staffCategoriesLoading } =
    useStaffCategoriesWithSubCategoriesQuery();

  const { data: entities = [], isLoading: entitiesLoading } = useEntitiesQuery();

  const {
    data: submissions = [],
    isLoading: submissionsLoading,
    error: submissionsError,
  } = useFormSubmissionsQuery();

  const matrixForDistribution = useMatrixForDistribution(performanceMatrix);

  const {
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
    availableSubCategories,
    filteredSubmissions,
    activeFilters,
    handleCategory0EntityChange,
    handleCategory1EntityChange,
    handleStaffCategoryChange,
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
    institutionalQuotaRows,
  });

  return {
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
    ...chartMetrics,
  };
}
