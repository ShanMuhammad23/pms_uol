import type { QuestionRecord, FormSectionRecord, FormRatingScaleRecord } from "@/types/forms";
import type { EmployeeFormAnswerRecord } from "@/types/employee-forms";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }
  return data as T;
}

export interface DirectAssessmentEmployee {
  submissionId: number;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  managerLevel: number | null;
  status: string;
  manager1UserId: number | null;
  manager2UserId: number | null;
  canEdit: boolean;
  designation: string | null;
  roleCategory: string | null;
  entityId: number | null;
  entityName: string | null;
  parentEntityName: string | null;
}

export interface DirectAssessmentOverallRemarks {
  manager1: string | null;
  manager2: string | null;
}

export interface DirectAssessmentData {
  templateId: number;
  templateTitle: string;
  templateDescription: string | null;
  selfAssessmentEnabled: boolean;
  /** Whether the form template has additional_remarks_enabled = TRUE. */
  additionalRemarksEnabled: boolean;
  ratingBased: boolean;
  ratingScales: FormRatingScaleRecord[];
  questions: QuestionRecord[];
  sections: FormSectionRecord[];
  rootQuestions: QuestionRecord[];
  employees: DirectAssessmentEmployee[];
  managerAnswersBySubmission: Record<
    number,
    EmployeeFormAnswerRecord[]
  >;
  manager1AnswersBySubmission: Record<
    number,
    EmployeeFormAnswerRecord[]
  >;
  /**
   * Map of submissionId → authored answers (open-assessment sections) for
   * the current reviewer. Keyed by submissionId.
   */
  managerAuthoredAnswersBySubmission: Record<
    number,
    EmployeeFormAnswerRecord[]
  >;
  /**
   * Map of submissionId → overall remarks (manager1 / manager2). Shares the
   * same data model as the standard assessment workflow.
   */
  overallRemarksBySubmission: Record<number, DirectAssessmentOverallRemarks>;
}

export type DirectAssessmentScope = "all" | "managed";

export async function fetchDirectAssessmentData(
  templateId: number,
  scope: DirectAssessmentScope = "all",
): Promise<DirectAssessmentData> {
  const params = new URLSearchParams();
  if (scope === "managed") {
    params.set("scope", "managed");
  }
  const query = params.toString();
  const response = await fetch(
    `/api/templates/${templateId}/direct-assessment${query ? `?${query}` : ""}`,
    { cache: "no-store" },
  );
  return parseResponse<DirectAssessmentData>(response);
}

export async function saveDirectAssessmentScores(
  submissionId: number,
  answers: Array<{
    questionId: number;
    pointsEarned?: number;
    ratingValue?: number | null;
    remarks?: string | null;
    /** Authored question text (for open-assessment answers; questionId = 0). */
    authoredQuestionText?: string | null;
    /** Authored question max marks (for open-assessment answers). */
    authoredTotalMarks?: number;
    /** Open-assessment section ID (for open-assessment answers). */
    openSectionId?: number | null;
  }>,
  overallRemarks?: string | null,
): Promise<{
  managerAnswers: EmployeeFormAnswerRecord[];
  manager1OverallRemarks?: string | null;
  manager2OverallRemarks?: string | null;
}> {
  const response = await fetch(
    `/api/submissions/${submissionId}/manager-review`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers,
        ...(overallRemarks !== undefined ? { overallRemarks } : {}),
      }),
    },
  );
  return parseResponse<{
    managerAnswers: EmployeeFormAnswerRecord[];
    manager1OverallRemarks?: string | null;
    manager2OverallRemarks?: string | null;
  }>(response);
}

export async function approveDirectAssessment(
  submissionId: number,
): Promise<{ managerLevel: number; status: string }> {
  const response = await fetch(
    `/api/submissions/${submissionId}/manager-review`,
    { method: "POST" },
  );
  return parseResponse<{ managerLevel: number; status: string }>(response);
}
