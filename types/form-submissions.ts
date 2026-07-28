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
  dateOfJoining: string | null;
  empCategory: string | null;
  empSubCategory: string | null;
  templateId: number | null;
  templateTitle: string | null;
  /** True when this employee has an individual row in employee_form_assignments for the cycle. */
  formAssigned: boolean;
  /** True when this employee is marked for direct score entry (no form assignment). */
  directScoreEntry: boolean;
  entityId: number | null;
  entityName: string | null;
  parentEntityName: string | null;
  /** Entity with category code C1 on the assignment chain (self or ancestor). */
  orgLevel1Name: string | null;
  /** Entity with category code C2 on the assignment chain (self or ancestor). */
  orgLevel2Name: string | null;
  status: AppraisalStatus;
  /**
   * Appraisal review stage: 1 = Manager 1 (users.head_id),
   * 2 = Manager 2 (users.manager_2_id).
   */
  managerLevel: number | null;
  /** Internal user id of the employee (for manager assignment joins). */
  employeeUserId?: number | null;
  /** Assigned Manager 1 user id (users.head_id). */
  manager1UserId?: number | null;
  /** Assigned Manager 2 user id (users.manager_2_id). */
  manager2UserId?: number | null;
  rawScore: number;
  maxRawScore: number;
  scorePercent: number;
  scoreO: number | null;
  ratingO: PerformanceRating | null;
  creditHrsErpScoreAdj: number | null;
  pubOricScoreAdj: number | null;
  qecScoreAdj: number | null;
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
  selfAssessmentEnabled: boolean;
}

export interface FormSubmissionDetail {
  id: number;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  templateId: number | null;
  templateTitle: string | null;
  templateDescription: string | null;
  status: AppraisalStatus;
  /** 1 = Manager 1 review; 2 = Manager 2 review. */
  managerLevel: number | null;
  manager1UserId?: number | null;
  manager2UserId?: number | null;
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
  managerAnswers: EmployeeFormAnswerRecord[];
  manager1Answers: EmployeeFormAnswerRecord[];
  manager2Answers: EmployeeFormAnswerRecord[];
  canEditManagerReview: boolean;
  canEditHrReview: boolean;
  creditHrsErpScoreAdj: number | null;
  pubOricScoreAdj: number | null;
  qecScoreAdj: number | null;
  calibrationFactor: number | null;
  calibratedScoreNumeric: number | null;
  initialScoreNumeric: number | null;
  canEditScoreAdjustments: boolean;
  selfAssessmentEnabled: boolean;
}
