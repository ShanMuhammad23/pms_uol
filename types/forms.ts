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
  NUMBER: "Number",
  TEXT: "Short Text",
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
  id?: number;
  optionLabel: string;
  pointsAssigned: number;
  sortOrder: number;
}

export interface QuestionInput {
  id?: number;
  clientId: string;
  questionText: string;
  inputType: FieldType;
  isRequired: boolean;
  sortOrder: number;
  selfAssessmentEnabled: boolean;
  hodAssessmentEnabled: boolean;
  noMarks: boolean;
  totalMarks: number;
  options: QuestionOptionInput[];
  sectionId?: number;
}

export function questionNeedsOptions(inputType: FieldType): boolean {
  return ["RADIO", "CHECKBOX", "SELECT"].includes(inputType);
}

export function applyQuestionInputTypeChange(
  question: QuestionInput,
  inputType: FieldType,
): QuestionInput {
  const nextQuestion: QuestionInput = { ...question, inputType };

  if (questionNeedsOptions(inputType) && question.options.length === 0) {
    nextQuestion.options = [
      { optionLabel: "", pointsAssigned: 0, sortOrder: 0 },
      { optionLabel: "", pointsAssigned: 0, sortOrder: 1 },
    ];
  }

  if (!questionNeedsOptions(inputType)) {
    nextQuestion.options = [];
  }

  return nextQuestion;
}

export interface FormSubsectionInput {
  id?: number;
  clientId: string;
  title: string;
  sortOrder: number;
  questions: QuestionInput[];
}

export interface FormSectionInput {
  id?: number;
  clientId: string;
  title: string;
  sortOrder: number;
  subsections: FormSubsectionInput[];
  questions: QuestionInput[];
}

export interface FormSubsectionRecord {
  id: number;
  title: string;
  sortOrder: number;
  questions: QuestionRecord[];
}

export interface FormSectionRecord {
  id: number;
  title: string;
  sortOrder: number;
  subsections: FormSubsectionRecord[];
  questions: QuestionRecord[];
}

export interface IncrementMatrixInput {
  rating: PerformanceRating;
  quartile: number;
  recommendedIncrementPercentage: number;
}

export interface FormTemplateInput {
  title: string;
  description: string;
  cycleId?: number;
  targetCategory: EmployeeCategory;
  targetSubCategory: SubCategory;
  sections: FormSectionInput[];
  questions: QuestionInput[];
  incrementMatrices?: IncrementMatrixInput[];
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
  selfAssessmentEnabled: boolean;
  hodAssessmentEnabled: boolean;
  totalMarks: number;
  sectionId?: number;
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
  sections: FormSectionRecord[];
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

export function pickDefaultAppraisalCycleId(
  cycles: AppraisalCycleRecord[],
): number | "" {
  if (cycles.length === 0) {
    return "";
  }

  const activeCycle = cycles.find((cycle) => cycle.isActive);
  return (activeCycle ?? cycles[0]).id;
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

export function createClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createEmptyQuestion(sortOrder: number): QuestionInput {
  return {
    clientId: createClientId(),
    questionText: "",
    inputType: "TEXT",
    isRequired: true,
    sortOrder,
    selfAssessmentEnabled: false,
    hodAssessmentEnabled: false,
    noMarks: false,
    totalMarks: 0,
    options: [],
  };
}

export function createEmptySubsection(sortOrder: number): FormSubsectionInput {
  return {
    clientId: createClientId(),
    title: "",
    sortOrder,
    questions: [],
  };
}

export function createEmptySection(sortOrder: number): FormSectionInput {
  return {
    clientId: createClientId(),
    title: "",
    sortOrder,
    subsections: [],
    questions: [],
  };
}

export type FormRootLayoutItem =
  | { kind: "section"; clientId: string }
  | { kind: "question"; clientId: string };

export type FormRootLayoutRecordItem =
  | { kind: "section"; id: number }
  | { kind: "question"; id: number };

export function getNextRootSortOrder(
  sections: FormSectionInput[],
  questions: QuestionInput[],
): number {
  const values = [
    ...sections.map((section) => section.sortOrder),
    ...questions.map((question) => question.sortOrder),
  ];

  if (values.length === 0) {
    return 0;
  }

  return Math.max(...values) + 1;
}

function compareRootLayoutEntries<T extends { sortOrder: number; tie: number; kind: "section" | "question" }>(
  left: T,
  right: T,
): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  if (left.kind === right.kind) {
    return left.tie - right.tie;
  }

  return left.kind === "section" ? -1 : 1;
}

export function buildRootLayoutOrder(
  sections: FormSectionInput[],
  questions: QuestionInput[],
): FormRootLayoutItem[] {
  const items = [
    ...sections.map((section, index) => ({
      kind: "section" as const,
      clientId: section.clientId,
      sortOrder: section.sortOrder,
      tie: index,
    })),
    ...questions.map((question, index) => ({
      kind: "question" as const,
      clientId: question.clientId,
      sortOrder: question.sortOrder,
      tie: index,
    })),
  ];

  items.sort(compareRootLayoutEntries);

  return items.map(({ kind, clientId }) => ({ kind, clientId }));
}

export function buildRootLayoutOrderFromRecord(
  sections: FormSectionRecord[],
  questions: QuestionRecord[],
): FormRootLayoutRecordItem[] {
  const items = [
    ...sections.map((section, index) => ({
      kind: "section" as const,
      id: section.id,
      sortOrder: section.sortOrder,
      tie: index,
    })),
    ...questions.map((question, index) => ({
      kind: "question" as const,
      id: question.id,
      sortOrder: question.sortOrder,
      tie: index,
    })),
  ];

  items.sort(compareRootLayoutEntries);

  return items.map(({ kind, id }) => ({ kind, id }));
}

export function normalizeRootFormStructure(
  sections: FormSectionInput[],
  questions: QuestionInput[],
): { sections: FormSectionInput[]; questions: QuestionInput[] } {
  const layout = buildRootLayoutOrder(sections, questions);
  const sectionMap = new Map(
    sections.map((section) => [section.clientId, section]),
  );
  const questionMap = new Map(
    questions.map((question) => [question.clientId, question]),
  );

  const nextSections: FormSectionInput[] = [];
  const nextQuestions: QuestionInput[] = [];
  let sortOrder = 0;

  for (const item of layout) {
    if (item.kind === "section") {
      const section = sectionMap.get(item.clientId);
      if (section) {
        nextSections.push({ ...section, sortOrder });
        sortOrder += 1;
      }
      continue;
    }

    const question = questionMap.get(item.clientId);
    if (question) {
      nextQuestions.push({ ...question, sortOrder });
      sortOrder += 1;
    }
  }

  return { sections: nextSections, questions: nextQuestions };
}

export function countAllQuestions(
  sections: FormSectionInput[],
  rootQuestions: QuestionInput[],
): number {
  let count = rootQuestions.length;

  for (const section of sections) {
    count += section.questions.length;
    for (const subsection of section.subsections) {
      count += subsection.questions.length;
    }
  }

  return count;
}

export function flattenAllQuestions(
  template: Pick<FormTemplateRecord, "sections" | "questions">,
): QuestionRecord[] {
  const result: QuestionRecord[] = [...template.questions];

  for (const section of template.sections) {
    result.push(...section.questions);
    for (const subsection of section.subsections) {
      result.push(...subsection.questions);
    }
  }

  return result;
}

export function mapQuestionRecordToInput(
  question: QuestionRecord,
): QuestionInput {
  return {
    id: question.id,
    clientId: createClientId(),
    questionText: question.questionText,
    inputType: question.inputType,
    isRequired: question.isRequired,
    sortOrder: question.sortOrder,
    selfAssessmentEnabled: question.selfAssessmentEnabled,
    hodAssessmentEnabled: question.hodAssessmentEnabled,
    noMarks: question.totalMarks === 0,
    totalMarks: question.totalMarks,
    sectionId: question.sectionId,
    options: question.options.map((option) => ({
      id: option.id,
      optionLabel: option.optionLabel,
      pointsAssigned: option.pointsAssigned,
      sortOrder: option.sortOrder,
    })),
  };
}
