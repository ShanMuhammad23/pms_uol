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

/** Slim rows for filters, stats cards, and charts — not the staff listing. */
export async function fetchDashboardOverview(): Promise<FormSubmissionListItem[]> {
  const response = await fetch("/api/submissions/overview", { cache: "no-store" });
  return parseResponse<FormSubmissionListItem[]>(response);
}

export async function fetchFormSubmission(
  id: number,
): Promise<FormSubmissionDetail> {
  const response = await fetch(`/api/submissions/${id}`);
  return parseResponse<FormSubmissionDetail>(response);
}

export type RemarksField = "remarksEvaluation" | "remarksCompensation";

export type ScoreAdjustmentField =
  | "creditHrsErpScoreAdj"
  | "pubOricScoreAdj"
  | "qecScoreAdj"
  | "calibrationFactor"
  | "calibratedScoreNumeric"
  | "initialScoreNumeric";

export async function updateSubmissionScoreAdjustments(
  id: number,
  field: ScoreAdjustmentField,
  value: number | null,
): Promise<{
  id: number;
  creditHrsErpScoreAdj: number | null;
  pubOricScoreAdj: number | null;
  qecScoreAdj: number | null;
  calibrationFactor: number | null;
  calibratedScoreNumeric: number | null;
  initialScoreNumeric: number | null;
}> {
  const response = await fetch(`/api/submissions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [field]: value }),
  });

  return parseResponse<{
    id: number;
    creditHrsErpScoreAdj: number | null;
    pubOricScoreAdj: number | null;
    qecScoreAdj: number | null;
    calibrationFactor: number | null;
    calibratedScoreNumeric: number | null;
    initialScoreNumeric: number | null;
  }>(response);
}

export async function approveManagerReview(
  id: number,
): Promise<{ managerLevel: number; status: FormSubmissionDetail["status"] }> {
  const response = await fetch(`/api/submissions/${id}/manager-review`, {
    method: "POST",
  });

  return parseResponse<{ managerLevel: number; status: FormSubmissionDetail["status"] }>(
    response,
  );
}

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

export async function approveHrCalibration(
  id: number,
): Promise<{ status: FormSubmissionDetail["status"] }> {
  const response = await fetch(`/api/submissions/${id}/hr-approval`, {
    method: "POST",
  });

  return parseResponse<{ status: FormSubmissionDetail["status"] }>(response);
}

export async function saveHrReview(
  id: number,
  answers: Array<{
    questionId: number;
    pointsEarned?: number;
    remarks?: string | null;
  }>,
): Promise<{ managerAnswers: FormSubmissionDetail["managerAnswers"] }> {
  const response = await fetch(`/api/submissions/${id}/hr-approval`, {
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

export async function bulkUpdateEmployeeListingFields(
  employeeIds: string[],
  fields: {
    roleCategory?: string | null;
    designation?: string | null;
    entityId?: number | null;
    templateId?: number | null;
    qualification?: string | null;
    qualificationYear?: number | null;
    qualificationSubject?: string | null;
    qualificationInstitute?: string | null;
    qualificationCountry?: string | null;
    creditHrsErpScoreAdj?: number | null;
    pubOricScoreAdj?: number | null;
    qecScoreAdj?: number | null;
    calibrationFactor?: number | null;
    manager1UserId?: number | null;
    manager2UserId?: number | null;
  },
): Promise<{
  updatedCount: number;
  employeeIds: string[];
  [key: string]: unknown;
}> {
  const response = await fetch("/api/submissions/bulk-edit", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeIds, ...fields }),
  });

  return parseResponse<{
    updatedCount: number;
    employeeIds: string[];
    [key: string]: unknown;
  }>(response);
}

export type EmployeeAssignedForm = {
  templateId: number;
  title: string;
};

export async function fetchEmployeeAssignedForms(
  employeeId: string,
): Promise<{ employeeId: string; forms: EmployeeAssignedForm[] }> {
  const params = new URLSearchParams({ employeeId });
  const response = await fetch(
    `/api/submissions/assigned-forms?${params.toString()}`,
    { cache: "no-store" },
  );
  return parseResponse<{ employeeId: string; forms: EmployeeAssignedForm[] }>(
    response,
  );
}
