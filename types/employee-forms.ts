import type { AppraisalStatus, FormTemplateRecord } from "@/types/forms";
import type { ReturnHistoryEntry } from "@/types/form-submissions";

export type EmployeeFormStatus = "NOT_STARTED" | "DRAFT" | "SUBMITTED";

/** Display eligibility for my-forms. "Ineligible" = manually marked N/A. */
export type EmployeeAssessmentEligibilityStatus =
  | "Fully Eligible"
  | "Partially Eligible"
  | "Not Eligible"
  | "Ineligible";

export interface AssignedFormListItem {
  templateId: number;
  title: string;
  description: string | null;
  questionCount: number;
  /** Workflow status from appraisals.status (dashboard-aligned). */
  status: AppraisalStatus;
  selfAssessmentEnabled: boolean;
  submittedAt: string | null;
  updatedAt: string | null;
  eligibilityStatus: EmployeeAssessmentEligibilityStatus;
  /** False when Not Eligible or Ineligible — employee cannot fill even if assigned. */
  canFillAssessment: boolean;
  ineligibilityReason: string | null;
}

export interface EmployeeFormAnswerAttachment {
  id: number;
  questionId: number;
  originalFilename: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
}

export interface EmployeeFormAnswerRecord {
  questionId: number;
  textResponse: string | null;
  selectedOptionId: number | null;
  pointsEarned: number;
  remarks: string | null;
  attachments: EmployeeFormAnswerAttachment[];
}

export interface EmployeeFormDetail {
  template: FormTemplateRecord;
  appraisalId: number | null;
  status: EmployeeFormStatus;
  submittedAt: string | null;
  answers: EmployeeFormAnswerRecord[];
  rawScore: number;
  maxRawScore: number;
  selfAssessmentEnabled: boolean;
  assessmentEligibility: boolean;
  eligibilityStatus: EmployeeAssessmentEligibilityStatus;
  /** False when Not Eligible or Ineligible — employee cannot fill even if assigned. */
  canFillAssessment: boolean;
  ineligibilityReason: string | null;
  headName: string | null;
  manager2Name: string | null;
  /** Employee's full name — shown in print header. */
  employeeName: string | null;
  /** Employee's SAP/employee ID — shown in print header. */
  employeeId: string | null;
  /** History of returns to this submission (employee and manager 1 levels). */
  returnHistory?: ReturnHistoryEntry[];
}

export interface EmployeeFormAnswerInput {
  questionId: number;
  textResponse?: string | null;
  selectedOptionId?: number | null;
  pointsEarned?: number;
  remarks?: string | null;
}

export interface SaveEmployeeFormInput {
  answers: EmployeeFormAnswerInput[];
  submit?: boolean;
}

export interface ManagerReviewAnswerInput {
  questionId: number;
  pointsEarned?: number;
  remarks?: string | null;
}

export interface SaveManagerReviewInput {
  answers: ManagerReviewAnswerInput[];
  /** Optional overall remarks saved alongside question answers. */
  overallRemarks?: string | null;
}
