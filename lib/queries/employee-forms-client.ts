import type {
  AssignedFormListItem,
  EmployeeFormAnswerAttachment,
  EmployeeFormDetail,
  SaveEmployeeFormInput,
} from "@/types/employee-forms";

// Mirror of MAX_FORM_ATTACHMENT_BYTES in lib/uploads/form-attachments.ts
// (which is `server-only` and cannot be imported into client bundles).
// Keep these two values in sync.
export const MAX_FORM_ATTACHMENT_BYTES = 2 * 1024 * 1024;

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data as T;
}

export async function fetchAssignedForms(): Promise<AssignedFormListItem[]> {
  const response = await fetch("/api/my-forms");
  return parseResponse<AssignedFormListItem[]>(response);
}

export async function fetchEmployeeForm(
  templateId: number,
): Promise<EmployeeFormDetail> {
  const response = await fetch(`/api/my-forms/${templateId}`);
  return parseResponse<EmployeeFormDetail>(response);
}

export async function saveEmployeeForm(
  templateId: number,
  input: SaveEmployeeFormInput,
): Promise<EmployeeFormDetail> {
  const response = await fetch(`/api/my-forms/${templateId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<EmployeeFormDetail>(response);
}

export async function uploadEmployeeFormAttachment(
  templateId: number,
  questionId: number,
  file: File,
): Promise<EmployeeFormAnswerAttachment> {
  const formData = new FormData();
  formData.set("questionId", String(questionId));
  formData.set("file", file);

  const response = await fetch(`/api/my-forms/${templateId}/attachments`, {
    method: "POST",
    body: formData,
  });

  return parseResponse<EmployeeFormAnswerAttachment>(response);
}

export async function deleteEmployeeFormAttachment(
  templateId: number,
  attachmentId: number,
): Promise<void> {
  const response = await fetch(
    `/api/my-forms/${templateId}/attachments/${attachmentId}`,
    { method: "DELETE" },
  );

  await parseResponse<{ success: true }>(response);
}

export function getEmployeeFormAttachmentDownloadUrl(
  templateId: number,
  attachmentId: number,
): string {
  return `/api/my-forms/${templateId}/attachments/${attachmentId}`;
}
