import type { AppraisalStatus } from "@/types/forms";
import type { EmployeeFormAnswerRecord } from "@/types/employee-forms";
import type { QuestionRecord } from "@/types/forms";

export interface FormSubmissionListItem {
  id: number;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  templateId: number | null;
  templateTitle: string | null;
  staffCategoryName: string | null;
  staffSubCategoryName: string | null;
  status: AppraisalStatus;
  rawScore: number;
  maxRawScore: number;
  scorePercent: number;
  performanceLevelName: string | null;
  quartileName: string | null;
  submittedAt: string;
}

export interface FormSubmissionDetail {
  id: number;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  templateId: number | null;
  templateTitle: string | null;
  templateDescription: string | null;
  staffCategoryName: string | null;
  staffSubCategoryName: string | null;
  status: AppraisalStatus;
  rawScore: number;
  maxRawScore: number;
  scorePercent: number;
  performanceLevelName: string | null;
  quartileName: string | null;
  quartileScoreMin: number | null;
  quartileScoreMax: number | null;
  submittedAt: string;
  questions: QuestionRecord[];
  answers: EmployeeFormAnswerRecord[];
}
