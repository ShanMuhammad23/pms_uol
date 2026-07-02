import type {
  CreateUserInput,
  EntityOptionRecord,
  UpdateUserInput,
  UserRecord,
} from "@/types/users";
import type { StaffCategoryWithSubCategories } from "@/types/staff-categories";

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

export async function fetchEntities(): Promise<EntityOptionRecord[]> {
  const response = await fetch("/api/admin/entities");
  return parseResponse<EntityOptionRecord[]>(response);
}

export async function fetchStaffCategoriesForUsers(): Promise<StaffCategoryWithSubCategories[]> {
  const [categoriesResponse, subCategoriesResponse] = await Promise.all([
    fetch("/api/admin/staff-categories"),
    fetch("/api/admin/staff-sub-categories"),
  ]);

  const categories = await parseResponse<
    Array<{ id: number; name: string; createdAt: string; updatedAt: string }>
  >(categoriesResponse);
  const subCategories = await parseResponse<
    Array<{ id: number; name: string; staffCategoryId: number }>
  >(subCategoriesResponse);

  return categories.map((category) => ({
    ...category,
    subCategories: subCategories
      .filter((subCategory) => subCategory.staffCategoryId === category.id)
      .map((subCategory) => ({
        id: subCategory.id,
        name: subCategory.name,
      })),
  }));
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
