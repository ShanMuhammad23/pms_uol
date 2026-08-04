"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DASHBOARD_QUERY_CACHE } from "@/app/queries/query-cache";
import { queryKeys } from "@/app/queries/keys";
import { MOCK_PERFORMANCE_MATRIX } from "@/app/helpers/dashboard-performance-matrix";
import { fetchDashboardFinancialYears } from "@/lib/queries/financial-years-client";
import { fetchInstitutionalQuotaChartRows } from "@/lib/queries/institutional-quotas-client";
import { fetchDashboardPerformanceMatrix } from "@/lib/queries/performance-matrices-client";
import type { FinancialYearRecord } from "@/types/financial-years";
import type { InstitutionalQuotaChartRow } from "@/types/institutional-quotas";
import type { PerformanceLevelWithQuartiles } from "@/types/performance-matrices";

export function useFinancialYearsQuery() {
  return useQuery({
    queryKey: queryKeys.financialYears,
    queryFn: fetchDashboardFinancialYears,
    ...DASHBOARD_QUERY_CACHE,
  });
}

export function useActiveFinancialYearId(
  financialYears: FinancialYearRecord[] | undefined,
) {
  return useMemo(() => {
    if (!financialYears?.length) {
      return null;
    }

    return (financialYears.find((year) => year.isActive) ?? financialYears[0]).id;
  }, [financialYears]);
}

export function usePerformanceMatrixQuery(activeFinancialYearId: number | null) {
  return useQuery({
    queryKey: queryKeys.performanceMatrix(activeFinancialYearId),
    queryFn: () => fetchDashboardPerformanceMatrix(activeFinancialYearId!),
    enabled: activeFinancialYearId !== null,
    ...DASHBOARD_QUERY_CACHE,
  });
}

/** Performance Rating Curve — institutional quota from DB */
export function useInstitutionalQuotaChartQuery(
  activeFinancialYearId: number | null,
) {
  return useQuery({
    queryKey: queryKeys.institutionalQuotaChart(activeFinancialYearId),
    queryFn: (): Promise<InstitutionalQuotaChartRow[]> =>
      fetchInstitutionalQuotaChartRows(activeFinancialYearId),
    enabled: activeFinancialYearId !== null,
    ...DASHBOARD_QUERY_CACHE,
  });
}

export function useMatrixForDistribution(
  performanceMatrix: PerformanceLevelWithQuartiles[] | undefined,
) {
  return useMemo(
    () =>
      performanceMatrix && performanceMatrix.length > 0
        ? performanceMatrix
        : MOCK_PERFORMANCE_MATRIX,
    [performanceMatrix],
  );
}
