import type { AppraisalStatus } from "@/types/forms";
import type { EmployeeFormAnswerAttachment } from "@/types/employee-forms";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface BulkReviewQueueItem {
  id: number;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  designation: string | null;
  entityId: number | null;
  entityName: string | null;
  parentEntityName: string | null;
  orgLevel1Name: string | null;
  orgLevel2Name: string | null;
  templateId: number | null;
  templateTitle: string | null;
  status: AppraisalStatus;
  managerLevel: number | null;
  manager1UserId: number | null;
  manager2UserId: number | null;
  submittedAt: string | null;
  selfAssessmentEnabled: boolean;
  assessmentEligibility: boolean;
}

export interface BulkReviewQuestionRow {
  submissionId: number;
  employeeId: string;
  employeeName: string;
  selfScore: number | null;
  selfRemarks: string | null;
  managerScore: number | null;
  managerRemarks: string | null;
  manager1Score: number | null;
  manager1Remarks: string | null;
  /** Attachments uploaded by the employee for this question. */
  attachments: EmployeeFormAnswerAttachment[];
}

export interface BulkReviewQuestionData {
  questionId: number;
  questionText: string;
  totalMarks: number;
  isRequired: boolean;
  sectionTitle: string | null;
  rows: BulkReviewQuestionRow[];
}

export interface BulkReviewQuestionDataResponse {
  questions: BulkReviewQuestionData[];
  submissions: Array<{
    id: number;
    employeeId: string;
    employeeName: string;
    managerLevel: number | null;
    status: AppraisalStatus;
  }>;
}

export interface SaveBulkReviewEntry {
  submissionId: number;
  pointsEarned: number;
  remarks?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Client functions                                                            */
/* -------------------------------------------------------------------------- */

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }
  return data as T;
}

export async function fetchBulkReviewQueue(): Promise<{
  items: BulkReviewQueueItem[];
}> {
  const response = await fetch("/api/submissions/bulk-review/queue", {
    cache: "no-store",
  });
  return parseResponse<{ items: BulkReviewQueueItem[] }>(response);
}

export async function fetchBulkReviewQuestionData(
  submissionIds: number[],
): Promise<BulkReviewQuestionDataResponse> {
  const ids = submissionIds.join(",");
  const response = await fetch(
    `/api/submissions/bulk-review/questions?ids=${ids}`,
    { cache: "no-store" },
  );
  return parseResponse<BulkReviewQuestionDataResponse>(response);
}

export async function saveBulkReviewQuestionScores(
  questionId: number,
  entries: SaveBulkReviewEntry[],
): Promise<{ savedCount: number }> {
  const response = await fetch("/api/submissions/bulk-review/save", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId, entries }),
  });
  return parseResponse<{ savedCount: number }>(response);
}

export async function finishBulkReview(
  submissionIds: number[],
): Promise<{
  approved: Array<{
    id: number;
    managerLevel: number;
    status: AppraisalStatus;
  }>;
  skipped: Array<{ id: number; reason: string }>;
}> {
  const response = await fetch("/api/submissions/bulk-review/finish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionIds }),
  });
  return parseResponse<{
    approved: Array<{
      id: number;
      managerLevel: number;
      status: AppraisalStatus;
    }>;
    skipped: Array<{ id: number; reason: string }>;
  }>(response);
}
