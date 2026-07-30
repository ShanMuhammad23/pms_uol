import {
  getEligibilityShortLabel,
  getSubmissionApplicableDurationFactor,
  getSubmissionEligibilityDisplayStatus,
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
  | "eligible"
  | "applicableDuration"
  | "scoreO"
  | "creditHrsErpAdj"
  | "pubOricScoreAdj"
  | "qecScoreAdj"
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
      "qecScoreAdj",
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

function formatNumber(value: number | string | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return Number.isInteger(num) ? String(num) : num.toFixed(digits);
}

function getAdjustedScore(row: FormSubmissionListItem): number | null {
  const scoreO = row.scoreO ?? row.rawScore;
  if (scoreO === null || scoreO === undefined || Number.isNaN(scoreO)) {
    return null;
  }

  const chAdj = row.creditHrsErpScoreAdj ?? 0;
  const oricAdj = row.pubOricScoreAdj ?? 0;
  const qecAdj = row.qecScoreAdj ?? 0;

  return scoreO + chAdj + oricAdj + qecAdj;
}

function getAdjustedScorePercent(row: FormSubmissionListItem): number | null {
  const adjusted = getAdjustedScore(row);
  if (adjusted === null || row.maxRawScore <= 0) return null;
  return Number(((adjusted / row.maxRawScore) * 100).toFixed(2));
}

function getAdjustedRating(row: FormSubmissionListItem): string | null {
  const pct = getAdjustedScorePercent(row);
  if (pct === null) return null;
  if (pct >= 85) return "OS";
  if (pct >= 70) return "EX";
  if (pct >= 55) return "ST";
  if (pct >= 40) return "IN";
  return "UN";
}

function getNormalizedScore(row: FormSubmissionListItem): number | null {
  const adjusted = getAdjustedScore(row);
  if (adjusted === null) return null;
  const calFr = row.calibrationFactor ?? 1;
  return adjusted * calFr;
}

function getNormalizedScorePercent(row: FormSubmissionListItem): number | null {
  const normalized = getNormalizedScore(row);
  if (normalized === null || row.maxRawScore <= 0) return null;
  return Number(((normalized / row.maxRawScore) * 100).toFixed(2));
}

function getNormalizedRating(row: FormSubmissionListItem): string | null {
  const pct = getNormalizedScorePercent(row);
  if (pct === null) return null;
  if (pct >= 85) return "OS";
  if (pct >= 70) return "EX";
  if (pct >= 55) return "ST";
  if (pct >= 40) return "IN";
  return "UN";
}

function getNormalizedQuartile(row: FormSubmissionListItem): string | null {
  const pct = getNormalizedScorePercent(row);
  if (pct === null) return null;

  const levelDefs = [
    { name: "UN", scoreMin: 0, scoreMax: 39 },
    { name: "IN", scoreMin: 40, scoreMax: 54 },
    { name: "ST", scoreMin: 55, scoreMax: 69 },
    { name: "EX", scoreMin: 70, scoreMax: 84 },
    { name: "OS", scoreMin: 85, scoreMax: 100 },
  ];

  const level = levelDefs.find(
    (l) => pct >= l.scoreMin && pct <= l.scoreMax,
  );
  if (!level) return null;

  const bandSize = (level.scoreMax - level.scoreMin + 1) / 4;
  const quartileIndex = Math.min(
    3,
    Math.floor((pct - level.scoreMin) / bandSize),
  );

  return `${level.name}-Q${quartileIndex + 1}`;
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
    width: 160,
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
    label: "Form",
    width: 80,
    getValue: (row) =>
      row.directScoreEntry
        ? "DS"
        : isFormAssigned(row)
          ? row.selfAssessmentEnabled
            ? "✔"
            : "MA"
          : "✖",
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
    getValue: (row) =>
      row.directScoreEntry
        ? "Direct Score Entry"
        : APPRAISAL_STATE_CONFIG[row.status]?.label ?? row.status,
  },
  eligible: {
    id: "eligible",
    label: "Eligible?",
    align: "center",
    width: 90,
    getValue: (row) =>
      getEligibilityShortLabel(getSubmissionEligibilityDisplayStatus(row)),
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
    getValue: (row) => formatNumber(row.creditHrsErpScoreAdj, 0),
  },
  pubOricScoreAdj: {
    id: "pubOricScoreAdj",
    label: "ORIC Adj",
    align: "center",
    width: 80,
    wrap: true,
    getValue: (row) => formatNumber(row.pubOricScoreAdj, 0),
  },
  qecScoreAdj: {
    id: "qecScoreAdj",
    label: "QEC Adj",
    align: "center",
    width: 80,
    wrap: true,
    getValue: (row) => formatNumber(row.qecScoreAdj, 0),
  },
  adjustedScore: {
    id: "adjustedScore",
    label: "Adj Score (100)",
    align: "center",
    width: 110,
    wrap: true,
    getValue: (row) => {
      const pct = getAdjustedScorePercent(row);
      if (pct === null) return "—";
      return `${formatNumber(pct)}`;
    },
  },
  ratingO: {
    id: "ratingO",
    label: "Rating (O)",
    getValue: (row) => formatNullable(getAdjustedRating(row)),
  },
  calibrationFactor: {
    id: "calibrationFactor",
    label: "Cal. Fr",
    align: "center",
    width: 160,
    wrap: true,
    getValue: (row) => formatNumber(row.calibrationFactor ?? 1, 1),
  },
  normalizedScore: {
    id: "normalizedScore",
    label: "Norm. Score (100)",
    align: "center",
    width: 80,
    wrap: true,
    getValue: (row) => {
      const pct = getNormalizedScorePercent(row);
      if (pct === null) return "—";
      return `${formatNumber(pct)}`;
    },
  },
  ratingN: {
    id: "ratingN",
    label: "Rating (N)",
    getValue: (row) => formatNullable(getNormalizedRating(row)),
  },
  quartile: {
    id: "quartile",
    label: "Quartile",
    getValue: (row) => formatNullable(getNormalizedQuartile(row)),
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

/**
 * Staff listing columns available to HEAD role (display + API payload).
 * Order matches the Head dashboard listing contract.
 */
export const HEAD_DASHBOARD_TABLE_COLUMN_IDS = [
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
  "eligible",
  "applicableDuration",
  "scoreO",
] as const satisfies readonly DashboardTableColumnId[];

export const HEAD_DASHBOARD_TABLE_COLUMN_ID_SET = new Set<DashboardTableColumnId>(
  HEAD_DASHBOARD_TABLE_COLUMN_IDS,
);

export const HEAD_DASHBOARD_TABLE_COLUMN_STORAGE_KEY =
  "pms-dashboard-table-columns-head";

export function isHeadDashboardColumn(
  id: DashboardTableColumnId,
): boolean {
  return HEAD_DASHBOARD_TABLE_COLUMN_ID_SET.has(id);
}

export function getHeadDashboardColumnSections(): DashboardColumnSection[] {
  return DASHBOARD_COLUMN_SECTIONS.map((section) => ({
    ...section,
    columnIds: section.columnIds.filter((id) => isHeadDashboardColumn(id)),
  })).filter((section) => section.columnIds.length > 0);
}

export const DASHBOARD_TABLE_COLUMN_STORAGE_KEY = "pms-dashboard-table-columns";

export const TOGGLEABLE_DASHBOARD_TABLE_COLUMNS = DASHBOARD_TABLE_COLUMNS.filter(
  (column) => !column.pinned,
);

export const PINNED_DASHBOARD_TABLE_COLUMNS = DASHBOARD_TABLE_COLUMNS.filter(
  (column) => column.pinned,
);

export function getDefaultVisibleColumnIds(
  allowedIds?: readonly DashboardTableColumnId[],
): DashboardTableColumnId[] {
  if (!allowedIds) {
    return DASHBOARD_TABLE_COLUMNS.map((column) => column.id);
  }
  const allowed = new Set(allowedIds);
  return DASHBOARD_TABLE_COLUMNS.map((column) => column.id).filter((id) =>
    allowed.has(id),
  );
}

export function getDefaultColumnOrder(
  allowedIds?: readonly DashboardTableColumnId[],
): DashboardTableColumnId[] {
  const toggleable = TOGGLEABLE_DASHBOARD_TABLE_COLUMNS.map(
    (column) => column.id,
  );
  if (!allowedIds) {
    return toggleable;
  }
  const allowed = new Set(allowedIds);
  return toggleable.filter((id) => allowed.has(id));
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
  allowedIds?: readonly DashboardTableColumnId[],
): DashboardTableColumnDef[] {
  const allowed = allowedIds ? new Set(allowedIds) : null;
  const visible = new Set(
    visibleIds.filter((id) => (allowed ? allowed.has(id) : true)),
  );
  const byId = new Map(
    DASHBOARD_TABLE_COLUMNS.map((column) => [column.id, column] as const),
  );
  const defaults = getDefaultColumnOrder(allowedIds);
  const seen = new Set<DashboardTableColumnId>();
  const orderedToggleable: DashboardTableColumnDef[] = [];

  // Prefer saved columnOrder first; append any new default columns at the end.
  for (const id of [...columnOrder, ...defaults]) {
    if (seen.has(id)) continue;
    if (allowed && !allowed.has(id)) continue;
    seen.add(id);
    const column = byId.get(id);
    if (!column || column.pinned || !visible.has(id)) continue;
    orderedToggleable.push(column);
  }

  const pinnedVisible = PINNED_DASHBOARD_TABLE_COLUMNS.filter(
    (column) =>
      visible.has(column.id) && (allowed ? allowed.has(column.id) : true),
  );

  return [...orderedToggleable, ...pinnedVisible];
}
