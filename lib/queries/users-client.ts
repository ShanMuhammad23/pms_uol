import type {
  CreateUserInput,
  DepartmentRecord,
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
  const response = await fetch("/api/admin/users");
  return parseResponse<UserRecord[]>(response);
}

export async function fetchDepartments(): Promise<DepartmentRecord[]> {
  const response = await fetch("/api/admin/departments");
  return parseResponse<DepartmentRecord[]>(response);
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
