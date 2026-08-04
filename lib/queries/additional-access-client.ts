import type { AdditionalAccessPermission } from "@/types/additional-access";

export async function fetchUserAdditionalAccess(
  _userId?: number,
): Promise<AdditionalAccessPermission[]> {
  const response = await fetch(`/api/me/additional-access`);
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
