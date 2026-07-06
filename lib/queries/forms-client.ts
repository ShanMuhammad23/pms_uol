import type {
  AppraisalCycleRecord,
  CreateAppraisalCycleInput,
  FormTemplateInput,
  FormTemplateListItem,
  FormTemplateRecord,
  IncrementMatrixInput,
} from "@/types/forms";

export class FormTemplateRequestError extends Error {
  constructor(
    message: string,
    public existingFormId?: number,
    public existingFormTitle?: string,
  ) {
    super(message);
    this.name = "FormTemplateRequestError";
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new FormTemplateRequestError(
      data.error ?? "Request failed.",
      data.existingFormId,
      data.existingFormTitle,
    );
  }

  return data as T;
}

export async function fetchFormTemplates(): Promise<FormTemplateListItem[]> {
  const response = await fetch("/api/admin/forms", {
    credentials: "include",
    cache: "no-store",
  });
  return parseResponse<FormTemplateListItem[]>(response);
}

export async function fetchFormTemplate(id: number): Promise<FormTemplateRecord> {
  const response = await fetch(`/api/admin/forms/${id}`, {
    credentials: "include",
    cache: "no-store",
  });
  return parseResponse<FormTemplateRecord>(response);
}

export async function createFormTemplate(
  input: FormTemplateInput,
): Promise<FormTemplateRecord> {
  const response = await fetch("/api/admin/forms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });

  return parseResponse<FormTemplateRecord>(response);
}

export async function updateFormTemplate(
  id: number,
  input: FormTemplateInput,
): Promise<FormTemplateRecord> {
  const response = await fetch(`/api/admin/forms/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });

  return parseResponse<FormTemplateRecord>(response);
}

export async function deleteFormTemplate(id: number): Promise<{ appraisalCount: number }> {
  const response = await fetch(`/api/admin/forms/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  return parseResponse<{ appraisalCount: number }>(response);
}

export async function fetchAppraisalCycles(): Promise<AppraisalCycleRecord[]> {
  const response = await fetch("/api/admin/appraisal-cycles");
  return parseResponse<AppraisalCycleRecord[]>(response);
}

export async function createAppraisalCycle(
  input: CreateAppraisalCycleInput,
): Promise<AppraisalCycleRecord> {
  const response = await fetch("/api/admin/appraisal-cycles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<AppraisalCycleRecord>(response);
}

export async function fetchIncrementMatrices(
  cycleId: number,
): Promise<IncrementMatrixInput[]> {
  const response = await fetch(
    `/api/admin/increment-matrices?cycleId=${cycleId}`,
  );

  return parseResponse<IncrementMatrixInput[]>(response);
}
