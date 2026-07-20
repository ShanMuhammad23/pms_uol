import type {
  FormSubmissionDetail,
  FormSubmissionListItem,
} from "@/types/form-submissions";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data as T;
}

export async function fetchFormSubmissions(): Promise<FormSubmissionListItem[]> {
  const response = await fetch("/api/submissions", { cache: "no-store" });
  return parseResponse<FormSubmissionListItem[]>(response);
}

export async function fetchFormSubmission(
  id: number,
): Promise<FormSubmissionDetail> {
  const response = await fetch(`/api/submissions/${id}`);
  return parseResponse<FormSubmissionDetail>(response);
}

export type RemarksField = "remarksEvaluation" | "remarksCompensation";

export async function saveManagerReview(
  id: number,
  answers: Array<{
    questionId: number;
    pointsEarned?: number;
    remarks?: string | null;
  }>,
): Promise<{ managerAnswers: FormSubmissionDetail["managerAnswers"] }> {
  const response = await fetch(`/api/submissions/${id}/manager-review`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });

  return parseResponse<{ managerAnswers: FormSubmissionDetail["managerAnswers"] }>(
    response,
  );
}

export async function updateSubmissionRemarks(
  id: number,
  field: RemarksField,
  value: string | null,
): Promise<{
  id: number;
  remarksEvaluation?: string | null;
  remarksCompensation?: string | null;
}> {
  const response = await fetch(`/api/submissions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [field]: value }),
  });

  return parseResponse<{
    id: number;
    remarksEvaluation?: string | null;
    remarksCompensation?: string | null;
  }>(response);
}

export async function updateEmployeeRoleCategory(
  employeeId: string,
  roleCategory: string | null,
): Promise<{ employeeId: string; roleCategory: string | null }> {
  const response = await fetch("/api/submissions/role-category", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, roleCategory }),
  });

  return parseResponse<{ employeeId: string; roleCategory: string | null }>(
    response,
  );
}

export async function updateEmployeeGradeGroup(
  employeeId: string,
  gradeGroup: string | null,
): Promise<{ employeeId: string; gradeGroup: string | null }> {
  const response = await fetch("/api/submissions/grade-group", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, gradeGroup }),
  });

  return parseResponse<{ employeeId: string; gradeGroup: string | null }>(
    response,
  );
}

export async function bulkUpdateEmployeeListingFields(
  employeeIds: string[],
  fields: {
    roleCategory?: string | null;
    gradeGroup?: string | null;
  },
): Promise<{
  updatedCount: number;
  employeeIds: string[];
  roleCategory?: string | null;
  gradeGroup?: string | null;
}> {
  const response = await fetch("/api/submissions/bulk-edit", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeIds, ...fields }),
  });

  return parseResponse<{
    updatedCount: number;
    employeeIds: string[];
    roleCategory?: string | null;
    gradeGroup?: string | null;
  }>(response);
}
