export type FieldType = "TEXT" | "NUMBER" | "RADIO" | "CHECKBOX" | "SELECT" | "TEXTAREA";

export type EmployeeCategory =
  | "ACADEMIC"
  | "SUPPORT_STAFF"
  | "BLUE_COLLAR"
  | "ADMINISTRATION";

export type SubCategory =
  | "FACULTY_MEMBER"
  | "HOD"
  | "DEAN"
  | "PROFESSIONAL"
  | "SEMI_PROFESSIONAL"
  | "GENERAL"
  | "SKILLED"
  | "SEMI_SKILLED"
  | "BLUE_COLLAR_GENERAL"
  | "SYSTEM_ADMIN";

export type PerformanceRating =
  | "UNSATISFACTORY"
  | "IMPROVEMENT_NEEDED"
  | "STRONG"
  | "EXCELLENT"
  | "OUTSTANDING";

export type AppraisalStatus =
  | "PENDING_SELF_ASSESSMENT"
  | "PENDING_HEAD_REVIEW"
  | "PENDING_HR_CALIBRATION"
  | "PENDING_BOARD_APPROVAL"
  | "APPROVED"
  | "COMPLETED";

export const EMPLOYEE_CATEGORIES: EmployeeCategory[] = [
  "ACADEMIC",
  "SUPPORT_STAFF",
  "BLUE_COLLAR",
  "ADMINISTRATION",
];

export const CATEGORY_SUB_MAP: Record<EmployeeCategory, SubCategory[]> = {
  ACADEMIC: ["FACULTY_MEMBER", "HOD", "DEAN"],
  SUPPORT_STAFF: ["PROFESSIONAL", "SEMI_PROFESSIONAL", "GENERAL"],
  BLUE_COLLAR: ["SKILLED", "SEMI_SKILLED", "BLUE_COLLAR_GENERAL"],
  ADMINISTRATION: ["SYSTEM_ADMIN"],
};

export const FIELD_TYPES: FieldType[] = [
  "TEXT",
  "NUMBER",
  "RADIO",
  "CHECKBOX",
  "SELECT",
  "TEXTAREA",
];

export const PERFORMANCE_RATINGS: PerformanceRating[] = [
  "UNSATISFACTORY",
  "IMPROVEMENT_NEEDED",
  "STRONG",
  "EXCELLENT",
  "OUTSTANDING",
];

export const APPRAISAL_STATUSES: AppraisalStatus[] = [
  "PENDING_SELF_ASSESSMENT",
  "PENDING_HEAD_REVIEW",
  "PENDING_HR_CALIBRATION",
  "PENDING_BOARD_APPROVAL",
  "APPROVED",
  "COMPLETED",
];

export const APPRAISAL_STATUS_LABELS: Record<AppraisalStatus, string> = {
  PENDING_SELF_ASSESSMENT: "Self Assessment",
  PENDING_HEAD_REVIEW: "Head Review",
  PENDING_HR_CALIBRATION: "HR Calibration",
  PENDING_BOARD_APPROVAL: "Board Approval",
  APPROVED: "Approved",
  COMPLETED: "Completed",
};

export const CATEGORY_LABELS: Record<EmployeeCategory, string> = {
  ACADEMIC: "Academic",
  SUPPORT_STAFF: "Support Staff",
  BLUE_COLLAR: "Blue Collar",
  ADMINISTRATION: "Administration",
};

export const SUB_CATEGORY_LABELS: Record<SubCategory, string> = {
  FACULTY_MEMBER: "Faculty Member",
  HOD: "Head of Department",
  DEAN: "Dean",
  PROFESSIONAL: "Professional",
  SEMI_PROFESSIONAL: "Semi Professional",
  GENERAL: "General",
  SKILLED: "Skilled",
  SEMI_SKILLED: "Semi Skilled",
  BLUE_COLLAR_GENERAL: "Blue Collar General",
  SYSTEM_ADMIN: "System Admin",
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: "Short Text",
  NUMBER: "Number",
  RADIO: "Radio (Single Choice)",
  CHECKBOX: "Checkbox (Multiple Choice)",
  SELECT: "Dropdown",
  TEXTAREA: "Long Text",
};

export const RATING_LABELS: Record<PerformanceRating, string> = {
  UNSATISFACTORY: "Unsatisfactory",
  IMPROVEMENT_NEEDED: "Improvement Needed",
  STRONG: "Strong",
  EXCELLENT: "Excellent",
  OUTSTANDING: "Outstanding",
};

export interface QuestionOptionInput {
  optionLabel: string;
  pointsAssigned: number;
  sortOrder: number;
}

export interface QuestionInput {
  questionText: string;
  inputType: FieldType;
  isRequired: boolean;
  sortOrder: number;
  options: QuestionOptionInput[];
}

export interface IncrementMatrixInput {
  rating: PerformanceRating;
  quartile: number;
  recommendedIncrementPercentage: number;
}

export interface FormTemplateInput {
  title: string;
  description: string;
  cycleId: number;
  targetCategory: EmployeeCategory;
  targetSubCategory: SubCategory;
  questions: QuestionInput[];
  incrementMatrices: IncrementMatrixInput[];
}

export interface QuestionOptionRecord {
  id: number;
  optionLabel: string;
  pointsAssigned: number;
  sortOrder: number;
}

export interface QuestionRecord {
  id: number;
  questionText: string;
  inputType: FieldType;
  isRequired: boolean;
  sortOrder: number;
  options: QuestionOptionRecord[];
}

export interface FormTemplateListItem {
  id: number;
  title: string;
  description: string | null;
  cycleId: number;
  fiscalYear: number;
  targetCategory: EmployeeCategory;
  targetSubCategory: SubCategory;
  questionCount: number;
  appraisalCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormTemplateRecord {
  id: number;
  title: string;
  description: string | null;
  cycleId: number;
  fiscalYear: number;
  targetCategory: EmployeeCategory;
  targetSubCategory: SubCategory;
  questions: QuestionRecord[];
  incrementMatrices: IncrementMatrixInput[];
  createdAt: string;
  updatedAt: string;
}

export interface AppraisalCycleRecord {
  id: number;
  fiscalYear: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateAppraisalCycleInput {
  fiscalYear: number;
  startDate: string;
  endDate: string;
  isActive?: boolean;
}

export function formatEnumLabel(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export function createDefaultIncrementMatrix(): IncrementMatrixInput[] {
  const entries: IncrementMatrixInput[] = [];

  for (const rating of PERFORMANCE_RATINGS) {
    for (let quartile = 1; quartile <= 4; quartile += 1) {
      entries.push({
        rating,
        quartile,
        recommendedIncrementPercentage: 0,
      });
    }
  }

  return entries;
}

export function createEmptyQuestion(sortOrder: number): QuestionInput {
  return {
    questionText: "",
    inputType: "TEXT",
    isRequired: true,
    sortOrder,
    options: [],
  };
}
