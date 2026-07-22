import "server-only";

import { computeAppraisalEligibility, resolveReferenceEndDate } from "@/lib/appraisal-eligibility";
import { db } from "@/lib/db";
import { getDefaultAppraisalCycle } from "@/lib/queries/appraisal-cycles";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { AppraisalStatus, PerformanceRating } from "@/types/forms";

interface OverviewRow {
  id: string | null;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  designation: string | null;
  role_category: string | null;
  date_of_joining: string | null;
  entity_id: string | null;
  parent_entity_name: string | null;
  status: AppraisalStatus;
  manager_level: number | null;
  initial_rating: PerformanceRating | null;
  calibrated_rating: PerformanceRating | null;
  normalized_score: string | null;
}

async function hasExcelSheetColumns(): Promise<boolean> {
  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'users'
         AND column_name = 'designation'
     ) AS exists`,
  );

  return Boolean(result.rows[0]?.exists);
}

async function hasRoleCategoryColumn(): Promise<boolean> {
  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'users'
         AND column_name = 'role_category'
     ) AS exists`,
  );

  return Boolean(result.rows[0]?.exists);
}

async function ensureManagerLevelColumn(): Promise<void> {
  await db.query(
    `ALTER TABLE appraisals
     ADD COLUMN IF NOT EXISTS manager_level INT NOT NULL DEFAULT 1`,
  );
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatReferenceDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function getEligibilityContext(): Promise<{
  cycleId: number | null;
  financialYear: number | null;
  cycleEndDate: string | null;
}> {
  const [cycleResult, financialYearResult] = await Promise.all([
    getDefaultAppraisalCycle(),
    db.query<{ year: number }>(
      `SELECT year
       FROM financial_years
       WHERE is_active = TRUE
       ORDER BY year DESC
       LIMIT 1`,
    ),
  ]);

  const financialYear =
    financialYearResult.rows[0]?.year ?? cycleResult?.fiscalYear ?? null;
  const referenceEndDate = resolveReferenceEndDate({
    financialYear,
    cycleEndDate: cycleResult?.endDate ?? null,
  });

  return {
    cycleId: cycleResult?.id ?? null,
    financialYear,
    cycleEndDate: formatReferenceDate(referenceEndDate),
  };
}

function mapOverviewRow(
  row: OverviewRow,
  eligibilityContext: {
    financialYear: number | null;
    cycleEndDate: string | null;
  },
): FormSubmissionListItem {
  const eligibility = computeAppraisalEligibility(row.date_of_joining, {
    financialYear: eligibilityContext.financialYear,
    cycleEndDate: eligibilityContext.cycleEndDate,
  });

  return {
    id: row.id ? Number(row.id) : 0,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeEmail: row.employee_email,
    designation: row.designation,
    roleCategory: row.role_category,
    gradeGroup: null,
    dateOfJoining: row.date_of_joining,
    empCategory: null,
    empSubCategory: null,
    templateId: null,
    templateTitle: null,
    formAssigned: false,
    entityId: row.entity_id ? Number(row.entity_id) : null,
    entityName: null,
    parentEntityName: row.parent_entity_name,
    orgLevel1Name: null,
    orgLevel2Name: null,
    status: row.status,
    managerLevel: row.manager_level != null ? Number(row.manager_level) : null,
    rawScore: 0,
    maxRawScore: 0,
    scorePercent: 0,
    scoreO: null,
    ratingO: row.initial_rating,
    creditHrsErpScoreAdj: null,
    pubOricScoreAdj: null,
    calibrationFactor: null,
    normalizedScore: toNumber(row.normalized_score),
    ratingN: row.calibrated_rating,
    performanceLevelName: null,
    quartileName: null,
    initialRating: row.initial_rating,
    calibratedRating: row.calibrated_rating,
    uolExperienceYears: eligibility.uolExperienceYears,
    isEligible: eligibility.isEligible,
    applicableDuration: eligibility.applicableDuration,
    applicableDurationFactor: eligibility.applicableDurationFactor,
    eligibilityStatus: eligibility.status,
    eligibilityReferenceYear: eligibilityContext.financialYear,
    eligibilityReferenceEndDate: eligibilityContext.cycleEndDate,
    remarksEvaluation: null,
    currentSalary: null,
    previousSalary: null,
    applicableSalaryForIncrement: null,
    applicableMatrix: null,
    applicableIncrementPercent: null,
    incrementPerMatrix: null,
    incrementAdjusted: null,
    revisedSalary: null,
    revisedSalaryRo: null,
    hodReviewComments: null,
    remarksCompensation: null,
    qualification: null,
    qualificationYear: null,
    qualificationSubject: null,
    qualificationInstitute: null,
    qualificationCountry: null,
    submittedAt: null,
  };
}

/**
 * Lightweight staff rows for dashboard filters, workflow stats, and charts.
 * Omits salary, qualifications, form-assignment, and score subqueries.
 */
export async function listDashboardOverview(options?: {
  scopedEntityIds?: number[];
}): Promise<FormSubmissionListItem[]> {
  const [excelReady, roleCategoryReady, eligibilityContext] = await Promise.all([
    hasExcelSheetColumns(),
    hasRoleCategoryColumn(),
    getEligibilityContext(),
    ensureManagerLevelColumn(),
  ]);

  const designationSelect = excelReady
    ? `u.designation,`
    : `NULL::text AS designation,`;
  const roleCategorySelect = roleCategoryReady
    ? `u.role_category,`
    : `NULL::text AS role_category,`;
  const dateOfJoiningSelect = excelReady
    ? `u.date_of_joining::text,`
    : `NULL::text AS date_of_joining,`;
  const normalizedScoreSelect = excelReady
    ? `ap.normalized_score::text`
    : `NULL::text AS normalized_score`;

  const scopedEntityIds = options?.scopedEntityIds ?? null;
  const entityScopeClause =
    scopedEntityIds && scopedEntityIds.length > 0
      ? `AND u.entity_id = ANY($2::bigint[])`
      : scopedEntityIds && scopedEntityIds.length === 0
        ? `AND FALSE`
        : "";

  const result = await db.query<OverviewRow>(
    `SELECT
       ap.id,
       u.employee_id,
       CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
       u.email AS employee_email,
       ${designationSelect}
       ${roleCategorySelect}
       ${dateOfJoiningSelect}
       u.entity_id,
       p1.name AS parent_entity_name,
       COALESCE(ap.status, 'PENDING_SELF_ASSESSMENT') AS status,
       ap.manager_level,
       ap.initial_rating,
       ap.calibrated_rating,
       ${normalizedScoreSelect}
     FROM users u
     LEFT JOIN LATERAL (
       SELECT ap_inner.*
       FROM appraisals ap_inner
       WHERE ap_inner.employee_id = u.id
         AND (
           ap_inner.cycle_id = $1
           OR ($1::int IS NULL AND ap_inner.cycle_id IS NULL)
         )
       ORDER BY ap_inner.updated_at DESC NULLS LAST, ap_inner.id DESC
       LIMIT 1
     ) ap ON TRUE
     LEFT JOIN entities ent ON ent.id = u.entity_id
     LEFT JOIN entities p1 ON p1.id = ent.parent_entity_id
     WHERE u.is_active = TRUE
       AND u.employee_id <> 'EMP-0001'
       ${entityScopeClause}
     ORDER BY u.first_name, u.last_name, u.employee_id`,
    scopedEntityIds && scopedEntityIds.length > 0
      ? [eligibilityContext.cycleId, scopedEntityIds]
      : [eligibilityContext.cycleId],
  );

  return result.rows.map((row) =>
    mapOverviewRow(row, {
      financialYear: eligibilityContext.financialYear,
      cycleEndDate: eligibilityContext.cycleEndDate,
    }),
  );
}
