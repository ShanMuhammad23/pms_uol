import type {
  CreateFinancialYearInput,
  FinancialYearRecord,
  UpdateFinancialYearInput,
} from "@/types/financial-years";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data as T;
}

export async function fetchFinancialYears(): Promise<FinancialYearRecord[]> {
  const response = await fetch("/api/admin/financial-years");
  return parseResponse<FinancialYearRecord[]>(response);
}

export async function createFinancialYear(
  input: CreateFinancialYearInput,
): Promise<FinancialYearRecord> {
  const response = await fetch("/api/admin/financial-years", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<FinancialYearRecord>(response);
}

export async function updateFinancialYear(
  id: number,
  input: UpdateFinancialYearInput,
): Promise<FinancialYearRecord> {
  const response = await fetch(`/api/admin/financial-years/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<FinancialYearRecord>(response);
}

export async function deleteFinancialYear(id: number): Promise<void> {
  const response = await fetch(`/api/admin/financial-years/${id}`, {
    method: "DELETE",
  });

  await parseResponse<{ success: true }>(response);
}
