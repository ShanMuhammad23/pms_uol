import { getSubmissionStatusLabel } from "@/app/helpers/dashboard-form-state";
import {
  getEligibilityShortLabel,
  getSubmissionApplicableDurationFactor,
  getSubmissionEligibilityDisplayStatus,
} from "@/app/helpers/dashboard-eligibility";
import { getHrApprovalStatus } from "@/app/helpers/dashboard-table-columns";
import { getReportingManagerScore } from "@/app/helpers/score-o";
import {
  getApplicableSalary,
  getIncrementAdjusted,
  getIncrementPerMatrix,
  getRevisedSalary,
  getRevisedSalaryRo,
} from "@/app/helpers/compensation-worksheet";
import {
  getAdjustedScorePercent,
  getNormalizedScorePercent,
  canResolvePerformanceRating,
} from "@/lib/performance-rating";
import type { EntityRecord } from "@/types/entities";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { UserRecord } from "@/types/users";

/**
 * Union of Users listing + Staff listing + Submissions list columns
 * (SAP is always frozen on the sheet, so it is not selectable).
 */
export type BulkUploadColumnId =
  | "employeeName"
  | "email"
  | "empCategory"
  | "empSubCategory"
  | "formStatus"
  | "formAssignment"
  | "templateTitle"
  | "designation"
  | "roleCategory"
  | "orgLevel1"
  | "orgLevel2"
  | "dateOfJoining"
  | "systemRole"
  | "manager1"
  | "manager2"
  | "accountStatus"
  | "qualification"
  | "qualificationYear"
  | "qualificationSubject"
  | "qualificationInstitute"
  | "qualificationCountry"
  | "appraisalStatus"
  | "submittedAt"
  | "uolExperience"
  | "eligibilityDisplay"
  | "assessmentEligibility"
  | "applicableDuration"
  | "rawScore"
  | "scorePercent"
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

export type BulkUploadColumnInput =
  | "text"
  | "number"
  | "date"
  | "textarea"
  | "select"
  | "org1"
  | "org2"
  | "manager"
  | "form"
  | "readonly";

export type BulkUploadColumnGroup = "basic" | "performance" | "compensation";

const GROUP_LABEL: Record<BulkUploadColumnGroup, string> = {
  basic: "Basic",
  performance: "Performance",
  compensation: "Compensation",
};

export function bulkUploadGroupLabel(group: BulkUploadColumnGroup): string {
  return GROUP_LABEL[group];
}

export type BulkUploadColumnDef = {
  id: BulkUploadColumnId;
  label: string;
  group: BulkUploadColumnGroup;
  input: BulkUploadColumnInput;
  minWidth: number;
  /** When false, the sheet shows the current value but does not save it. */
  persistable: boolean;
};

function col(
  id: BulkUploadColumnId,
  label: string,
  group: BulkUploadColumnGroup,
  input: BulkUploadColumnInput,
  minWidth: number,
  persistable = false,
): BulkUploadColumnDef {
  return { id, label, group, input, minWidth, persistable };
}

export const BULK_UPLOAD_COLUMNS: readonly BulkUploadColumnDef[] = [
  col("employeeName", "Name", "basic", "text", 180, true),
  col("email", "Email", "basic", "text", 200, true),
  col("formAssignment", "Form", "basic", "form", 180, true),
  col("formStatus", "Form status", "basic", "readonly", 110),
  col("templateTitle", "Form title", "basic", "readonly", 180),
  col("designation", "Designation", "basic", "text", 160, true),
  col("roleCategory", "Role Category", "basic", "text", 140, true),
  col("orgLevel1", "ORG Level 1", "basic", "org1", 180, true),
  col("orgLevel2", "ORG Level 2", "basic", "org2", 180, true),
  col("dateOfJoining", "Date of Joining", "basic", "date", 150, true),
  col("systemRole", "System Role", "basic", "select", 140, true),
  col("manager1", "Manager 1", "basic", "manager", 200, true),
  col("manager2", "Manager 2", "basic", "manager", 200, true),
  col("accountStatus", "Account status", "basic", "select", 120),
  col("empCategory", "Emp. Category", "basic", "select", 130),
  col("empSubCategory", "Emp. Sub-Category", "basic", "select", 140),
  col("uolExperience", "UoL Exp", "basic", "readonly", 90),
  col("qualification", "Qualification", "basic", "text", 150, true),
  col("qualificationSubject", "Subject", "basic", "text", 140, true),
  col("qualificationYear", "Year", "basic", "number", 88, true),
  col("qualificationInstitute", "Institute", "basic", "text", 160, true),
  col("qualificationCountry", "Country", "basic", "text", 120, true),
  col("appraisalStatus", "Appraisal status", "basic", "readonly", 160),
  col("submittedAt", "Submitted", "basic", "readonly", 160),
  col("eligibilityDisplay", "Eligible?", "performance", "readonly", 100),
  col("assessmentEligibility", "Eligible (toggle)", "performance", "select", 130, true),
  col("applicableDuration", "Applicable Dur", "performance", "readonly", 110),
  col("rawScore", "Raw score", "performance", "readonly", 100),
  col("scorePercent", "Score %", "performance", "readonly", 90),
  col("scoreO", "Score (O)", "performance", "readonly", 90),
  col("creditHrsErpAdj", "CH adjustment", "performance", "number", 90, true),
  col("pubOricScoreAdj", "ORIC adj", "performance", "number", 90, true),
  col("qecScoreAdj", "QEC adjust", "performance", "number", 90, true),
  col("adjustedScore", "Adj Score (100)", "performance", "readonly", 110),
  col("ratingO", "Rating (O)", "performance", "readonly", 110),
  col("calibrationFactor", "Cal. Fr", "performance", "number", 90, true),
  col("hrApprovalStatus", "HR Actions", "performance", "readonly", 130),
  col("normalizedScore", "Norm. Score", "performance", "readonly", 110),
  col("performanceMatrixAssignment", "Perf. Matrix", "performance", "readonly", 140),
  col("ratingN", "Rating (N)", "performance", "readonly", 130),
  col("quartile", "Quartile", "performance", "readonly", 110),
  col("remarksEvaluation", "Remarks Evaluation", "performance", "readonly", 200),
  col("currentSalary", "Current Salary", "compensation", "number", 120, true),
  col("previousSalary", "Salary (Cycle Start)", "compensation", "number", 120, true),
  col("salaryDiff", "Difference", "compensation", "readonly", 100),
  col("applicableSalaryForIncrement", "Applicable Sal", "compensation", "readonly", 120),
  col("applicableMatrix", "Applicable Matrix", "compensation", "readonly", 150),
  col("applicableIncrementPercent", "Increment %", "compensation", "readonly", 100),
  col("incrementPerMatrix", "Increment Per Matrix", "compensation", "readonly", 140),
  col("incrementAdjusted", "Increment Adjustment", "compensation", "readonly", 150),
  col("revisedSalary", "Revised Salary", "compensation", "readonly", 120),
  col("revisedSalaryRo", "Revised Salary RO", "compensation", "readonly", 130),
  col("remarksCompensation", "Salary Change Remarks", "compensation", "textarea", 200, true),
  col("hodReviewComments", "Remarks Perf.", "compensation", "readonly", 200),
];

export const BULK_UPLOAD_COLUMN_GROUPS: readonly BulkUploadColumnGroup[] = [
  "basic",
  "performance",
  "compensation",
];

/** Columns HR can select and map from Excel on the bulk-upload screen. */
export const BULK_UPLOAD_SELECTABLE_COLUMN_IDS: readonly BulkUploadColumnId[] = [
  "employeeName",
  "email",
  "designation",
  "dateOfJoining",
  "qualification",
  "qualificationSubject",
  "qualificationYear",
  "qualificationInstitute",
  "qualificationCountry",
  "creditHrsErpAdj",
  "pubOricScoreAdj",
  "qecScoreAdj",
  "currentSalary",
  "previousSalary",
  "remarksCompensation",
];

export const BULK_UPLOAD_SELECTABLE_COLUMNS: readonly BulkUploadColumnDef[] =
  BULK_UPLOAD_COLUMNS.filter((column) =>
    BULK_UPLOAD_SELECTABLE_COLUMN_IDS.includes(column.id),
  );

export const DEFAULT_BULK_UPLOAD_COLUMN_IDS: readonly BulkUploadColumnId[] =
  BULK_UPLOAD_SELECTABLE_COLUMN_IDS;

/** Shown and required when adding a new employee row. */
export const CREATE_REQUIRED_COLUMN_IDS: readonly BulkUploadColumnId[] = [
  "email",
  "systemRole",
  "empCategory",
  "empSubCategory",
];

const CREATE_FIELD_IDS = new Set<BulkUploadColumnId>([
  "employeeName",
  "email",
  "dateOfJoining",
  "accountStatus",
  "empCategory",
  "empSubCategory",
  "formAssignment",
  "designation",
  "roleCategory",
  "orgLevel1",
  "orgLevel2",
  "systemRole",
  "manager1",
  "manager2",
  "qualification",
  "qualificationYear",
  "qualificationSubject",
  "qualificationInstitute",
  "qualificationCountry",
  "assessmentEligibility",
]);

export function isBulkUploadCreateField(id: BulkUploadColumnId): boolean {
  return CREATE_FIELD_IDS.has(id);
}

export function emptyBulkUploadRowValues(): Record<BulkUploadColumnId, string> {
  const values = {} as Record<BulkUploadColumnId, string>;
  for (const column of BULK_UPLOAD_COLUMNS) {
    values[column.id] = "";
  }
  values.systemRole = "EMPLOYEE";
  values.assessmentEligibility = "true";
  values.accountStatus = "Active";
  return values;
}

export function getBulkUploadColumn(
  id: BulkUploadColumnId,
): BulkUploadColumnDef {
  const column = BULK_UPLOAD_COLUMNS.find((item) => item.id === id);
  if (!column) {
    throw new Error(`Unknown bulk upload column: ${id}`);
  }
  return column;
}

function asText(value: string | number | boolean | null | undefined): string {
  if (value == null || value === "") return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function toIsoDate(value: string | null | undefined): string {
  if (!value) return "";
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

function formatListingFormStatus(row: FormSubmissionListItem): string {
  if (row.directScoreEntry) return "DS";
  if (!row.formAssigned) return "✖";
  const code = row.templateCode?.trim();
  if (code) return code;
  return row.selfAssessmentEnabled ? "✔" : "MA";
}

function formatRatingO(row: FormSubmissionListItem): string {
  if (!canResolvePerformanceRating(row)) return "";
  return row.adjustedPerformanceLevelName ?? "";
}

function formatHrActions(row: FormSubmissionListItem): string {
  const status = getHrApprovalStatus(row);
  if (status === "approved") return "Approved";
  if (status === "review_required") return "Review Required";
  return "Pending";
}

export function orgLevelsFromEntityId(
  entityId: number | null,
  entities: EntityRecord[],
): { org1: string; org2: string } {
  if (entityId == null) return { org1: "", org2: "" };
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  let current = byId.get(entityId) ?? null;
  let org1 = "";
  let org2 = "";

  let org0 = "";
  while (current) {
    if (current.categoryCode === "C1") org1 = String(current.id);
    if (current.categoryCode === "C0" && !org0) org0 = String(current.id);
    if (current.categoryCode === "C2") org2 = String(current.id);
    current =
      current.parentEntityId != null
        ? (byId.get(current.parentEntityId) ?? null)
        : null;
  }

  if (!org1) org1 = org0;
  if (org1 || org2) {
    if (!org1) {
      const entity = byId.get(entityId);
      if (entity?.parentEntityId) org1 = String(entity.parentEntityId);
      else if (entity) org1 = String(entity.id);
    }
    return { org1, org2 };
  }

  const entity = byId.get(entityId);
  if (!entity) return { org1: "", org2: "" };
  if (entity.parentEntityId) {
    return {
      org1: String(entity.parentEntityId),
      org2: String(entity.id),
    };
  }
  return { org1: String(entity.id), org2: "" };
}

export function resolveEntityIdFromOrgLevels(
  org1: string,
  org2: string,
): number | null {
  if (org2.trim()) {
    const parsed = Number(org2);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (org1.trim()) {
    const parsed = Number(org1);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function isOrg2UnderOrg1(
  org2Id: string,
  org1Id: string,
  entities: EntityRecord[],
): boolean {
  if (!org2Id || !org1Id) return false;
  const parentId = Number(org1Id);
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  let current = byId.get(Number(org2Id)) ?? null;
  while (current) {
    if (current.id === parentId) return true;
    current =
      current.parentEntityId != null
        ? (byId.get(current.parentEntityId) ?? null)
        : null;
  }
  return false;
}

export function buildBulkUploadRowValues(
  row: FormSubmissionListItem,
  user: UserRecord | undefined,
  entities: EntityRecord[],
): Record<BulkUploadColumnId, string> {
  const org = orgLevelsFromEntityId(row.entityId, entities);
  const salaryDiff =
    row.currentSalary != null && row.previousSalary != null
      ? String(row.currentSalary - row.previousSalary)
      : "";
  const scoreO = getReportingManagerScore(row);
  const adjustedPct = getAdjustedScorePercent(row);
  const normalizedPct = getNormalizedScorePercent(row);
  const appraisalLabel = getSubmissionStatusLabel(row);

  return {
    employeeName: row.employeeName ?? "",
    email: user?.email ?? row.employeeEmail ?? "",
    empCategory: row.empCategory ?? user?.empCategory ?? "",
    empSubCategory: row.empSubCategory ?? user?.empSubCategory ?? "",
    formStatus: formatListingFormStatus(row),
    formAssignment: row.templateId != null ? String(row.templateId) : "",
    templateTitle: row.templateTitle ?? "",
    designation: row.designation ?? "",
    roleCategory: row.roleCategory ?? "",
    orgLevel1: org.org1,
    orgLevel2: org.org2,
    dateOfJoining:
      toIsoDate(row.dateOfJoining) || toIsoDate(user?.dateOfJoining) || "",
    systemRole: user?.systemRole ?? "",
    manager1: row.manager1UserId != null ? String(row.manager1UserId) : "",
    manager2: row.manager2UserId != null ? String(row.manager2UserId) : "",
    accountStatus: user
      ? user.isActive
        ? "Active"
        : "Inactive"
      : "Active",
    qualification: row.qualification ?? "",
    qualificationYear:
      row.qualificationYear != null ? String(row.qualificationYear) : "",
    qualificationSubject: row.qualificationSubject ?? "",
    qualificationInstitute: row.qualificationInstitute ?? "",
    qualificationCountry: row.qualificationCountry ?? "",
    appraisalStatus: appraisalLabel,
    submittedAt: row.submittedAt
      ? new Date(row.submittedAt).toLocaleString()
      : "",
    uolExperience: asText(row.uolExperienceYears),
    eligibilityDisplay: getEligibilityShortLabel(
      getSubmissionEligibilityDisplayStatus(row),
    ),
    assessmentEligibility: row.assessmentEligibility ? "true" : "false",
    applicableDuration: asText(getSubmissionApplicableDurationFactor(row)),
    rawScore:
      row.maxRawScore != null
        ? `${row.rawScore} / ${row.maxRawScore}`
        : asText(row.rawScore),
    scorePercent: asText(row.scorePercent),
    scoreO: scoreO != null ? String(scoreO) : "",
    creditHrsErpAdj: asText(row.creditHrsErpScoreAdj),
    pubOricScoreAdj: asText(row.pubOricScoreAdj),
    qecScoreAdj: asText(row.qecScoreAdj),
    adjustedScore: adjustedPct != null ? String(adjustedPct) : "",
    ratingO: formatRatingO(row),
    calibrationFactor: asText(row.calibrationFactor),
    hrApprovalStatus: formatHrActions(row),
    normalizedScore: normalizedPct != null ? String(normalizedPct) : "",
    performanceMatrixAssignment: row.assignedPerformanceMatrix ?? "",
    ratingN: canResolvePerformanceRating(row)
      ? (row.performanceLevelName ?? asText(row.ratingN))
      : "",
    quartile: row.quartileName ?? "",
    remarksEvaluation: row.remarksEvaluation ?? "",
    currentSalary: asText(row.currentSalary),
    previousSalary: asText(row.previousSalary),
    salaryDiff,
    applicableSalaryForIncrement: asText(getApplicableSalary(row)),
    applicableMatrix: row.applicableMatrix ?? "",
    applicableIncrementPercent: asText(row.applicableIncrementPercent),
    incrementPerMatrix: asText(getIncrementPerMatrix(row)),
    incrementAdjusted: asText(getIncrementAdjusted(row)),
    revisedSalary: asText(getRevisedSalary(row)),
    revisedSalaryRo: asText(getRevisedSalaryRo(row)),
    remarksCompensation: row.remarksCompensation ?? "",
    hodReviewComments: row.hodReviewComments ?? "",
  };
}
