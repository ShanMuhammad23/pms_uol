"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/app/queries/keys";
import { MOCK_PERFORMANCE_MATRIX } from "@/app/helpers/dashboard-performance-matrix";
import { fetchFinancialYears } from "@/lib/queries/financial-years-client";
import { fetchInstitutionalQuotas } from "@/lib/queries/institutional-quotas-client";
import { fetchPerformanceMatrix } from "@/lib/queries/performance-matrices-client";
import type { FinancialYearRecord } from "@/types/financial-years";
import type { InstitutionalQuotaRecord } from "@/types/institutional-quotas";
import type { PerformanceLevelWithQuartiles } from "@/types/performance-matrices";
import { RATING_LABELS } from "@/types/forms";

export function useFinancialYearsQuery() {
  return useQuery({
    queryKey: queryKeys.financialYears,
    queryFn: fetchFinancialYears,
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
    queryFn: () => fetchPerformanceMatrix(activeFinancialYearId!),
    enabled: activeFinancialYearId !== null,
  });
}

export function useInstitutionalQuotasQuery(activeFinancialYearId: number | null) {
  return useQuery({
    queryKey: queryKeys.institutionalQuotas(activeFinancialYearId),
    queryFn: () => fetchInstitutionalQuotas(activeFinancialYearId!),
    enabled: activeFinancialYearId !== null,
  });
}

export function useQuotaChartRows(
  quotas: InstitutionalQuotaRecord[] | undefined,
) {
  return useMemo(
    () =>
      quotas && quotas.length > 0
        ? [...quotas]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((row) => ({
              rating: RATING_LABELS[row.rating],
              quota: row.quotaPercent,
            }))
        : undefined,
    [quotas],
  );
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
