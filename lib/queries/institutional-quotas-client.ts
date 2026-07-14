import type {
  InstitutionalQuotaChartRow,
  InstitutionalQuotaRecord,
  UpsertInstitutionalQuotasInput,
} from "@/types/institutional-quotas";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data as T;
}

export async function fetchInstitutionalQuotas(
  financialYearId: number,
): Promise<InstitutionalQuotaRecord[]> {
  const response = await fetch(
    `/api/admin/institutional-quotas?financialYearId=${financialYearId}`,
  );
  return parseResponse<InstitutionalQuotaRecord[]>(response);
}

/** DB-backed chart rows for Performance Rating Curve */
export async function fetchInstitutionalQuotaChartRows(
  financialYearId?: number | null,
): Promise<InstitutionalQuotaChartRow[]> {
  const url =
    financialYearId != null
      ? `/api/institutional-quotas?financialYearId=${financialYearId}`
      : "/api/institutional-quotas";

  const response = await fetch(url);
  return parseResponse<InstitutionalQuotaChartRow[]>(response);
}

export async function upsertInstitutionalQuotas(
  input: UpsertInstitutionalQuotasInput,
): Promise<InstitutionalQuotaRecord[]> {
  const response = await fetch("/api/admin/institutional-quotas", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<InstitutionalQuotaRecord[]>(response);
}
