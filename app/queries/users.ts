"use client";

import { useQuery } from "@tanstack/react-query";
import { DASHBOARD_QUERY_CACHE } from "@/app/queries/query-cache";
import { queryKeys } from "@/app/queries/keys";
import {
  fetchUsers,
  fetchUsersByEmployeeIds,
  fetchUsersOverview,
} from "@/lib/queries/users-client";

export function useUsersQuery() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: fetchUsers,
    ...DASHBOARD_QUERY_CACHE,
  });
}

export function useUsersOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.usersOverview,
    queryFn: fetchUsersOverview,
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
