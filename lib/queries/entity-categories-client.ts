import type {
  CreateEntityCategoryInput,
  EntityCategoryRecord,
  UpdateEntityCategoryInput,
} from "@/types/entity-categories";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data as T;
}

export async function fetchEntityCategories(): Promise<EntityCategoryRecord[]> {
  const response = await fetch("/api/admin/entity-categories");
  return parseResponse<EntityCategoryRecord[]>(response);
}

export async function createEntityCategory(
  input: CreateEntityCategoryInput,
): Promise<EntityCategoryRecord> {
  const response = await fetch("/api/admin/entity-categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<EntityCategoryRecord>(response);
}

export async function updateEntityCategory(
  id: number,
  input: UpdateEntityCategoryInput,
): Promise<EntityCategoryRecord> {
  const response = await fetch(`/api/admin/entity-categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<EntityCategoryRecord>(response);
}

export async function deleteEntityCategory(id: number): Promise<void> {
  const response = await fetch(`/api/admin/entity-categories/${id}`, {
    method: "DELETE",
  });

  await parseResponse<{ success: true }>(response);
}
