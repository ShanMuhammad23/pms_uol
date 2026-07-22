"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { useDashboardChartMetrics } from "@/app/queries/charts";
import { useDashboardFilters } from "@/app/queries/dashboard-filters";
import {
  useDashboardOverviewQuery,
  useFormSubmissionsQuery,
} from "@/app/queries/forms";
import {
  useDashboardEntitiesQuery,
  useUniqueDesignationsQuery,
} from "@/app/queries/organization";
import {
  useActiveFinancialYearId,
  useFinancialYearsQuery,
  useInstitutionalQuotaChartQuery,
  useMatrixForDistribution,
  usePerformanceMatrixQuery,
} from "@/app/queries/performance";
import { matchesSubmissionFilters } from "@/app/helpers/dashboard-filters";
import { useIsDarkMode } from "@/app/helpers/dashboard-theme";
import { submissionVisibleToHead } from "@/app/helpers/manager-review";
import { isHeadRole } from "@/lib/auth/home-path";
import type { FormSubmissionListItem } from "@/types/form-submissions";

function scopeSubmissionsForHead(
  submissions: FormSubmissionListItem[],
  headEntityId: number | null,
  entities: Parameters<typeof submissionVisibleToHead>[2],
) {
  if (headEntityId == null || !Number.isFinite(headEntityId)) {
    return submissions;
  }

  return submissions.filter((submission) =>
    submissionVisibleToHead(headEntityId, submission, entities),
  );
}

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

  const { data: entities = [], isLoading: entitiesLoading } =
    useDashboardEntitiesQuery();

  const { data: designations = [], isLoading: designationsLoading } =
    useUniqueDesignationsQuery();

  const {
    data: overview = [],
    isLoading: overviewLoading,
  } = useDashboardOverviewQuery();

  const {
    data: submissions = [],
    isLoading: submissionsLoading,
    error: submissionsError,
  } = useFormSubmissionsQuery();

  const scopedOverview = useMemo(
    () => scopeSubmissionsForHead(overview, headEntityId, entities),
    [overview, headEntityId, entities],
  );

  const scopedSubmissions = useMemo(
    () => scopeSubmissionsForHead(submissions, headEntityId, entities),
    [submissions, headEntityId, entities],
  );

  const matrixForDistribution = useMatrixForDistribution(performanceMatrix);

  const {
    searchQuery,
    setSearchQuery,
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
    filteredSubmissions: filteredOverview,
    filterState,
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
  } = useDashboardFilters({
    submissions: scopedOverview,
    entities,
    designations,
  });

  const filteredSubmissions = useMemo(() => {
    if (scopedSubmissions.length === 0) {
      return [];
    }

    return scopedSubmissions.filter((submission) =>
      matchesSubmissionFilters(submission, filterState),
    );
  }, [scopedSubmissions, filterState]);

  const chartMetrics = useDashboardChartMetrics({
    filteredSubmissions: filteredOverview,
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
    overviewLoading,
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
    handleRoleCategoryChange,
    handleDesignationChange,
    handleFormStateChange,
    clearAllFilters,
    filterByFormState,
    ...chartMetrics,
  };
}
