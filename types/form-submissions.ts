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
  designation: string | null;
  /** Free-text role category; not derived from staff categories. */
  roleCategory: string | null;
  gradeGroup: string | null;
  dateOfJoining: string | null;
  empCategory: string | null;
  empSubCategory: string | null;
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
  scoreO: number | null;
  ratingO: PerformanceRating | null;
  creditHrsErpScoreAdj: number | null;
  pubOricScoreAdj: number | null;
  calibrationFactor: number | null;
  normalizedScore: number | null;
  ratingN: PerformanceRating | null;
  performanceLevelName: string | null;
  quartileName: string | null;
  initialRating: PerformanceRating | null;
  calibratedRating: PerformanceRating | null;
  uolExperienceYears: number | null;
  isEligible: boolean | null;
  applicableDuration: string | null;
  /** 1 = full, 0 = not eligible, otherwise months-to-evaluation / 12. */
  applicableDurationFactor: number | null;
  remarksEvaluation: string | null;
  currentSalary: number | null;
  previousSalary: number | null;
  applicableSalaryForIncrement: number | null;
  applicableMatrix: string | null;
  applicableIncrementPercent: number | null;
  incrementPerMatrix: number | null;
  incrementAdjusted: number | null;
  revisedSalary: number | null;
  revisedSalaryRo: number | null;
  hodReviewComments: string | null;
  remarksCompensation: string | null;
  qualification: string | null;
  qualificationYear: number | null;
  qualificationSubject: string | null;
  qualificationInstitute: string | null;
  qualificationCountry: string | null;
  eligibilityStatus?: "Fully Eligible" | "Partially Eligible" | "Not Eligible";
  eligibilityReferenceYear?: number | null;
  eligibilityReferenceEndDate?: string | null;
  submittedAt: string | null;
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
  submittedAt: string | null;
  sections: FormSectionRecord[];
  rootQuestions: QuestionRecord[];
  questions: QuestionRecord[];
  answers: EmployeeFormAnswerRecord[];
}
