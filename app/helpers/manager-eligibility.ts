import type { UserRecord } from "@/types/users";

/**
 * Returns only users designated as manager-eligible (Manager Role = Yes).
 * Use this as the single shared filter for every Manager 1 / Manager 2
 * selection control so dropdown behaviour stays consistent.
 *
 * @param users      Full user list (e.g. from `fetchUsersOverview`).
 * @param currentId  Optional id of the currently-assigned manager. When
 *                   provided, that user is kept in the result even if they
 *                   are not manager-eligible, so the existing assignment
 *                   remains visible in the dropdown (requirement 6).
 */
export function filterManagerEligibleUsers(
  users: UserRecord[],
  currentId?: string | null,
): UserRecord[] {
  if (!currentId) {
    return users.filter((u) => u.isManagerEligible);
  }

  return users.filter(
    (u) => u.isManagerEligible || String(u.id) === currentId,
  );
}
