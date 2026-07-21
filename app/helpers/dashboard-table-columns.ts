import {
  getEligibilityShortLabel,
  getSubmissionApplicableDurationFactor,
  getSubmissionEligibilityStatus,
} from "@/app/helpers/dashboard-eligibility";
import { APPRAISAL_STATE_CONFIG } from "@/app/helpers/dashboard-form-state";
import type { FormSubmissionListItem } from "@/types/form-submissions";

export type DashboardTableColumnId =
  | "sapCode"
  | "employeeName"
  | "formAssignment"
  | "designation"
  | "roleCategory"
  | "facultyName"
  | "deptGroupName"
  | "dateOfJoining"
  | "uolExperience"
  | "qualification"
  | "qualificationSubject"
  | "qualificationYear"
  | "qualificationInstitute"
  | "qualificationCountry"
  | "status"
  | "gradeGroup"
  | "eligible"
  | "applicableDuration"
  | "scoreO"
  | "creditHrsErpAdj"
  | "pubOricScoreAdj"
  | "adjustedScore"
  | "ratingO"
  | "calibrationFactor"
  | "normalizedScore"
  | "ratingN"
  | "quartile"
  | "remarksEvaluation"
  | "currentSalary"
  | "previousSalary"
  | "salaryDiff"
  | "applicableSalaryForIncrement"
  | "applicableMatrix"
  | "incrementPerMatrix"
  | "incrementAdjusted"
  | "revisedSalary"
  | "revisedSalaryRo"
  | "remarksCompensation"
  | "hodReviewComments";

export type DashboardTableColumnDef = {
  id: DashboardTableColumnId;
  label: string;
  /** Pinned columns stay visible and are excluded from hide toggles. */
  pinned?: boolean;
  align?: "left" | "right" | "center";
  /** Fixed column width in pixels. Omit to size from content. */
  width?: number;
  /** Allow multi-line wrapping. Defaults to false (single line). */
  wrap?: boolean;
  getValue: (row: FormSubmissionListItem) => string;
};

export type DashboardColumnSectionId = "basic" | "performance" | "compensation";

export type DashboardColumnSection = {
  id: DashboardColumnSectionId;
  label: string;
  columnIds: readonly DashboardTableColumnId[];
};

/** Canonical staff listing / master-filter column order by section. */
export const DASHBOARD_COLUMN_SECTIONS: readonly DashboardColumnSection[] = [
  {
    id: "basic",
    label: "Basic",
    columnIds: [
      "sapCode",
      "employeeName",
      "formAssignment",
      "designation",
      "roleCategory",
      "facultyName",
      "deptGroupName",
      "dateOfJoining",
      "uolExperience",
      "qualification",
      "qualificationSubject",
      "qualificationYear",
      "qualificationInstitute",
      "qualificationCountry",
      "status",
      "gradeGroup",
    ],
  },
  {
    id: "performance",
    label: "Performance",
    columnIds: [
      "eligible",
      "applicableDuration",
      "scoreO",
      "creditHrsErpAdj",
      "pubOricScoreAdj",
      "adjustedScore",
      "ratingO",
      "calibrationFactor",
      "normalizedScore",
      "ratingN",
      "quartile",
      "remarksEvaluation",
    ],
  },
  {
    id: "compensation",
    label: "Compensation",
    columnIds: [
      "currentSalary",
      "previousSalary",
      "salaryDiff",
      "applicableSalaryForIncrement",
      "applicableMatrix",
      "incrementPerMatrix",
      "incrementAdjusted",
      "revisedSalary",
      "revisedSalaryRo",
      "remarksCompensation",
      "hodReviewComments",
    ],
  },
] as const;

/** Inline style for fixed-width columns. */
export function getColumnWidthStyle(
  column: Pick<DashboardTableColumnDef, "width">,
): { width: number; minWidth: number; maxWidth: number } | undefined {
  if (column.width == null) return undefined;
  return {
    width: column.width,
    minWidth: column.width,
    maxWidth: column.width,
  };
}

function formatNullable(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function getAdjustedScore(row: FormSubmissionListItem): number | null {
  const scoreO = row.scoreO ?? row.rawScore;
  if (scoreO === null || scoreO === undefined || Number.isNaN(scoreO)) {
    return null;
  }

  return (
    scoreO +
    (row.creditHrsErpScoreAdj ?? 0) +
    (row.pubOricScoreAdj ?? 0)
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

function isFormAssigned(row: FormSubmissionListItem): boolean {
  return row.formAssigned;
}

const COLUMN_BY_ID: Record<DashboardTableColumnId, DashboardTableColumnDef> = {
  sapCode: {
    id: "sapCode",
    label: "SAP Code",
    width: 120,
    getValue: (row) => formatNullable(row.employeeId),
  },
  employeeName: {
    id: "employeeName",
    label: "Employee Name",
    width: 180,
    getValue: (row) => formatNullable(row.employeeName),
  },
  formAssignment: {
    id: "formAssignment",
    label: "Form Assignment",
    width: 130,
    getValue: (row) => (isFormAssigned(row) ? "Assigned" : "Not Assigned"),
  },
  designation: {
    id: "designation",
    label: "Designation",
    width: 160,
    wrap: true,
    getValue: (row) => formatNullable(row.designation),
  },
  roleCategory: {
    id: "roleCategory",
    label: "Role Category",
    width: 100,
    wrap: true,
    getValue: (row) => formatNullable(row.roleCategory),
  },
  facultyName: {
    id: "facultyName",
    label: "ORG Level 1",
    width: 160,
    wrap: true,
    getValue: (row) => formatNullable(row.orgLevel1Name),
  },
  deptGroupName: {
    id: "deptGroupName",
    label: "ORG Level 2",
    width: 160,
    wrap: true,
    getValue: (row) => formatNullable(row.orgLevel2Name),
  },
  dateOfJoining: {
    id: "dateOfJoining",
    label: "DOJ",
    getValue: (row) => formatDate(row.dateOfJoining),
  },
  uolExperience: {
    id: "uolExperience",
    label: "UoL Exp",
    align: "right",
    getValue: (row) => formatNumber(row.uolExperienceYears),
  },
  qualification: {
    id: "qualification",
    label: "Qualification",
    width: 140,
    wrap: true,
    getValue: (row) => formatNullable(row.qualification),
  },
  qualificationSubject: {
    id: "qualificationSubject",
    label: "Subject",
    width: 140,
    wrap: true,
    getValue: (row) => formatNullable(row.qualificationSubject),
  },
  qualificationYear: {
    id: "qualificationYear",
    label: "Year",
    align: "right",
    getValue: (row) => formatNullable(row.qualificationYear),
  },
  qualificationInstitute: {
    id: "qualificationInstitute",
    label: "Institution",
    width: 160,
    wrap: true,
    getValue: (row) => formatNullable(row.qualificationInstitute),
  },
  qualificationCountry: {
    id: "qualificationCountry",
    label: "Country",
    width: 100,
    getValue: (row) => formatNullable(row.qualificationCountry),
  },
  status: {
    id: "status",
    label: "Status",
    width: 160,
    getValue: (row) => APPRAISAL_STATE_CONFIG[row.status]?.label ?? row.status,
  },
  gradeGroup: {
    id: "gradeGroup",
    label: "Column 1",
    getValue: (row) => formatNullable(row.gradeGroup),
  },
  eligible: {
    id: "eligible",
    label: "Eligible?",
    getValue: (row) =>
      getEligibilityShortLabel(getSubmissionEligibilityStatus(row)),
  },
  applicableDuration: {
    id: "applicableDuration",
    label: "Applicable Dur",
    align: "center",
    width: 100,
    wrap: true,
    getValue: (row) =>
      formatNumber(getSubmissionApplicableDurationFactor(row), 2),
  },
  scoreO: {
    id: "scoreO",
    label: "Score (O)",
    align: "center",
    width: 80,
    wrap: true,
    getValue: (row) => formatNumber(row.scoreO ?? row.rawScore, 2),
  },
  creditHrsErpAdj: {
    id: "creditHrsErpAdj",
    label: "CH Adj",
    align: "center",
    width: 80,
    wrap: true,
    getValue: (row) => formatNumber(row.creditHrsErpScoreAdj),
  },
  pubOricScoreAdj: {
    id: "pubOricScoreAdj",
    label: "ORIC Adj",
    align: "center",
    width: 80,
    wrap: true,
    getValue: (row) => formatNumber(row.pubOricScoreAdj),
  },
  adjustedScore: {
    id: "adjustedScore",
    label: "Adjusted Score",
    align: "center",
    width: 110,
    wrap: true,
    getValue: (row) => formatNumber(getAdjustedScore(row)),
  },
  ratingO: {
    id: "ratingO",
    label: "Rating (O)",
    getValue: (row) => formatNullable(row.ratingO ?? row.initialRating),
  },
  calibrationFactor: {
    id: "calibrationFactor",
    label: "Cal. Fr",
    align: "center",
    width: 80,
    wrap: true,
    getValue: (row) => formatNumber(row.calibrationFactor, 4),
  },
  normalizedScore: {
    id: "normalizedScore",
    label: "Norm. Score",
    align: "center",
    width: 80,
    wrap: true,
    getValue: (row) => formatNumber(row.normalizedScore),
  },
  ratingN: {
    id: "ratingN",
    label: "Rating (N)",
    getValue: (row) =>
      formatNullable(row.ratingN ?? row.calibratedRating ?? row.performanceLevelName),
  },
  quartile: {
    id: "quartile",
    label: "Quartile",
    getValue: (row) => formatNullable(row.quartileName),
  },
  remarksEvaluation: {
    id: "remarksEvaluation",
    label: "Remarks Evaluation",
    width: 220,
    wrap: true,
    getValue: (row) => formatNullable(row.remarksEvaluation),
  },
  currentSalary: {
    id: "currentSalary",
    label: "Current Sal",
    align: "right",
    getValue: (row) => formatNumber(row.currentSalary),
  },
  previousSalary: {
    id: "previousSalary",
    label: "Prev Salary",
    align: "right",
    getValue: (row) => formatNumber(row.previousSalary),
  },
  salaryDiff: {
    id: "salaryDiff",
    label: "Difference",
    align: "right",
    getValue: (row) => {
      if (row.currentSalary == null || row.previousSalary == null) return "—";
      return formatNumber(row.currentSalary - row.previousSalary);
    },
  },
  applicableSalaryForIncrement: {
    id: "applicableSalaryForIncrement",
    label: "Applicable Sal",
    align: "right",
    getValue: (row) => formatNumber(row.applicableSalaryForIncrement),
  },
  applicableMatrix: {
    id: "applicableMatrix",
    label: "Applicable Matrix",
    getValue: (row) => formatNullable(row.applicableMatrix),
  },
  incrementPerMatrix: {
    id: "incrementPerMatrix",
    label: "Increment Per Matrix",
    align: "right",
    getValue: (row) => formatNumber(row.incrementPerMatrix),
  },
  incrementAdjusted: {
    id: "incrementAdjusted",
    label: "Increment Adjustment",
    align: "right",
    getValue: (row) => formatNumber(row.incrementAdjusted),
  },
  revisedSalary: {
    id: "revisedSalary",
    label: "Revised Salary",
    align: "right",
    getValue: (row) => formatNumber(row.revisedSalary),
  },
  revisedSalaryRo: {
    id: "revisedSalaryRo",
    label: "Revised Salary (RO)",
    align: "right",
    getValue: (row) => formatNumber(row.revisedSalaryRo),
  },
  remarksCompensation: {
    id: "remarksCompensation",
    label: "Remarks Compensation",
    width: 220,
    wrap: true,
    getValue: (row) => formatNullable(row.remarksCompensation),
  },
  hodReviewComments: {
    id: "hodReviewComments",
    label: "HOD Remarks",
    width: 220,
    wrap: true,
    getValue: (row) => formatNullable(row.hodReviewComments),
  },
};

/** Flat column list in section order (no section labels). */
export const DASHBOARD_TABLE_COLUMNS: DashboardTableColumnDef[] =
  DASHBOARD_COLUMN_SECTIONS.flatMap((section) =>
    section.columnIds.map((id) => COLUMN_BY_ID[id]),
  );

export const DASHBOARD_TABLE_COLUMN_STORAGE_KEY = "pms-dashboard-table-columns";

export const TOGGLEABLE_DASHBOARD_TABLE_COLUMNS = DASHBOARD_TABLE_COLUMNS.filter(
  (column) => !column.pinned,
);

export const PINNED_DASHBOARD_TABLE_COLUMNS = DASHBOARD_TABLE_COLUMNS.filter(
  (column) => column.pinned,
);

export function getDefaultVisibleColumnIds(): DashboardTableColumnId[] {
  return DASHBOARD_TABLE_COLUMNS.map((column) => column.id);
}

export function getDefaultColumnOrder(): DashboardTableColumnId[] {
  return TOGGLEABLE_DASHBOARD_TABLE_COLUMNS.map((column) => column.id);
}

export function getColumnById(
  id: DashboardTableColumnId,
): DashboardTableColumnDef | undefined {
  return COLUMN_BY_ID[id];
}

export function getSectionColumns(
  sectionId: DashboardColumnSectionId,
): DashboardTableColumnDef[] {
  const section = DASHBOARD_COLUMN_SECTIONS.find((item) => item.id === sectionId);
  if (!section) return [];
  return section.columnIds.map((id) => COLUMN_BY_ID[id]);
}

/** Apply saved toggleable order; pinned columns always remain at the end. */
export function resolveOrderedColumns(
  columnOrder: DashboardTableColumnId[],
  visibleIds: DashboardTableColumnId[],
): DashboardTableColumnDef[] {
  const visible = new Set(visibleIds);
  const byId = new Map(
    DASHBOARD_TABLE_COLUMNS.map((column) => [column.id, column] as const),
  );
  const defaults = getDefaultColumnOrder();
  const seen = new Set<DashboardTableColumnId>();
  const orderedToggleable: DashboardTableColumnDef[] = [];

  for (const id of [...defaults, ...columnOrder]) {
    if (seen.has(id)) continue;
    seen.add(id);
    const column = byId.get(id);
    if (!column || column.pinned || !visible.has(id)) continue;
    orderedToggleable.push(column);
  }

  const pinnedVisible = PINNED_DASHBOARD_TABLE_COLUMNS.filter((column) =>
    visible.has(column.id),
  );

  return [...orderedToggleable, ...pinnedVisible];
}
