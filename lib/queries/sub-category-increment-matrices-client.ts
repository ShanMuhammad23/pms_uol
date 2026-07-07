import type {
  CreateSubCategoryIncrementMatrixInput,
  SubCategoryIncrementMatrixRecord,
  UpdateSubCategoryIncrementMatrixInput,
} from "@/types/sub-category-increment-matrices";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data as T;
}

export async function fetchSubCategoryIncrementMatrices(
  financialYearId: number,
): Promise<SubCategoryIncrementMatrixRecord[]> {
  const response = await fetch(
    `/api/admin/sub-category-increment-matrices?financialYearId=${financialYearId}`,
    { credentials: "include", cache: "no-store" },
  );

  return parseResponse<SubCategoryIncrementMatrixRecord[]>(response);
}

export async function createSubCategoryIncrementMatrix(
  input: CreateSubCategoryIncrementMatrixInput,
): Promise<SubCategoryIncrementMatrixRecord> {
  const response = await fetch("/api/admin/sub-category-increment-matrices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });

  return parseResponse<SubCategoryIncrementMatrixRecord>(response);
}

export async function updateSubCategoryIncrementMatrix(
  id: number,
  input: UpdateSubCategoryIncrementMatrixInput & { financialYearId: number },
): Promise<SubCategoryIncrementMatrixRecord> {
  const response = await fetch(`/api/admin/sub-category-increment-matrices/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });

  return parseResponse<SubCategoryIncrementMatrixRecord>(response);
}

export async function deleteSubCategoryIncrementMatrix(id: number): Promise<void> {
  const response = await fetch(`/api/admin/sub-category-increment-matrices/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  await parseResponse<{ success: boolean }>(response);
}
