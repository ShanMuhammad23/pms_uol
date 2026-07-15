"use client";

import { useDashboardChartMetrics } from "@/app/queries/charts";
import { useDashboardFilters } from "@/app/queries/dashboard-filters";
import { useFormSubmissionsQuery } from "@/app/queries/forms";
import {
  useEntitiesQuery,
  useStaffCategoriesWithSubCategoriesQuery,
  useUniqueDesignationsQuery,
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

  const { data: designations = [], isLoading: designationsLoading } =
    useUniqueDesignationsQuery();

  const {
    data: submissions = [],
    isLoading: submissionsLoading,
    error: submissionsError,
  } = useFormSubmissionsQuery();

  const matrixForDistribution = useMatrixForDistribution(performanceMatrix);

  const {
    searchQuery,
    setSearchQuery,
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
  } = useDashboardFilters({
    submissions,
    staffCategories,
    entities,
    designations,
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
    ...chartMetrics,
  };
}
