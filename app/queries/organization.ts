"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DASHBOARD_QUERY_CACHE } from "@/app/queries/query-cache";
import { queryKeys } from "@/app/queries/keys";
import {
  fetchDashboardEntities,
  fetchEntities,
} from "@/lib/queries/entities-client";
import { fetchUniqueDesignations } from "@/lib/queries/designations-client";
import type { EntityRecord } from "@/types/entities";

export function useEntitiesQuery() {
  return useQuery({
    queryKey: queryKeys.entities,
    queryFn: fetchEntities,
    ...DASHBOARD_QUERY_CACHE,
  });
}

export function useDashboardEntitiesQuery() {
  return useQuery({
    queryKey: [...queryKeys.entities, "dashboard"],
    queryFn: fetchDashboardEntities,
    ...DASHBOARD_QUERY_CACHE,
  });
}

export function useUniqueDesignationsQuery() {
  return useQuery({
    queryKey: queryKeys.designations,
    queryFn: fetchUniqueDesignations,
    ...DASHBOARD_QUERY_CACHE,
  });
}

export function useSortedEntities(entities: EntityRecord[] | undefined) {
  return useMemo(
    () => [...(entities ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [entities],
  );
}
