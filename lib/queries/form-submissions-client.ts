import type {
  FormSubmissionDetail,
  FormSubmissionListItem,
} from "@/types/form-submissions";
import type {
  DashboardFilterParams,
  DashboardOverviewCounts,
  FormSubmissionsPageResponse,
  FormSubmissionsQueryParams,
} from "@/types/dashboard-api";
import {
  buildFormSubmissionsSearchParams,
  buildOverviewSearchParams,
} from "@/lib/dashboard/filter-params";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data as T;
}

export async function fetchFormSubmissionsPage(
  query: FormSubmissionsQueryParams,
): Promise<FormSubmissionsPageResponse> {
  const params = buildFormSubmissionsSearchParams(query);
  const response = await fetch(`/api/submissions?${params.toString()}`, {
    cache: "no-store",
  });
  return parseResponse<FormSubmissionsPageResponse>(response);
}

/** Legacy full-ish listing for non-dashboard pages (capped). Prefer fetchFormSubmissionsPage. */
export async function fetchFormSubmissions(): Promise<FormSubmissionListItem[]> {
  const response = await fetchFormSubmissionsPage({
    page: 1,
    pageSize: 5000,
    filters: {
      searchQuery: "",
      category0EntityIds: null,
      category1EntityIds: null,
      category2EntityIds: null,
      roleCategories: null,
      designations: null,
      formStates: null,
      cardFilter: null,
    },
    masterFilters: { text: {}, multi: {}, numeric: {} },
  });
  return response.items;
}

/** Aggregated counts for filters, workflow stats, and charts. */
export async function fetchDashboardOverview(
  filters: DashboardFilterParams,
): Promise<DashboardOverviewCounts> {
  const params = buildOverviewSearchParams(filters);
  const query = params.toString();
  const response = await fetch(
    `/api/submissions/overview${query ? `?${query}` : ""}`,
    { cache: "no-store" },
  );
  return parseResponse<DashboardOverviewCounts>(response);
}


export async function fetchFormSubmission(
  id: number,
): Promise<FormSubmissionDetail> {
  const response = await fetch(`/api/submissions/${id}`);
  return parseResponse<FormSubmissionDetail>(response);
}

export type RemarksField = "remarksEvaluation" | "remarksCompensation";

export type OverallRemarksField =
  | "manager1OverallRemarks"
  | "manager2OverallRemarks";

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
  overallRemarks?: string | null,
): Promise<{
  managerAnswers: FormSubmissionDetail["managerAnswers"];
  manager1OverallRemarks?: string | null;
  manager2OverallRemarks?: string | null;
}> {
  const response = await fetch(`/api/submissions/${id}/manager-review`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      answers,
      ...(overallRemarks !== undefined ? { overallRemarks } : {}),
    }),
  });

  return parseResponse<{
    managerAnswers: FormSubmissionDetail["managerAnswers"];
    manager1OverallRemarks?: string | null;
    manager2OverallRemarks?: string | null;
  }>(response);
}

export async function approveHrCalibration(
  id: number,
): Promise<{ status: FormSubmissionDetail["status"] }> {
  const response = await fetch(`/api/submissions/${id}/hr-approval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve" }),
  });

  return parseResponse<{ status: FormSubmissionDetail["status"] }>(response);
}

export async function setHrReviewRequired(
  id: number,
): Promise<{ hrApprovalStatus: string }> {
  const response = await fetch(`/api/submissions/${id}/hr-approval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "review_required" }),
  });

  return parseResponse<{ hrApprovalStatus: string }>(response);
}

/**
 * Permanently reset a submission back to the Self Assessment stage.
 * Removes all answers, manager reviews, score adjustments, calibration
 * data, and HR/Board approval data. Only HR / Board / Super Admin may
 * perform this action (enforced server-side).
 *
 * Returns deletion counts for verification/debugging.
 */
export async function resetFormSubmission(
  id: number,
): Promise<{
  status: FormSubmissionDetail["status"];
  deletedAttachments: number;
  deletedAnswers: number;
  resetAppraisal: boolean;
}> {
  const response = await fetch(`/api/submissions/${id}/reset-form`, {
    method: "POST",
  });

  return parseResponse<{
    status: FormSubmissionDetail["status"];
    deletedAttachments: number;
    deletedAnswers: number;
    resetAppraisal: boolean;
  }>(response);
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

/**
 * Updates overall remarks for a specific manager level via the submission
 * PATCH endpoint. Manager 1 and Manager 2 remarks are stored independently.
 */
export async function updateSubmissionOverallRemarks(
  id: number,
  field: OverallRemarksField,
  value: string | null,
): Promise<{
  id: number;
  manager1OverallRemarks: string | null;
  manager2OverallRemarks: string | null;
}> {
  const response = await fetch(`/api/submissions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [field]: value }),
  });

  return parseResponse<{
    id: number;
    manager1OverallRemarks: string | null;
    manager2OverallRemarks: string | null;
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
    assessmentEligibility?: boolean;
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

export async function updateAssessmentEligibility(
  employeeIds: string[],
  assessmentEligibility: boolean,
  ineligibilityReason?: string,
): Promise<{
  updatedCount: number;
  employeeIds: string[];
  assessmentEligibility: boolean;
  ineligibilityReason: string | null;
}> {
  const response = await fetch("/api/staff/eligibility", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeIds, assessmentEligibility, ineligibilityReason }),
  });

  return parseResponse<{
    updatedCount: number;
    employeeIds: string[];
    assessmentEligibility: boolean;
    ineligibilityReason: string | null;
  }>(response);
}
