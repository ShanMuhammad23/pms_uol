import type { UserRecord, UserRole } from "@/types/users";

/**
 * System roles that are eligible to be assigned as Manager 1 or Manager 2.
 *
 * A user can be assigned as a manager if their System Role is one of:
 * Manager, HR, Board, or Super Admin. Employees are never eligible.
 *
 * This is the single source of truth for manager-assignment eligibility —
 * both the frontend dropdown filters and the backend validation use this
 * same set of roles.
 */
export const MANAGER_ELIGIBLE_ROLES: readonly UserRole[] = [
  "MANAGER",
  "HR",
  "BOARD",
  "SUPER_ADMIN",
];

/**
 * Returns `true` if the given system role is eligible for Manager 1 / Manager 2
 * assignment.
 */
export function isManagerEligibleRole(role: string | undefined): boolean {
  return MANAGER_ELIGIBLE_ROLES.includes(role as UserRole);
}

/**
 * Returns only users whose System Role makes them eligible for Manager 1 /
 * Manager 2 assignment (Manager, HR, Board, Super Admin).
 *
 * Use this as the single shared filter for every Manager 1 / Manager 2
 * selection control so dropdown behaviour stays consistent.
 *
 * @param users      Full user list (e.g. from `fetchUsersOverview`).
 * @param currentId  Optional id of the currently-assigned manager. When
 *                   provided, that user is kept in the result even if they
 *                   are no longer eligible, so the existing assignment
 *                   remains visible in the dropdown (preserves existing
 *                   assignments).
 */
export function filterManagerEligibleUsers(
  users: UserRecord[],
  currentId?: string | null,
): UserRecord[] {
  if (!currentId) {
    return users.filter((u) => isManagerEligibleRole(u.systemRole));
  }

  return users.filter(
    (u) => isManagerEligibleRole(u.systemRole) || String(u.id) === currentId,
  );
}
