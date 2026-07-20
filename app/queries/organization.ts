"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/app/queries/keys";
import {
  fetchDashboardEntities,
  fetchEntities,
} from "@/lib/queries/entities-client";
import { fetchUniqueDesignations } from "@/lib/queries/designations-client";
import { fetchStaffCategoriesWithSubCategories } from "@/lib/queries/staff-categories-client";
import type { EntityRecord } from "@/types/entities";

export function useEntitiesQuery() {
  return useQuery({
    queryKey: queryKeys.entities,
    queryFn: fetchEntities,
  });
}

export function useDashboardEntitiesQuery() {
  return useQuery({
    queryKey: [...queryKeys.entities, "dashboard"],
    queryFn: fetchDashboardEntities,
  });
}

export function useUniqueDesignationsQuery() {
  return useQuery({
    queryKey: queryKeys.designations,
    queryFn: fetchUniqueDesignations,
  });
}

export function useStaffCategoriesWithSubCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.staffCategoriesWithSubCategories,
    queryFn: fetchStaffCategoriesWithSubCategories,
  });
}

export function useSortedEntities(entities: EntityRecord[] | undefined) {
  return useMemo(
    () => [...(entities ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [entities],
  );
}
