"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { ELIGIBILITY_CONFIG } from "@/app/helpers/dashboard-chart-config";
import {
  buildCalibrationDataFromCounts,
  buildEligibilityDataFromCounts,
  buildRatingQuartileMatrixFromCounts,
} from "@/app/helpers/dashboard-overview-metrics";
import { useIsDarkMode } from "@/app/helpers/dashboard-theme";
import { useDashboardFilters } from "@/app/queries/dashboard-filters";
import { useDashboardOverviewQuery } from "@/app/queries/forms";
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
import { isHeadRole } from "@/lib/auth/home-path";
import type { EligibilityStatus } from "@/app/helpers/dashboard-types";
import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import type { CountOption } from "@/types/dashboard-api";

function mergeEntityOptions(
  options: MultiSelectOption[],
  counts: CountOption[] | undefined,
): MultiSelectOption[] {
  const countByValue = new Map(
    (counts ?? []).map((row) => [row.value, row.count]),
  );
  return options.map((option) => ({
    ...option,
    count: countByValue.get(option.value) ?? 0,
  }));
}

function mergeValueOptions(
  options: MultiSelectOption[],
  counts: CountOption[] | undefined,
  opts?: { keepZero?: boolean },
): MultiSelectOption[] {
  const countByValue = new Map(
    (counts ?? []).map((row) => [row.value, row.count]),
  );
  const merged = options.map((option) => ({
    ...option,
    count: countByValue.get(option.value) ?? 0,
  }));

  if (opts?.keepZero) {
    for (const row of counts ?? []) {
      if (!merged.some((option) => option.value === row.value)) {
        merged.push({
          value: row.value,
          label: row.value,
          count: row.count,
        });
      }
    }
  }

  return merged;
}

export function useDashboardPage() {
  const isDarkMode = useIsDarkMode();
  const { data: session } = useSession();
  const isHead = isHeadRole(session?.user?.role);

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
    searchQuery,
    setSearchQuery,
    selectedCategory0EntityIds,
    selectedCategory1EntityIds,
    selectedCategory2EntityIds,
    selectedRoleCategories,
    selectedDesignations,
    selectedFormStates,
    category0Options: baseCategory0Options,
    category0DistributionOptions: baseCategory0DistributionOptions,
    category1Options: baseCategory1Options,
    category2Options: baseCategory2Options,
    roleCategoryOptions: baseRoleCategoryOptions,
    designationOptions: baseDesignationOptions,
    formStateOptions: baseFormStateOptions,
    filterParams,
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
    entities,
    designations,
  });

  const {
    data: overview,
    isLoading: overviewLoading,
  } = useDashboardOverviewQuery(filterParams);

  const category0Options = useMemo(
    () => mergeEntityOptions(baseCategory0Options, overview?.filters.category0),
    [baseCategory0Options, overview?.filters.category0],
  );

  const category1Options = useMemo(
    () => mergeEntityOptions(baseCategory1Options, overview?.filters.category1),
    [baseCategory1Options, overview?.filters.category1],
  );

  const category2Options = useMemo(
    () => mergeEntityOptions(baseCategory2Options, overview?.filters.category2),
    [baseCategory2Options, overview?.filters.category2],
  );

  const category0DistributionOptions = useMemo(() => {
    const merged = mergeEntityOptions(
      baseCategory0DistributionOptions.length > 0
        ? baseCategory0DistributionOptions
        : category0Options,
      overview?.filters.category0Distribution,
    );
    return merged.filter((option) => option.count > 0);
  }, [
    baseCategory0DistributionOptions,
    category0Options,
    overview?.filters.category0Distribution,
  ]);

  const roleCategoryOptions = useMemo(
    () =>
      mergeValueOptions(
        baseRoleCategoryOptions,
        overview?.filters.roleCategories,
        { keepZero: true },
      ),
    [baseRoleCategoryOptions, overview?.filters.roleCategories],
  );

  const designationOptions = useMemo(
    () =>
      mergeValueOptions(
        baseDesignationOptions,
        overview?.filters.designations,
      ).filter((option) => option.count > 0),
    [baseDesignationOptions, overview?.filters.designations],
  );

  const formStateOptions = useMemo(
    () =>
      mergeValueOptions(baseFormStateOptions, overview?.filters.formStates),
    [baseFormStateOptions, overview?.filters.formStates],
  );

  const matrixForDistribution = useMatrixForDistribution(performanceMatrix);

  const eligibilityData = useMemo(() => {
    if (!overview) {
      return (Object.keys(ELIGIBILITY_CONFIG) as EligibilityStatus[]).map(
        (name) => ({
          name,
          value: 0,
          color: isDarkMode
            ? ELIGIBILITY_CONFIG[name].dark
            : ELIGIBILITY_CONFIG[name].light,
        }),
      );
    }
    return buildEligibilityDataFromCounts(overview.eligibility, isDarkMode);
  }, [overview, isDarkMode]);

  const filteredCalibrationData = useMemo(
    () =>
      buildCalibrationDataFromCounts(
        overview?.ratingDistribution ?? [],
        institutionalQuotaRows,
        overview?.quotaEligibleCount ?? 0,
      ),
    [overview, institutionalQuotaRows],
  );

  const ratingQuartileMatrix = useMemo(
    () =>
      buildRatingQuartileMatrixFromCounts(
        overview?.ratingQuartileCounts ?? [],
        matrixForDistribution,
      ),
    [overview?.ratingQuartileCounts, matrixForDistribution],
  );

  return {
    isDarkMode,
    isHead,
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
    filterParams,
    performanceMatrixLoading,
    matrixForDistribution,
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
    selfAssessmentStats: overview?.workflow.selfAssessment ?? {
      awaiting: 0,
      completed: 0,
      percentageLabel: "—",
    },
    managerReviewStats: {
      manager1: overview?.workflow.manager1 ?? {
        awaiting: 0,
        completed: 0,
        percentageLabel: "—",
      },
      manager2: overview?.workflow.manager2 ?? {
        awaiting: 0,
        completed: 0,
        percentageLabel: "—",
      },
    },
    hrAlignmentStats: overview?.workflow.hrAlignment ?? {
      awaiting: 0,
      completed: 0,
      percentageLabel: "—",
    },
    boardApprovalStats: overview?.workflow.boardApproval ?? {
      awaiting: 0,
      completed: 0,
      percentageLabel: "—",
    },
    filteredCalibrationData,
    ratingQuartileMatrix,
    chartSubmissionsCount: overview?.chartEmployeeCount ?? 0,
  };
}
