import type { AppraisalStatus, PerformanceRating } from "@/types/forms";
import type { EmployeeFormAnswerRecord } from "@/types/employee-forms";
import type {
  FormSectionRecord,
  QuestionRecord,
} from "@/types/forms";

export interface FormSubmissionListItem {
  id: number;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  templateId: number | null;
  templateTitle: string | null;
  staffCategoryId: number | null;
  staffCategoryName: string | null;
  staffSubCategoryId: number | null;
  staffSubCategoryName: string | null;
  entityId: number | null;
  entityName: string | null;
  parentEntityName: string | null;
  status: AppraisalStatus;
  rawScore: number;
  maxRawScore: number;
  scorePercent: number;
  performanceLevelName: string | null;
  quartileName: string | null;
  initialRating: PerformanceRating | null;
  calibratedRating: PerformanceRating | null;
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
  sections: FormSectionRecord[];
  rootQuestions: QuestionRecord[];
  questions: QuestionRecord[];
  answers: EmployeeFormAnswerRecord[];
}
