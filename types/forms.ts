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
  PENDING_HEAD_REVIEW: "Manager Review",
  PENDING_HR_CALIBRATION: "HR Alignment",
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

export interface RatingScaleOptionInput {
  id?: number;
  clientId: string;
  optionLabel: string;
  ratingValue: number;
  sortOrder: number;
}

export interface FormRatingScaleInput {
  id?: number;
  clientId: string;
  name: string;
  maxValue: number;
  sortOrder: number;
  options: RatingScaleOptionInput[];
}

export interface RatingScaleOptionRecord {
  id: number;
  optionLabel: string;
  ratingValue: number;
  sortOrder: number;
}

export interface FormRatingScaleRecord {
  id: number;
  name: string;
  maxValue: number;
  sortOrder: number;
  options: RatingScaleOptionRecord[];
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
  ratingScaleId?: number | null;
  ratingScaleClientId?: string;
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

/**
 * Open Assessment section: HR sets a total marks budget. The employee (self
 * assessment) or manager (direct assessment) authors the questions at fill
 * time and splits the budget across them. No form_questions rows are created
 * for an open-assessment section.
 */
export interface OpenAssessmentSectionInput {
  id?: number;
  clientId: string;
  title: string;
  sortOrder: number;
  isOpenAssessment: true;
  openAssessmentTotalMarks: number;
  /** When true, the employee can author questions during self-assessment. */
  selfAssessmentEnabled?: boolean;
  /** When true, the HOD/manager can author questions during direct assessment. */
  hodAssessmentEnabled?: boolean;
}

/**
 * Ordered layout item within a section — defines the interleaved display
 * order of subsections and direct questions. Mirrors the root-level layout
 * concept (FormRootLayoutItem) but for section children.
 */
export type FormSectionLayoutInputItem =
  | { kind: "subsection"; clientId: string }
  | { kind: "question"; clientId: string };

export interface FormSectionInput {
  id?: number;
  clientId: string;
  title: string;
  sortOrder: number;
  subsections: FormSubsectionInput[];
  questions: QuestionInput[];
  /**
   * Ordered list of subsection/question clientIds defining the interleaved
   * display order within this section. When absent, falls back to
   * subsections-first then questions (legacy behavior).
   */
  layout?: FormSectionLayoutInputItem[];
  /** When true, this section is an open-assessment section (no pre-defined questions). */
  isOpenAssessment?: boolean;
  /** HR's marks budget for the open-assessment section. Only used when isOpenAssessment is true. */
  openAssessmentTotalMarks?: number;
  /** When true, the employee can author questions during self-assessment (open-assessment sections). */
  selfAssessmentEnabled?: boolean;
  /** When true, the HOD/manager can author questions during direct assessment (open-assessment sections). */
  hodAssessmentEnabled?: boolean;
}

export interface FormSubsectionRecord {
  id: number;
  title: string;
  sortOrder: number;
  questions: QuestionRecord[];
}

/**
 * Ordered layout item within a section (record form) — defines the
 * interleaved display order of subsections and direct questions.
 */
export type FormSectionLayoutRecordItem =
  | { kind: "subsection"; id: number }
  | { kind: "question"; id: number };

export interface FormSectionRecord {
  id: number;
  title: string;
  sortOrder: number;
  subsections: FormSubsectionRecord[];
  questions: QuestionRecord[];
  /**
   * Ordered list of subsection/question IDs defining the interleaved
   * display order within this section. When absent, falls back to
   * subsections-first then questions (legacy behavior).
   */
  layout?: FormSectionLayoutRecordItem[];
  /** When true, this section is an open-assessment section (no pre-defined questions). */
  isOpenAssessment?: boolean;
  /** HR's marks budget for the open-assessment section. Only used when isOpenAssessment is true. */
  openAssessmentTotalMarks?: number;
  /** When true, the employee can author questions during self-assessment (open-assessment sections). */
  selfAssessmentEnabled?: boolean;
  /** When true, the HOD/manager can author questions during direct assessment (open-assessment sections). */
  hodAssessmentEnabled?: boolean;
}

export interface IncrementMatrixInput {
  rating: PerformanceRating;
  quartile: number;
  recommendedIncrementPercentage: number;
}

export interface FormTemplateInput {
  title: string;
  code: string;
  description: string;
  cycleId?: number;
  targetCategory?: EmployeeCategory;
  targetSubCategory?: SubCategory;
  selfAssessmentEnabled: boolean;
  additionalRemarksEnabled?: boolean;
  ratingBased?: boolean;
  ratingScales?: FormRatingScaleInput[];
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
  ratingScaleId?: number | null;
}

export interface FormTemplateListItem {
  id: number;
  title: string;
  code: string;
  description: string | null;
  cycleId: number;
  fiscalYear: number;
  targetCategory: EmployeeCategory | null;
  targetSubCategory: SubCategory | null;
  selfAssessmentEnabled: boolean;
  additionalRemarksEnabled: boolean;
  ratingBased: boolean;
  questionCount: number;
  appraisalCount: number;
  assignedEmployeeCount: number;
  /** Assigned employees who have submitted or advanced past first review. */
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
  /** User id of who last updated the template, if known. */
  updatedById: number | null;
  /** Display name of the last updater. */
  updatedByName: string | null;
  /** SAP / employee code of the last updater. */
  updatedByEmployeeId: string | null;
}

export interface FormTemplateRecord {
  id: number;
  title: string;
  code: string;
  description: string | null;
  cycleId: number;
  fiscalYear: number;
  targetCategory: EmployeeCategory | null;
  targetSubCategory: SubCategory | null;
  selfAssessmentEnabled: boolean;
  additionalRemarksEnabled: boolean;
  ratingBased: boolean;
  ratingScales: FormRatingScaleRecord[];
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
    ratingScaleId: null,
    ratingScaleClientId: "",
  };
}

export function createEmptyRatingScale(
  sortOrder: number,
  maxValue = 5,
): FormRatingScaleInput {
  return {
    clientId: createClientId(),
    name: `${maxValue}-point rating`,
    maxValue,
    sortOrder,
    options: Array.from({ length: maxValue }, (_, index) => {
      const value = index + 1;
      return {
        clientId: createClientId(),
        optionLabel: "",
        ratingValue: value,
        sortOrder: index,
      };
    }),
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
    layout: [],
    isOpenAssessment: false,
    openAssessmentTotalMarks: 0,
    selfAssessmentEnabled: true,
    hodAssessmentEnabled: true,
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

function compareLayoutEntries<T extends { sortOrder: number; tie: number; kind: string }>(
  left: T,
  right: T,
  firstKind: string,
): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  if (left.kind === right.kind) {
    return left.tie - right.tie;
  }

  return left.kind === firstKind ? -1 : 1;
}

/** Backward-compatible comparator for root-level layout (sections before questions on tie). */
function compareRootLayoutEntries<T extends { sortOrder: number; tie: number; kind: "section" | "question" }>(
  left: T,
  right: T,
): number {
  return compareLayoutEntries(left, right, "section");
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

/* -------------------------------------------------------------------------- */
/* Section-level layout helpers                                               */
/*                                                                            */
/* These mirror the root-level layout helpers but operate within a single     */
/* section, defining the interleaved order of subsections and direct          */
/* questions. When a section has a `layout` field, it is used directly.       */
/* When absent (legacy data), subsections and questions are merged by their   */
/* sort_order values using a shared sort_order pool.                          */
/* -------------------------------------------------------------------------- */

/**
 * Build the interleaved layout for a section from its subsections and
 * questions (input form). Uses the `layout` field if present, otherwise
 * merges by sort_order.
 */
export function buildSectionLayoutOrder(
  subsections: FormSubsectionInput[],
  questions: QuestionInput[],
  layout?: FormSectionLayoutInputItem[],
): FormSectionLayoutInputItem[] {
  if (layout && layout.length > 0) {
    return layout;
  }

  // Legacy fallback: merge by sort_order using a shared pool.
  const items = [
    ...subsections.map((sub, index) => ({
      kind: "subsection" as const,
      clientId: sub.clientId,
      sortOrder: sub.sortOrder,
      tie: index,
    })),
    ...questions.map((q, index) => ({
      kind: "question" as const,
      clientId: q.clientId,
      sortOrder: q.sortOrder,
      tie: index,
    })),
  ];

  items.sort((a, b) => compareLayoutEntries(a, b, "subsection"));

  return items.map(({ kind, clientId }) => ({ kind, clientId }));
}

/**
 * Build the interleaved layout for a section from its subsections and
 * questions (record form). Uses the `layout` field if present, otherwise
 * merges by sort_order.
 */
export function buildSectionLayoutOrderFromRecord(
  subsections: FormSubsectionRecord[],
  questions: QuestionRecord[],
  layout?: FormSectionLayoutRecordItem[],
): FormSectionLayoutRecordItem[] {
  if (layout && layout.length > 0) {
    return layout;
  }

  // Legacy fallback: merge by sort_order using a shared pool.
  const items = [
    ...subsections.map((sub, index) => ({
      kind: "subsection" as const,
      id: sub.id,
      sortOrder: sub.sortOrder,
      tie: index,
    })),
    ...questions.map((q, index) => ({
      kind: "question" as const,
      id: q.id,
      sortOrder: q.sortOrder,
      tie: index,
    })),
  ];

  items.sort((a, b) => compareLayoutEntries(a, b, "subsection"));

  return items.map(({ kind, id }) => ({ kind, id }));
}

/**
 * Normalize a section's internal layout: assign sequential sort_order
 * values to subsections and questions based on their position in the
 * layout. This ensures the shared sort_order pool is consistent.
 */
export function normalizeSectionLayout(
  section: FormSectionInput,
): FormSectionInput {
  const layout = buildSectionLayoutOrder(
    section.subsections,
    section.questions,
    section.layout,
  );

  const subMap = new Map(section.subsections.map((s) => [s.clientId, s]));
  const qMap = new Map(section.questions.map((q) => [q.clientId, q]));

  const nextSubs: FormSubsectionInput[] = [];
  const nextQs: QuestionInput[] = [];
  let sortOrder = 0;

  for (const item of layout) {
    if (item.kind === "subsection") {
      const sub = subMap.get(item.clientId);
      if (sub) {
        nextSubs.push({ ...sub, sortOrder });
        sortOrder += 1;
      }
    } else {
      const q = qMap.get(item.clientId);
      if (q) {
        nextQs.push({ ...q, sortOrder });
        sortOrder += 1;
      }
    }
  }

  return {
    ...section,
    subsections: nextSubs,
    questions: nextQs,
    layout,
  };
}

export function countAllQuestions(
  sections: FormSectionInput[],
  rootQuestions: QuestionInput[],
): number {
  let count = rootQuestions.length;

  for (const section of sections) {
    if (section.isOpenAssessment) {
      // Open-assessment sections count as 1 "question slot" for validation
      // purposes (at least one scored item must exist on the form).
      count += 1;
      continue;
    }
    count += section.questions.length;
    for (const subsection of section.subsections) {
      count += subsection.questions.length;
    }
  }

  return count;
}

/** Returns true when the section is an open-assessment section. */
export function isOpenAssessmentSection(
  section: { isOpenAssessment?: boolean },
): boolean {
  return Boolean(section.isOpenAssessment);
}

export function flattenAllQuestions(
  template: Pick<FormTemplateRecord, "sections" | "questions">,
): QuestionRecord[] {
  const result: QuestionRecord[] = [...template.questions];

  for (const section of template.sections) {
    if (section.isOpenAssessment) {
      continue;
    }
    result.push(...section.questions);
    for (const subsection of section.subsections) {
      result.push(...subsection.questions);
    }
  }

  return result;
}

/** Returns all open-assessment sections from a template. */
export function getOpenAssessmentSections(
  template: Pick<FormTemplateRecord, "sections">,
): FormSectionRecord[] {
  return template.sections.filter((s) => s.isOpenAssessment);
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
    ratingScaleId: question.ratingScaleId ?? null,
    ratingScaleClientId: "",
    options: question.options.map((option) => ({
      id: option.id,
      optionLabel: option.optionLabel,
      pointsAssigned: option.pointsAssigned,
      sortOrder: option.sortOrder,
    })),
  };
}
