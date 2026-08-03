import type {
  AdditionalAccessLevel,
  AdditionalAccessModule,
  AdditionalAccessPermission,
} from "@/types/additional-access";
import { isAdminRole } from "@/lib/auth/submission-review-roles";

/**
 * Client-side effective permission check.
 * Uses the user's role + the additional-access permissions loaded from the API.
 *
 * Admin roles (SUPER_ADMIN, HR, BOARD) always get EDIT access.
 * For other roles, additional-access permissions are checked.
 *
 * Returns: "EDIT" | "VIEW_ONLY" | null (no access)
 */
export function getEffectiveAccess(
  module: AdditionalAccessModule,
  userRole: string | undefined,
  additionalAccess: AdditionalAccessPermission[],
): AdditionalAccessLevel | null {
  if (isAdminRole(userRole)) {
    return "EDIT";
  }

  const match = additionalAccess.find((p) => p.module === module);
  return match?.accessLevel ?? null;
}

export function canViewModuleClient(
  module: AdditionalAccessModule,
  userRole: string | undefined,
  additionalAccess: AdditionalAccessPermission[],
): boolean {
  return getEffectiveAccess(module, userRole, additionalAccess) !== null;
}

export function canEditModuleClient(
  module: AdditionalAccessModule,
  userRole: string | undefined,
  additionalAccess: AdditionalAccessPermission[],
): boolean {
  return getEffectiveAccess(module, userRole, additionalAccess) === "EDIT";
}
