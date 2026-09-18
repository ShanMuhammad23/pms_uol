"use client";

import { useQuery } from "@tanstack/react-query";
import { DASHBOARD_QUERY_CACHE } from "@/app/queries/query-cache";
import { queryKeys } from "@/app/queries/keys";
import {
  fetchUsers,
  fetchUsersByEmployeeIds,
  fetchUsersOverview,
} from "@/lib/queries/users-client";
import { fetchCampuses } from "@/lib/queries/campuses-client";

export function useUsersQuery() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: fetchUsers,
    ...DASHBOARD_QUERY_CACHE,
  });
}

export function useUsersOverviewQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.usersOverview,
    queryFn: fetchUsersOverview,
    enabled: options?.enabled ?? true,
    ...DASHBOARD_QUERY_CACHE,
  });
}

export function useUsersByEmployeeIdsQuery(employeeIds: string[]) {
  const stableIds = [...employeeIds];

  return useQuery({
    queryKey: queryKeys.usersByEmployeeIds(stableIds),
    queryFn: () => fetchUsersByEmployeeIds(stableIds),
    enabled: stableIds.length > 0,
    ...DASHBOARD_QUERY_CACHE,
  });
}

export function useCampusesQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.campuses,
    queryFn: fetchCampuses,
    enabled: options?.enabled ?? true,
    ...DASHBOARD_QUERY_CACHE,
  });
}
