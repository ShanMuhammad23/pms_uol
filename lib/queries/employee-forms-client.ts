import type {
  AssignedFormListItem,
  EmployeeFormDetail,
  SaveEmployeeFormInput,
} from "@/types/employee-forms";

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
