"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { useDashboardChartMetrics } from "@/app/queries/charts";
import { useDashboardFilters } from "@/app/queries/dashboard-filters";
import { useFormSubmissionsQuery } from "@/app/queries/forms";
import {
  useDashboardEntitiesQuery,
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
import { submissionInEntitySubtree } from "@/app/helpers/entity-scope";
import { isHeadRole } from "@/lib/auth/home-path";

export function useDashboardPage() {
  const isDarkMode = useIsDarkMode();
  const { data: session } = useSession();
  const isHead = isHeadRole(session?.user?.role);
  const headEntityId =
    isHead && session?.user?.entityId != null
      ? Number(session.user.entityId)
      : null;

  const { data: financialYears } = useFinancialYearsQuery();
  const activeFinancialYearId = useActiveFinancialYearId(financialYears);

  const { data: performanceMatrix, isLoading: performanceMatrixLoading } =
    usePerformanceMatrixQuery(activeFinancialYearId);

  const { data: institutionalQuotaRows } =
    useInstitutionalQuotaChartQuery(activeFinancialYearId);

  const { data: staffCategories = [], isLoading: staffCategoriesLoading } =
    useStaffCategoriesWithSubCategoriesQuery();

  const { data: entities = [], isLoading: entitiesLoading } =
    useDashboardEntitiesQuery();

  const { data: designations = [], isLoading: designationsLoading } =
    useUniqueDesignationsQuery();

  const {
    data: submissions = [],
    isLoading: submissionsLoading,
    error: submissionsError,
  } = useFormSubmissionsQuery();

  const scopedSubmissions = useMemo(() => {
    if (headEntityId == null || !Number.isFinite(headEntityId)) {
      return submissions;
    }

    return submissions.filter((submission) =>
      submissionInEntitySubtree(submission, headEntityId, entities),
    );
  }, [submissions, headEntityId, entities]);

  const matrixForDistribution = useMatrixForDistribution(performanceMatrix);

  const {
    searchQuery,
    setSearchQuery,
    selectedCategory0EntityIds,
    selectedCategory1EntityIds,
    selectedCategory2EntityIds,
    selectedCategoryIds,
    selectedSubCategoryIds,
    selectedRoleCategories,
    selectedDesignations,
    selectedFormStates,
    category0Options,
    category0DistributionOptions,
    category1Options,
    category2Options,
    staffCategoryOptions,
    staffSubCategoryOptions,
    roleCategoryOptions,
    designationOptions,
    formStateOptions,
    filteredSubmissions,
    activeFilters,
    handleCategory0EntityChange,
    handleCategory0DistributionSelect,
    handleCategory1EntityChange,
    handleCategory2EntityChange,
    handleStaffCategoryChange,
    handleRoleCategoryChange,
    handleSubCategoryChange,
    handleDesignationChange,
    handleFormStateChange,
    clearAllFilters,
    filterByFormState,
  } = useDashboardFilters({
    submissions: scopedSubmissions,
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
    selectedRoleCategories,
    selectedDesignations,
    selectedFormStates,
    category0Options,
    category0DistributionOptions,
    category1Options,
    category2Options,
    staffCategoryOptions,
    staffSubCategoryOptions,
    roleCategoryOptions,
    designationOptions,
    formStateOptions,
    entitiesLoading,
    staffCategoriesLoading,
    designationsLoading,
    submissionsLoading,
    submissionsError,
    submissions: scopedSubmissions,
    performanceMatrixLoading,
    filteredSubmissions,
    activeFilters,
    handleCategory0EntityChange,
    handleCategory0DistributionSelect,
    handleCategory1EntityChange,
    handleCategory2EntityChange,
    handleStaffCategoryChange,
    handleRoleCategoryChange,
    handleSubCategoryChange,
    handleDesignationChange,
    handleFormStateChange,
    clearAllFilters,
    filterByFormState,
    ...chartMetrics,
  };
}
