import type { AppraisalStatus, PerformanceRating } from "@/types/forms";
import type { EmployeeFormAnswerRecord } from "@/types/employee-forms";
import type {
  FormSectionRecord,
  QuestionRecord,
} from "@/types/forms";

export type ReturnLevel = "manager2" | "manager1" | "employee";

export interface ReturnHistoryEntry {
  id: number;
  returnLevel: ReturnLevel;
  returnReason: string;
  returnedAt: string;
  returnedByName: string | null;
}

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
  templateCode: string | null;
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
  /** Total of Manager 1's saved answers (SUM of appraisal_answers.points_earned). Null when no answers. */
  manager1Score: number | null;
  /** Total of Manager 2's saved answers. Null when Manager 2 unassigned or no answers. */
  manager2Score: number | null;
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
  /** Dedicated HR approval status — independent of remarks_evaluation. */
  hrApprovalStatus: "pending" | "approved" | "review_required" | null;
  /**
   * Overall remarks entered by Manager 1 (head_id) during review.
   * Independent from question-level remarks. Only populated when the form
   * template has additional_remarks_enabled = TRUE.
   */
  manager1OverallRemarks: string | null;
  /**
   * Overall remarks entered by Manager 2 (manager_2_id) during review.
   * Independent from Manager 1 remarks and question-level remarks.
   */
  manager2OverallRemarks: string | null;
  currentSalary: number | null;
  previousSalary: number | null;
  applicableSalaryForIncrement: number | null;
  /** Title of the performance matrix assigned to the employee for the active FY. */
  assignedPerformanceMatrix: string | null;
  /** Title of the increment matrix assigned to the employee for the active FY. */
  applicableMatrix: string | null;
  /**
   * Increment % from the assigned increment matrix for the quartile resolved
   * by matching Normalized Score against the assigned performance matrix.
   */
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
  /** Manual toggle: when false, all score editing is disabled for this employee. */
  assessmentEligibility: boolean;
  /** Reason provided when eligibility was disabled. Null when eligible. */
  ineligibilityReason: string | null;
  /**
   * True when HR/Board/Super Admin returned this submission to a lower
   * workflow level (Manager 2, Manager 1, or Employee). The destination is
   * represented by the existing status/manager_level. Reset to FALSE when
   * the submission advances normally again.
   */
  isReturned: boolean;
  /** Reason provided when the submission was returned. Null when not returned. */
  returnReason: string | null;
  /** Display name of the assigned Manager 1 (users.head_id). Null when unassigned. */
  manager1Name: string | null;
  /** Display name of the assigned Manager 2 (users.manager_2_id). Null when unassigned. */
  manager2Name: string | null;
}

export interface FormSubmissionDetail {
  id: number;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  templateId: number | null;
  templateTitle: string | null;
  templateCode: string | null;
  templateDescription: string | null;
  /** Entity with category code C1 on the assignment chain (self or ancestor). */
  orgLevel1Name: string | null;
  /** Entity with category code C2 on the assignment chain (self or ancestor). */
  orgLevel2Name: string | null;
  /** Display name of the assigned Manager 1 (users.head_id). */
  manager1Name: string | null;
  /** SAP / employee_id of the assigned Manager 1. */
  manager1EmployeeId: string | null;
  /** Display name of the assigned Manager 2 (users.manager_2_id). */
  manager2Name: string | null;
  /** SAP / employee_id of the assigned Manager 2. */
  manager2EmployeeId: string | null;
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
  /**
   * True when the current viewer is the assigned manager (Manager 1 or
   * Manager 2) for the submission's current manager_level, regardless of
   * their system role. This separates "system role permission" from
   * "assessment assignment permission" — an HR/Board/SuperAdmin user who
   * is assigned as a manager for the employee is considered the assigned
   * manager at that level. Used by the frontend to unlock manager score
   * inputs for admin roles acting as the assigned manager.
   */
  isAssignedManagerForCurrentLevel: boolean;
  creditHrsErpScoreAdj: number | null;
  pubOricScoreAdj: number | null;
  qecScoreAdj: number | null;
  calibrationFactor: number | null;
  calibratedScoreNumeric: number | null;
  initialScoreNumeric: number | null;
  canEditScoreAdjustments: boolean;
  selfAssessmentEnabled: boolean;
  assessmentEligibility: boolean;
  ineligibilityReason: string | null;
  /** True when the form template has additional_remarks_enabled = TRUE. */
  additionalRemarksEnabled: boolean;
  /** Overall remarks entered by Manager 1 (read-only for non-Manager-1 viewers). */
  manager1OverallRemarks: string | null;
  /** Overall remarks entered by Manager 2 (read-only for non-Manager-2 viewers). */
  manager2OverallRemarks: string | null;
  /** True when the submission was returned to a lower workflow level. */
  isReturned: boolean;
  /** Reason provided when the submission was returned. Null when not returned. */
  returnReason: string | null;
  /** Full history of returns to this submission (all levels). */
  returnHistory?: ReturnHistoryEntry[];
}
