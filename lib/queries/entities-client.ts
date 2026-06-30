import type {
  CreateEntityInput,
  EntityRecord,
  UpdateEntityInput,
} from "@/types/entities";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data as T;
}

export async function fetchEntities(): Promise<EntityRecord[]> {
  const response = await fetch("/api/admin/entities");
  return parseResponse<EntityRecord[]>(response);
}

export async function createEntity(
  input: CreateEntityInput,
): Promise<EntityRecord> {
  const response = await fetch("/api/admin/entities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<EntityRecord>(response);
}

export async function updateEntity(
  id: number,
  input: UpdateEntityInput,
): Promise<EntityRecord> {
  const response = await fetch(`/api/admin/entities/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<EntityRecord>(response);
}

export async function deleteEntity(id: number): Promise<void> {
  const response = await fetch(`/api/admin/entities/${id}`, {
    method: "DELETE",
  });

  await parseResponse<{ success: true }>(response);
}
