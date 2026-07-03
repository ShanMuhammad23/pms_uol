import type { FormTemplateRecord } from "@/types/forms";

export type EmployeeFormStatus = "NOT_STARTED" | "DRAFT" | "SUBMITTED";

export interface AssignedFormListItem {
  templateId: number;
  title: string;
  description: string | null;
  staffCategoryName: string | null;
  staffSubCategoryName: string | null;
  questionCount: number;
  status: EmployeeFormStatus;
  submittedAt: string | null;
  updatedAt: string | null;
}

export interface EmployeeFormAnswerRecord {
  questionId: number;
  textResponse: string | null;
  selectedOptionId: number | null;
  pointsEarned: number;
}

export interface EmployeeFormDetail {
  template: FormTemplateRecord;
  appraisalId: number | null;
  status: EmployeeFormStatus;
  submittedAt: string | null;
  answers: EmployeeFormAnswerRecord[];
  rawScore: number;
  maxRawScore: number;
}

export interface EmployeeFormAnswerInput {
  questionId: number;
  textResponse?: string | null;
  selectedOptionId?: number | null;
  pointsEarned?: number;
}

export interface SaveEmployeeFormInput {
  answers: EmployeeFormAnswerInput[];
  submit?: boolean;
}
