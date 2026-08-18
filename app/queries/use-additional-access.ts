"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMyAdditionalAccess } from "@/lib/queries/additional-access-client";
import {
  canEditModuleClient,
  canViewModuleClient,
} from "@/lib/auth/additional-access-client";
import type { AdditionalAccessModule } from "@/types/additional-access";

/**
 * Hook to load and check the current user's additional-access permissions.
 *
 * @param userId - The current user's ID (from session)
 * @param userRole - The current user's role (from session)
 */
export function useAdditionalAccess(
  userId: number | undefined,
  userRole: string | undefined,
) {
  const { data: permissions = [] } = useQuery({
    queryKey: ["additional-access", userId],
    queryFn: () => fetchMyAdditionalAccess(),
    enabled: !!userId,
  });

  return {
    permissions,
    canView: (module: AdditionalAccessModule) =>
      canViewModuleClient(module, userRole, permissions),
    canEdit: (module: AdditionalAccessModule) =>
      canEditModuleClient(module, userRole, permissions),
  };
}
