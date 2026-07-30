import type {
  CreatePerformanceLevelInput,
  CreatePerformanceQuartileInput,
  PerformanceLevelRecord,
  PerformanceLevelWithQuartiles,
  PerformanceQuartileRecord,
  UpdatePerformanceLevelInput,
  UpdatePerformanceQuartileInput,
} from "@/types/performance-matrices";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data as T;
}

export async function fetchPerformanceMatrix(
  financialYearId: number,
  matrixLabel?: string,
): Promise<PerformanceLevelWithQuartiles[]> {
  const params = new URLSearchParams({
    financialYearId: String(financialYearId),
  });
  if (matrixLabel?.trim()) {
    params.set("matrixLabel", matrixLabel.trim());
  }
  const response = await fetch(
    `/api/admin/performance-levels?${params.toString()}`,
  );
  return parseResponse<PerformanceLevelWithQuartiles[]>(response);
}

export async function fetchDashboardPerformanceMatrix(
  financialYearId: number,
  matrixLabel?: string,
): Promise<PerformanceLevelWithQuartiles[]> {
  const params = new URLSearchParams({
    financialYearId: String(financialYearId),
  });
  if (matrixLabel?.trim()) {
    params.set("matrixLabel", matrixLabel.trim());
  }
  const response = await fetch(
    `/api/performance-levels?${params.toString()}`,
  );
  return parseResponse<PerformanceLevelWithQuartiles[]>(response);
}

export async function fetchPerformanceMatrixLabels(
  financialYearId: number,
): Promise<string[]> {
  const response = await fetch(
    `/api/admin/performance-levels?financialYearId=${financialYearId}&labelsOnly=1`,
  );
  return parseResponse<string[]>(response);
}

export async function assignPerformanceMatrixToEmployees(
  input: {
    financialYearId: number;
    matrixLabel: string;
    employeeIds: string[];
  },
): Promise<{ updatedCount: number; financialYearId: number; matrixLabel: string }> {
  const response = await fetch("/api/admin/performance-levels", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseResponse<{ updatedCount: number; financialYearId: number; matrixLabel: string }>(
    response,
  );
}

export async function createPerformanceLevel(
  input: CreatePerformanceLevelInput,
): Promise<PerformanceLevelRecord> {
  const response = await fetch("/api/admin/performance-levels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<PerformanceLevelRecord>(response);
}

export async function updatePerformanceLevel(
  id: number,
  input: UpdatePerformanceLevelInput,
): Promise<PerformanceLevelRecord> {
  const response = await fetch(`/api/admin/performance-levels/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<PerformanceLevelRecord>(response);
}

export async function deletePerformanceLevel(id: number): Promise<void> {
  const response = await fetch(`/api/admin/performance-levels/${id}`, {
    method: "DELETE",
  });

  await parseResponse<{ success: true }>(response);
}

export async function fetchPerformanceQuartiles(
  performanceLevelId: number,
): Promise<PerformanceQuartileRecord[]> {
  const response = await fetch(
    `/api/admin/performance-quartiles?performanceLevelId=${performanceLevelId}`,
  );
  return parseResponse<PerformanceQuartileRecord[]>(response);
}

export async function createPerformanceQuartile(
  input: CreatePerformanceQuartileInput,
): Promise<PerformanceQuartileRecord> {
  const response = await fetch("/api/admin/performance-quartiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<PerformanceQuartileRecord>(response);
}

export async function updatePerformanceQuartile(
  id: number,
  input: UpdatePerformanceQuartileInput,
): Promise<PerformanceQuartileRecord> {
  const response = await fetch(`/api/admin/performance-quartiles/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<PerformanceQuartileRecord>(response);
}

export async function deletePerformanceQuartile(id: number): Promise<void> {
  const response = await fetch(`/api/admin/performance-quartiles/${id}`, {
    method: "DELETE",
  });

  await parseResponse<{ success: true }>(response);
}
