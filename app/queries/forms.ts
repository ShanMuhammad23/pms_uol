"use client";

import { useQuery } from "@tanstack/react-query";
import { DASHBOARD_QUERY_CACHE } from "@/app/queries/query-cache";
import { queryKeys } from "@/app/queries/keys";
import {
  fetchDashboardOverview,
  fetchFormSubmissions,
} from "@/lib/queries/form-submissions-client";

export function useFormSubmissionsQuery() {
  return useQuery({
    queryKey: queryKeys.formSubmissions,
    queryFn: fetchFormSubmissions,
    ...DASHBOARD_QUERY_CACHE,
  });
}

export function useDashboardOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.dashboardOverview,
    queryFn: fetchDashboardOverview,
    ...DASHBOARD_QUERY_CACHE,
  });
}
