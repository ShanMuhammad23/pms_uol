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
  | "designation"
  | "roleCategory"
  | "facultyName"
  | "deptGroupName"
  | "gradeGroup"
  | "scoreO"
  | "ratingO"
  | "creditHrsErpAdj"
  | "pubOricScoreAdj"
  | "calibrationFactor"
  | "normalizedScore"
  | "ratingN"
  | "quartile"
  | "dateOfJoining"
  | "uolExperience"
  | "eligible"
  | "applicableDuration"
  | "remarksEvaluation"
  | "currentSalary"
  | "previousSalary"
  | "salaryDiff"
  | "applicableSalaryForIncrement"
  | "applicableMatrix"
  | "applicableIncrementPercent"
  | "incrementPerMatrix"
  | "incrementAdjusted"
  | "revisedSalary"
  | "revisedSalaryRo"
  | "hodReviewComments"
  | "remarksCompensation"
  | "qualification"
  | "qualificationYear"
  | "qualificationSubject"
  | "qualificationInstitute"
  | "qualificationCountry"
  | "status"
  | "actions";

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

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

export const DASHBOARD_TABLE_COLUMNS: DashboardTableColumnDef[] = [
  {
    id: "sapCode",
    label: "SAP Code",
    getValue: (row) => formatNullable(row.employeeId),
  },
  {
    id: "employeeName",
    label: "Employee Name",
    width: 180,
    getValue: (row) => formatNullable(row.employeeName),
  },
  {
    id: "designation",
    label: "Designation",
    width: 160,
    wrap: true,
    getValue: (row) => formatNullable(row.designation),
  },
  {
    id: "roleCategory",
    label: "Role Category",
    width: 100,
    wrap: true,
    getValue: (row) => formatNullable(row.roleCategory),
  },
  {
    id: "facultyName",
    label: "ORG Level 1",
    width: 160,
    wrap: true,
    getValue: (row) => formatNullable(row.parentEntityName ?? row.entityName),
  },
  {
    id: "deptGroupName",
    label: "ORG Level 2",
    width: 160,
    wrap: true,
    getValue: (row) =>
      formatNullable(row.parentEntityName ? row.entityName : null),
  },
  {
    id: "gradeGroup",
    label: "Column 1",
    getValue: (row) => formatNullable(row.gradeGroup),
  },
  {
    id: "scoreO",
    label: "Score (O)",
    align: "center",
    width: 80,
    wrap: true,
    getValue: (row) => formatNumber(row.scoreO ?? row.rawScore, 2),
  },
  {
    id: "ratingO",
    label: "Rating (O)",
    getValue: (row) => formatNullable(row.ratingO ?? row.initialRating),
  },
  {
    id: "creditHrsErpAdj",
    label: "CH Adj",
    align: "center",
    width: 80,
    wrap: true,
    getValue: (row) => formatNumber(row.creditHrsErpScoreAdj),
  },
  {
    id: "pubOricScoreAdj",
    label: "ORIC Adj",
    align: "center",
    width: 80,
    wrap: true,
    getValue: (row) => formatNumber(row.pubOricScoreAdj),
  },
  {
    id: "calibrationFactor",
    label: "Cal. Fr",
    align: "center",
    width: 80,
    wrap: true,
    getValue: (row) => formatNumber(row.calibrationFactor, 4),
  },
  {
    id: "normalizedScore",
    label: "Norm. Score",
    align: "center",
    width: 80,
    wrap: true,
    getValue: (row) => formatNumber(row.normalizedScore),
  },
  {
    id: "ratingN",
    label: "Rating (N)",
    getValue: (row) =>
      formatNullable(row.ratingN ?? row.calibratedRating ?? row.performanceLevelName),
  },
  {
    id: "quartile",
    label: "Quartile",
    getValue: (row) => formatNullable(row.quartileName),
  },
  {
    id: "dateOfJoining",
    label: "DOJ",
    getValue: (row) => formatDate(row.dateOfJoining),
  },
  {
    id: "uolExperience",
    label: "UoL Exp",
    align: "right",
    getValue: (row) => formatNumber(row.uolExperienceYears),
  },
  {
    id: "eligible",
    label: "Eligible?",
    getValue: (row) =>
      getEligibilityShortLabel(getSubmissionEligibilityStatus(row)),
  },
  {
    id: "applicableDuration",
    label: "Applicable Dur",
    align: "center",
    width: 100,
    wrap: true,
    getValue: (row) =>
      formatNumber(getSubmissionApplicableDurationFactor(row), 2),
  },
  {
    id: "remarksEvaluation",
    label: "Remarks Evaluation",
    width: 220,
    wrap: true,
    getValue: (row) => formatNullable(row.remarksEvaluation),
  },
  {
    id: "currentSalary",
    label: "Current Sal",
    align: "right",
    getValue: (row) => formatNumber(row.currentSalary),
  },
  {
    id: "previousSalary",
    label: "Prev Salary",
    align: "right",
    getValue: (row) => formatNumber(row.previousSalary),
  },
  {
    id: "salaryDiff",
    label: "Diff (Current - Prev.)",
    align: "right",
    getValue: (row) => {
      if (row.currentSalary == null || row.previousSalary == null) return "—";
      return formatNumber(row.currentSalary - row.previousSalary);
    },
  },
  {
    id: "applicableSalaryForIncrement",
    label: "Applicable Sal for Incr",
    align: "right",
    getValue: (row) => formatNumber(row.applicableSalaryForIncrement),
  },
  {
    id: "applicableMatrix",
    label: "Applicable Matrix",
    getValue: (row) => formatNullable(row.applicableMatrix),
  },
  {
    id: "applicableIncrementPercent",
    label: "Applicable Incr %",
    align: "right",
    getValue: (row) => formatNumber(row.applicableIncrementPercent),
  },
  {
    id: "incrementPerMatrix",
    label: "Increment Per Matrix",
    align: "right",
    getValue: (row) => formatNumber(row.incrementPerMatrix),
  },
  {
    id: "incrementAdjusted",
    label: "Increment Adjusted",
    align: "right",
    getValue: (row) => formatNumber(row.incrementAdjusted),
  },
  {
    id: "revisedSalary",
    label: "Revised Salary",
    align: "right",
    getValue: (row) => formatNumber(row.revisedSalary),
  },
  {
    id: "revisedSalaryRo",
    label: "Revised Salary (RO)",
    align: "right",
    getValue: (row) => formatNumber(row.revisedSalaryRo),
  },
  {
    id: "hodReviewComments",
    label: "HOD Review Comments",
    width: 220,
    wrap: true,
    getValue: (row) => formatNullable(row.hodReviewComments),
  },
  {
    id: "remarksCompensation",
    label: "Remarks Compensation",
    width: 220,
    wrap: true,
    getValue: (row) => formatNullable(row.remarksCompensation),
  },
  {
    id: "qualification",
    label: "Qualification",
    width: 140,
    wrap: true,
    getValue: (row) => formatNullable(row.qualification),
  },
  {
    id: "qualificationYear",
    label: "Year",
    align: "right",
    getValue: (row) => formatNullable(row.qualificationYear),
  },
  {
    id: "qualificationSubject",
    label: "Subject",
    width: 140,
    wrap: true,
    getValue: (row) => formatNullable(row.qualificationSubject),
  },
  {
    id: "qualificationInstitute",
    label: "Institute",
    width: 160,
    wrap: true,
    getValue: (row) => formatNullable(row.qualificationInstitute),
  },
  {
    id: "qualificationCountry",
    label: "Country",
    width: 100,
    getValue: (row) => formatNullable(row.qualificationCountry),
  },
  {
    id: "status",
    label: "Status",
    pinned: true,
    width: 160,
    getValue: (row) => APPRAISAL_STATE_CONFIG[row.status]?.label ?? row.status,
  },
  {
    id: "actions",
    label: "Actions",
    pinned: true,
    width: 80,
    align: "center",
    getValue: () => "",
  },
];

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
  return DASHBOARD_TABLE_COLUMNS.find((column) => column.id === id);
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

  for (const id of [...columnOrder, ...defaults]) {
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
