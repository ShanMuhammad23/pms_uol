"use client";

import { useQuery } from "@tanstack/react-query";
import { DASHBOARD_QUERY_CACHE } from "@/app/queries/query-cache";
import { queryKeys } from "@/app/queries/keys";
import {
  fetchDashboardOverview,
  fetchFormSubmissionsPage,
} from "@/lib/queries/form-submissions-client";
import {
  buildFormSubmissionsSearchParams,
  buildOverviewSearchParams,
} from "@/lib/dashboard/filter-params";
import type {
  DashboardFilterParams,
  FormSubmissionsQueryParams,
} from "@/types/dashboard-api";

export function useFormSubmissionsQuery(query: FormSubmissionsQueryParams) {
  const paramsKey = buildFormSubmissionsSearchParams(query).toString();

  return useQuery({
    queryKey: queryKeys.formSubmissionsPage(paramsKey),
    queryFn: () => fetchFormSubmissionsPage(query),
    ...DASHBOARD_QUERY_CACHE,
  });
}

export function useDashboardOverviewQuery(filters: DashboardFilterParams) {
  const paramsKey = buildOverviewSearchParams(filters).toString();

  return useQuery({
    queryKey: queryKeys.dashboardOverviewCounts(paramsKey),
    queryFn: () => fetchDashboardOverview(filters),
    ...DASHBOARD_QUERY_CACHE,
  });
}
