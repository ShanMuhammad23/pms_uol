import type {
  CreateStaffCategoryInput,
  CreateStaffSubCategoryInput,
  StaffCategoryRecord,
  StaffCategoryWithSubCategories,
  StaffSubCategoryRecord,
  UpdateStaffCategoryInput,
  UpdateStaffSubCategoryInput,
} from "@/types/staff-categories";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data as T;
}

export async function fetchStaffCategories(): Promise<StaffCategoryRecord[]> {
  const response = await fetch("/api/admin/staff-categories");
  return parseResponse<StaffCategoryRecord[]>(response);
}

export async function fetchStaffSubCategories(): Promise<StaffSubCategoryRecord[]> {
  const response = await fetch("/api/admin/staff-sub-categories");
  return parseResponse<StaffSubCategoryRecord[]>(response);
}

export async function fetchStaffCategoriesWithSubCategories(): Promise<StaffCategoryWithSubCategories[]> {
  const [categories, subCategories] = await Promise.all([
    fetchStaffCategories(),
    fetchStaffSubCategories(),
  ]);

  return categories.map((category) => ({
    ...category,
    subCategories: subCategories
      .filter((sub) => sub.staffCategoryId === category.id)
      .map((sub) => ({ id: sub.id, name: sub.name })),
  }));
}

export async function createStaffCategory(
  input: CreateStaffCategoryInput,
): Promise<StaffCategoryRecord> {
  const response = await fetch("/api/admin/staff-categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<StaffCategoryRecord>(response);
}

export async function updateStaffCategory(
  id: number,
  input: UpdateStaffCategoryInput,
): Promise<StaffCategoryRecord> {
  const response = await fetch(`/api/admin/staff-categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<StaffCategoryRecord>(response);
}

export async function deleteStaffCategory(id: number): Promise<void> {
  const response = await fetch(`/api/admin/staff-categories/${id}`, {
    method: "DELETE",
  });

  await parseResponse<{ success: true }>(response);
}

export async function createStaffSubCategory(
  input: CreateStaffSubCategoryInput,
): Promise<StaffSubCategoryRecord> {
  const response = await fetch("/api/admin/staff-sub-categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<StaffSubCategoryRecord>(response);
}

export async function updateStaffSubCategory(
  id: number,
  input: UpdateStaffSubCategoryInput,
): Promise<StaffSubCategoryRecord> {
  const response = await fetch(`/api/admin/staff-sub-categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<StaffSubCategoryRecord>(response);
}

export async function deleteStaffSubCategory(id: number): Promise<void> {
  const response = await fetch(`/api/admin/staff-sub-categories/${id}`, {
    method: "DELETE",
  });

  await parseResponse<{ success: true }>(response);
}
