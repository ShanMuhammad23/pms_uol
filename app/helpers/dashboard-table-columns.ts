import {
  getEligibilityShortLabel,
  getSubmissionApplicableDurationFactor,
  getSubmissionEligibilityDisplayStatus,
} from "@/app/helpers/dashboard-eligibility";
import { APPRAISAL_STATE_CONFIG } from "@/app/helpers/dashboard-form-state";
import { getReportingManagerScore } from "@/app/helpers/score-o";
import {
  getAdjustedScore as sharedGetAdjustedScore,
  getNormalizedScorePercent as sharedGetNormalizedScorePercent,
} from "@/lib/performance-rating";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { AdditionalAccessModule } from "@/types/additional-access";

export type HrApprovalStatus = "pending" | "approved" | "review_required";

/**
 * Maps an AdditionalAccessModule to the dashboard column IDs that should
 * become visible when a user has view or edit access to that module.
 * Used to extend the Head (MANAGER) role's base column set.
 */
export const ADDITIONAL_ACCESS_MODULE_COLUMNS: Record<
  AdditionalAccessModule,
  DashboardTableColumnId[]
> = {
  FORMS: [],
  CREDIT_HOURS: ["creditHrsErpAdj"],
  ORIC_ADJUSTMENTS: ["pubOricScoreAdj"],
  QEC_ADJUSTMENTS: ["qecScoreAdj"],
  USERS: [],
  MATRICES_AND_CYCLES: [],
  ORGANIZATION_LEVELS: [],
};

export function getHrApprovalStatus(row: FormSubmissionListItem): HrApprovalStatus {
  // Use the dedicated hr_approval_status column — no longer derived from remarks.
  if (row.hrApprovalStatus === "review_required") return "review_required";
  if (row.hrApprovalStatus === "approved") return "approved";
  // Fallback for legacy rows where hr_approval_status is still 'pending'
  // but the appraisal has already advanced past HR calibration.
  if (
    row.status === "PENDING_BOARD_APPROVAL" ||
    row.status === "APPROVED" ||
    row.status === "COMPLETED"
  ) {
    return "approved";
  }
  return "pending";
}

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
  | "hrApprovalStatus"
  | "normalizedScore"
  | "performanceMatrixAssignment"
  | "ratingN"
  | "quartile"
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
  /** Marks the column as numeric, enabling GT/LT range filtering. */
  numeric?: boolean;
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
      "hrApprovalStatus",
      "normalizedScore",
      "performanceMatrixAssignment",
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
      "applicableIncrementPercent",
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
  return sharedGetAdjustedScore(row);
}

function getAdjustedScorePercent(row: FormSubmissionListItem): number | null {
  const adjusted = getAdjustedScore(row);
  if (adjusted === null || row.maxRawScore <= 0) return null;
  return Number(((adjusted / row.maxRawScore) * 100).toFixed(2));
}

function getAdjustedRating(row: FormSubmissionListItem): string | null {
  // Rating (O) depends completely on Score (O). Only show a rating when
  // the official reporting-manager score is valid and greater than 0.
  // This prevents stale ratings, self-assessment ratings, or calculated
  // ratings from appearing without a valid official score.
  const officialScore = getReportingManagerScore(row);
  if (officialScore === null || officialScore === undefined || officialScore <= 0) {
    return null;
  }

  const pct = getAdjustedScorePercent(row);
  if (pct === null) return null;
  if (pct >= 85) return "OS";
  if (pct >= 70) return "EX";
  if (pct >= 55) return "ST";
  if (pct >= 40) return "IN";
  return "UN";
}

function getNormalizedScorePercent(row: FormSubmissionListItem): number | null {
  return sharedGetNormalizedScorePercent(row);
}

export function hasValidNormalizedScore(row: FormSubmissionListItem): boolean {
  const pct = getNormalizedScorePercent(row);
  return pct !== null && pct > 0;
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
          ? row.templateCode?.trim()
            ? row.templateCode.trim()
            : row.selfAssessmentEnabled
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
    numeric: true,
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
    numeric: true,
    getValue: (row) =>
      formatNumber(getSubmissionApplicableDurationFactor(row), 2),
  },
  scoreO: {
    id: "scoreO",
    label: "Score (O)",
    align: "center",
    width: 80,
    wrap: true,
    numeric: true,
    // Score (O) reflects the official reporting-manager score, never the
    // employee self-assessment. See getReportingManagerScore for the
    // decision tree (Manager 2 → Manager 1 → placeholder).
    getValue: (row) => formatNumber(getReportingManagerScore(row), 2),
  },
  creditHrsErpAdj: {
    id: "creditHrsErpAdj",
    label: "CH Adj",
    align: "center",
    width: 80,
    wrap: true,
    numeric: true,
    getValue: (row) => formatNumber(row.creditHrsErpScoreAdj, 0),
  },
  pubOricScoreAdj: {
    id: "pubOricScoreAdj",
    label: "ORIC Adj",
    align: "center",
    width: 80,
    wrap: true,
    numeric: true,
    getValue: (row) => formatNumber(row.pubOricScoreAdj, 0),
  },
  qecScoreAdj: {
    id: "qecScoreAdj",
    label: "QEC Adj",
    align: "center",
    width: 80,
    wrap: true,
    numeric: true,
    getValue: (row) => formatNumber(row.qecScoreAdj, 0),
  },
  adjustedScore: {
    id: "adjustedScore",
    label: "Adj Score (100)",
    align: "center",
    width: 110,
    wrap: true,
    numeric: true,
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
    numeric: true,
    getValue: (row) => formatNumber(row.calibrationFactor ?? 1, 1),
  },
  hrApprovalStatus: {
    id: "hrApprovalStatus",
    label: "HR Actions",
    align: "center",
    width: 110,
    getValue: (row) => {
      const status = getHrApprovalStatus(row);
      if (status === "approved") return "Approved";
      if (status === "review_required") return "Review Required";
      return "Pending";
    },
  },
  normalizedScore: {
    id: "normalizedScore",
    label: "Norm. Score (100)",
    align: "center",
    width: 80,
    wrap: true,
    numeric: true,
    // Same source as Rating (N), Quartile, and the dashboard matrix:
    // persisted Norm. Score when present, otherwise Score (O) × Cal. Fr.
    getValue: (row) => {
      const pct = getNormalizedScorePercent(row);
      if (pct === null) return "—";
      return `${formatNumber(pct)}`;
    },
  },
  performanceMatrixAssignment: {
    id: "performanceMatrixAssignment",
    label: "Perf. Matrix",
    width: 120,
    wrap: true,
    getValue: (row) =>
      row.assignedPerformanceMatrix?.trim()
        ? row.assignedPerformanceMatrix.trim()
        : "✖",
  },
  ratingN: {
    id: "ratingN",
    label: "Rating (N)",
    // Use the persisted performanceLevelName from the server, which is
    // resolved from the normalized score % and the configured performance
    // matrix bands. This is the single source of truth — do NOT
    // recalculate with hardcoded thresholds here.
    getValue: (row) => formatNullable(row.performanceLevelName),
  },
  quartile: {
    id: "quartile",
    label: "Quartile",
    // Use the persisted quartileName from the server, which is resolved
    // from the normalized score % and the configured performance matrix
    // bands. This is the single source of truth — do NOT recalculate
    // with hardcoded level definitions here.
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
    numeric: true,
    getValue: (row) => formatNumber(row.currentSalary),
  },
  previousSalary: {
    id: "previousSalary",
    label: "Prev Salary",
    align: "right",
    numeric: true,
    getValue: (row) => formatNumber(row.previousSalary),
  },
  salaryDiff: {
    id: "salaryDiff",
    label: "Difference",
    align: "right",
    numeric: true,
    getValue: (row) => {
      if (row.currentSalary == null || row.previousSalary == null) return "—";
      return formatNumber(row.currentSalary - row.previousSalary);
    },
  },
  applicableSalaryForIncrement: {
    id: "applicableSalaryForIncrement",
    label: "Applicable Sal",
    align: "right",
    numeric: true,
    getValue: (row) => formatNumber(row.applicableSalaryForIncrement),
  },
  applicableMatrix: {
    id: "applicableMatrix",
    label: "Applicable Matrix",
    getValue: (row) =>
      row.applicableMatrix?.trim() ? row.applicableMatrix.trim() : "✖",
  },
  applicableIncrementPercent: {
    id: "applicableIncrementPercent",
    label: "Increment %",
    align: "right",
    width: 90,
    numeric: true,
    getValue: (row) => formatNumber(row.applicableIncrementPercent),
  },
  incrementPerMatrix: {
    id: "incrementPerMatrix",
    label: "Increment Per Matrix",
    align: "right",
    numeric: true,
    getValue: (row) => formatNumber(row.incrementPerMatrix),
  },
  incrementAdjusted: {
    id: "incrementAdjusted",
    label: "Increment Adjustment",
    align: "right",
    numeric: true,
    getValue: (row) => formatNumber(row.incrementAdjusted),
  },
  revisedSalary: {
    id: "revisedSalary",
    label: "Revised Salary",
    align: "right",
    numeric: true,
    getValue: (row) => formatNumber(row.revisedSalary),
  },
  revisedSalaryRo: {
    id: "revisedSalaryRo",
    label: "Revised Salary (RO)",
    align: "right",
    numeric: true,
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

/**
 * Fixed column layout for Manager 1 / Manager 2 roles in the Staff Listing.
 *
 * Managers do NOT get column management — they always see this predefined
 * layout with the first four columns frozen (sticky) during horizontal
 * scrolling. Saved column preferences are ignored for these roles.
 *
 * Frozen columns (sticky, in order):
 *   1. SAP ID        (sapCode)
 *   2. Employee Name (employeeName)
 *   3. Designation   (designation)
 *   4. Status        (status)
 *
 * Normal columns (in order):
 *   5. Applicable Duration (applicableDuration)
 *   6. Score(O)           (scoreO)
 *   7. Form               (formAssignment)
 *   8. Org Level 2        (deptGroupName)
 *   9. Date of Joining    (dateOfJoining)
 *  10. UOL Exp            (uolExperience)
 *  11. Qualification      (qualification)
 *  12. Subject            (qualificationSubject)
 *  13. Year               (qualificationYear)
 *  14. Institute          (qualificationInstitute)
 *  15. Country            (qualificationCountry)
 */
export const MANAGER_FIXED_FROZEN_COLUMN_IDS = [
  "sapCode",
  "employeeName",
  "designation",
  "status",
] as const satisfies readonly DashboardTableColumnId[];

export const MANAGER_FIXED_NORMAL_COLUMN_IDS = [
  "applicableDuration",
  "scoreO",
  "formAssignment",
  "deptGroupName",
  "dateOfJoining",
  "uolExperience",
  "qualification",
  "qualificationSubject",
  "qualificationYear",
  "qualificationInstitute",
  "qualificationCountry",
] as const satisfies readonly DashboardTableColumnId[];

/** All visible column IDs for the fixed manager layout, in display order. */
export const MANAGER_FIXED_COLUMN_IDS: readonly DashboardTableColumnId[] = [
  ...MANAGER_FIXED_FROZEN_COLUMN_IDS,
  ...MANAGER_FIXED_NORMAL_COLUMN_IDS,
];

/** Frozen column IDs for the fixed manager layout. */
export const MANAGER_FIXED_FROZEN_COLUMNS: readonly DashboardTableColumnDef[] =
  MANAGER_FIXED_FROZEN_COLUMN_IDS.map((id) => COLUMN_BY_ID[id]);

/** Normal (non-frozen) columns for the fixed manager layout, in order. */
export const MANAGER_FIXED_NORMAL_COLUMNS: readonly DashboardTableColumnDef[] =
  MANAGER_FIXED_NORMAL_COLUMN_IDS.map((id) => COLUMN_BY_ID[id]);

/** All column defs for the fixed manager layout, in display order. */
export const MANAGER_FIXED_COLUMNS: readonly DashboardTableColumnDef[] = [
  ...MANAGER_FIXED_FROZEN_COLUMNS,
  ...MANAGER_FIXED_NORMAL_COLUMNS,
];

export const MANAGER_FIXED_COLUMN_ID_SET = new Set<DashboardTableColumnId>(
  MANAGER_FIXED_COLUMN_IDS,
);

export function isManagerFixedColumn(
  id: DashboardTableColumnId,
): boolean {
  return MANAGER_FIXED_COLUMN_ID_SET.has(id);
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

/**
 * Role-based column configuration layer for the Staff Listing table.
 *
 * - HR / Board / Super Admin: return the full customizable column set.
 *   Saved column preferences are honored.
 * - Manager 1 / Manager 2 (MANAGER role): return the fixed predefined
 *   layout. Column management is disabled and saved preferences are
 *   ignored — the manager always sees the same columns in the same order
 *   with the first four columns frozen.
 *
 * Returns the column definitions to render, in display order.
 */
export function getStaffListingColumns(
  role: string | null | undefined,
): readonly DashboardTableColumnDef[] {
  if (role === "MANAGER") {
    return MANAGER_FIXED_COLUMNS;
  }
  // HR, BOARD, SUPER_ADMIN (and any future admin role) get the full set.
  return DASHBOARD_TABLE_COLUMNS;
}

/**
 * Whether the given role is allowed to use column management (show/hide,
 * reorder, resize, freeze/unfreeze, save preferences) on the Staff Listing.
 *
 * Managers are excluded — they always see the fixed layout.
 */
export function canManageStaffListingColumns(
  role: string | null | undefined,
): boolean {
  return role !== "MANAGER";
}
