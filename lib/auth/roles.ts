import "server-only";

import type { UserRole } from "@/types/users";
import { USER_ROLES } from "@/types/users";

/**
 * Canonical RBAC roles for PMS.
 * Note: product language "Head" / "HEAD" maps to DB/enum `MANAGER`.
 */
export const SYSTEM_ROLES = USER_ROLES;

export type SystemRole = UserRole;

/** Alias used in some docs / UI copy — never store "HEAD" in JWT or DB. */
export const HEAD_ROLE_ALIAS = "MANAGER" as const satisfies SystemRole;

export const ROLE_PERMISSION_SETS = {
  /** True SUPER_ADMIN only (user admin, destructive config). */
  superAdminOnly: ["SUPER_ADMIN"] as const satisfies readonly SystemRole[],
  /** Org-wide calibration / matrices / entity admin (legacy requireSuperAdmin*). */
  orgAdmins: ["SUPER_ADMIN", "HR", "BOARD"] as const satisfies readonly SystemRole[],
  /** Dashboard listings + charts. */
  dashboard: ["SUPER_ADMIN", "HR", "BOARD", "MANAGER"] as const satisfies readonly SystemRole[],
  /** Any authenticated active user. */
  authenticated: SYSTEM_ROLES,
} as const;

export function isSystemRole(value: unknown): value is SystemRole {
  return typeof value === "string" && SYSTEM_ROLES.includes(value as SystemRole);
}

export function roleSatisfies(
  actual: string | null | undefined,
  allowed: readonly SystemRole[],
): boolean {
  return isSystemRole(actual) && allowed.includes(actual);
}
