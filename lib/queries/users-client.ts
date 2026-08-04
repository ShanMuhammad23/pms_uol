import type {
  CreateUserInput,
  EntityOptionRecord,
  UpdateUserInput,
  UserRecord,
} from "@/types/users";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data as T;
}

export async function fetchUsers(): Promise<UserRecord[]> {
  const response = await fetch("/api/admin/users", { cache: "no-store" });
  return parseResponse<UserRecord[]>(response);
}

/** Slim rows for users filter bar / facets (no qualifications). */
export async function fetchUsersOverview(): Promise<UserRecord[]> {
  const response = await fetch("/api/admin/users/overview", {
    cache: "no-store",
  });
  return parseResponse<UserRecord[]>(response);
}

/** Full rows for the current table page. */
export async function fetchUsersByEmployeeIds(
  employeeIds: string[],
): Promise<UserRecord[]> {
  if (employeeIds.length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    employeeIds: employeeIds.join(","),
  });
  const response = await fetch(`/api/admin/users?${params.toString()}`, {
    cache: "no-store",
  });
  return parseResponse<UserRecord[]>(response);
}


export async function fetchEntities(): Promise<EntityOptionRecord[]> {
  const response = await fetch("/api/admin/entities");
  return parseResponse<EntityOptionRecord[]>(response);
}

export async function createUser(input: CreateUserInput): Promise<UserRecord> {
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<UserRecord>(response);
}

export async function updateUser(
  id: number,
  input: UpdateUserInput,
): Promise<UserRecord> {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<UserRecord>(response);
}

export async function deleteUser(id: number): Promise<void> {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: "DELETE",
  });

  await parseResponse<{ success: true }>(response);
}
