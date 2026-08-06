import type { AdditionalAccessPermission } from "@/types/additional-access";

/**
 * Fetch the CURRENT logged-in user's own additional-access permissions.
 * Uses the self-service endpoint `/api/me/additional-access` which works
 * for all authenticated users (not just admins).
 *
 * Use this for permission checks on the current user's session
 * (e.g., `useAdditionalAccess` hook, dashboard gating).
 */
export async function fetchMyAdditionalAccess(): Promise<AdditionalAccessPermission[]> {
  const response = await fetch(`/api/me/additional-access`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  return (data?.permissions as AdditionalAccessPermission[]) ?? [];
}

/**
 * Fetch a SPECIFIC user's additional-access permissions by their user ID.
 * Uses the admin endpoint `/api/admin/users/[id]/additional-access` which
 * requires Super Admin authorization.
 *
 * Use this when editing another user's permissions (e.g., EditUserModal).
 * The `userId` parameter is the user being edited, NOT the current viewer.
 */
export async function fetchUserAdditionalAccess(
  userId: number,
): Promise<AdditionalAccessPermission[]> {
  if (!userId || !Number.isFinite(userId)) {
    return [];
  }
  const response = await fetch(
    `/api/admin/users/${userId}/additional-access`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  return (data?.permissions as AdditionalAccessPermission[]) ?? [];
}

export async function saveUserAdditionalAccess(
  userId: number,
  permissions: AdditionalAccessPermission[],
): Promise<AdditionalAccessPermission[]> {
  const response = await fetch(
    `/api/admin/users/${userId}/additional-access`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions }),
    },
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error ?? "Failed to save additional access.");
  }

  const data = await response.json();
  return (data?.permissions as AdditionalAccessPermission[]) ?? [];
}
