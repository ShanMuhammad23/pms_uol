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
    const message = data.detail
      ? `${data.error} (${data.detail})`
      : data.error ?? "Request failed.";
    throw new FormTemplateRequestError(
      message,
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

export async function fetchFormTemplatesForDashboard(): Promise<FormTemplateListItem[]> {
  const response = await fetch("/api/templates", {
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

export async function assignFormTemplateToEmployees(
  templateId: number,
  employeeIds: string[],
  selfAssessmentDisabledMap?: Record<string, boolean>,
): Promise<{ assignedCount: number; templateId: number }> {
  const response = await fetch(`/api/admin/forms/${templateId}/assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ employeeIds, selfAssessmentDisabledMap }),
  });

  return parseResponse<{ assignedCount: number; templateId: number }>(response);
}

export async function unassignFormTemplateFromEmployees(
  templateId: number,
  employeeIds: string[],
): Promise<{ unassignedCount: number; templateId: number }> {
  const response = await fetch(`/api/admin/forms/${templateId}/assignments`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ employeeIds }),
  });

  return parseResponse<{ unassignedCount: number; templateId: number }>(response);
}

export async function fetchFormTemplateAssignments(
  templateId: number,
): Promise<Array<{ employeeId: string; employeeName: string; email: string | null; selfAssessmentDisabled: boolean }>> {
  const response = await fetch(`/api/admin/forms/${templateId}/assignments`, {
    credentials: "include",
    cache: "no-store",
  });

  return parseResponse<Array<{ employeeId: string; employeeName: string; email: string | null; selfAssessmentDisabled: boolean }>>(response);
}

export async function updateAssignmentSelfAssessmentDisabled(
  templateId: number,
  employeeId: string,
  selfAssessmentDisabled: boolean,
): Promise<{ templateId: number; employeeId: string; selfAssessmentDisabled: boolean }> {
  const response = await fetch(`/api/admin/forms/${templateId}/assignments`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ employeeId, selfAssessmentDisabled }),
  });

  return parseResponse<{ templateId: number; employeeId: string; selfAssessmentDisabled: boolean }>(response);
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

// =========================================================================
// Direct Score Entry — client-side wrappers (standalone, no template)
// =========================================================================

export async function assignDirectScoreEntry(
  employeeIds: string[],
): Promise<{ assignedCount: number }> {
  const response = await fetch(`/api/admin/direct-score-entry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ employeeIds }),
  });

  return parseResponse<{ assignedCount: number }>(response);
}

export async function unassignDirectScoreEntry(
  employeeIds: string[],
): Promise<{ unassignedCount: number }> {
  const response = await fetch(`/api/admin/direct-score-entry`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ employeeIds }),
  });

  return parseResponse<{ unassignedCount: number }>(response);
}

export async function fetchDirectScoreEntryAssignments(): Promise<Array<{ employeeId: string; employeeName: string; email: string | null }>> {
  const response = await fetch(`/api/admin/direct-score-entry`, {
    credentials: "include",
    cache: "no-store",
  });

  return parseResponse<Array<{ employeeId: string; employeeName: string; email: string | null }>>(response);
}
