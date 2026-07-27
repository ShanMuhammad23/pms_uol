import "server-only";

import { computeAppraisalEligibility, resolveReferenceEndDate } from "@/lib/appraisal-eligibility";
import { db } from "@/lib/db";
import { getDefaultAppraisalCycle } from "@/lib/queries/appraisal-cycles";
import { appendStaffVisibilityClause } from "@/lib/queries/staff-list-scope";
import type { StaffListScope } from "@/lib/queries/staff-list-scope";
import { ensureManager2Column } from "@/lib/queries/users";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { AppraisalStatus, PerformanceRating } from "@/types/forms";

type EligibilityStatus = "Fully Eligible" | "Partially Eligible" | "Not Eligible";

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
  manager_1_user_id: string | null;
  manager_2_user_id: string | null;
  initial_rating: PerformanceRating | null;
  calibrated_rating: PerformanceRating | null;
  normalized_score: string | null;
  uol_experience_years: string | null;
  is_eligible: boolean | null;
  eligibility_status: EligibilityStatus | null;
  applicable_duration: string | null;
  applicable_duration_factor: string | null;
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

async function ensureEligibilityColumns(): Promise<void> {
  await db.query(
    `ALTER TABLE appraisals
     ADD COLUMN IF NOT EXISTS eligibility_status VARCHAR(30),
     ADD COLUMN IF NOT EXISTS applicable_duration_factor NUMERIC(3, 1)`,
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

  // Eligibility is FY-scoped only (30 Jun of active financial year).
  const financialYear =
    financialYearResult.rows[0]?.year ?? cycleResult?.fiscalYear ?? null;
  const referenceEndDate = resolveReferenceEndDate({ financialYear });

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
  const computed = computeAppraisalEligibility(row.date_of_joining, {
    financialYear: eligibilityContext.financialYear,
  });
  const storedFactor = toNumber(row.applicable_duration_factor);

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
    manager1UserId: row.manager_1_user_id
      ? Number(row.manager_1_user_id)
      : null,
    manager2UserId: row.manager_2_user_id
      ? Number(row.manager_2_user_id)
      : null,
    rawScore: 0,
    maxRawScore: 0,
    scorePercent: 0,
    scoreO: null,
    ratingO: row.initial_rating,
    creditHrsErpScoreAdj: null,
    pubOricScoreAdj: null,
    qecScoreAdj: null,
    calibrationFactor: null,
    normalizedScore: toNumber(row.normalized_score),
    ratingN: row.calibrated_rating,
    performanceLevelName: null,
    quartileName: null,
    initialRating: row.initial_rating,
    calibratedRating: row.calibrated_rating,
    uolExperienceYears:
      toNumber(row.uol_experience_years) ?? computed.uolExperienceYears,
    isEligible: row.is_eligible ?? computed.isEligible,
    applicableDuration: row.applicable_duration ?? computed.applicableDuration,
    applicableDurationFactor: storedFactor ?? computed.applicableDurationFactor,
    eligibilityStatus: row.eligibility_status ?? computed.status,
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
    selfAssessmentEnabled: true,
  };
}

/**
 * Lightweight staff rows for dashboard filters, workflow stats, and charts.
 * Omits salary, qualifications, form-assignment, and score subqueries.
 */
export async function listDashboardOverview(
  options?: StaffListScope,
): Promise<FormSubmissionListItem[]> {
  const [excelReady, roleCategoryReady, eligibilityContext] = await Promise.all([
    hasExcelSheetColumns(),
    hasRoleCategoryColumn(),
    getEligibilityContext(),
    ensureManagerLevelColumn(),
    ensureEligibilityColumns(),
    ensureManager2Column(),
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
    ? `ap.normalized_score::text,`
    : `NULL::text AS normalized_score,`;
  const eligibilitySelect = excelReady
    ? `ap.uol_experience_years::text,
       ap.is_eligible,
       ap.eligibility_status,
       ap.applicable_duration,
       ap.applicable_duration_factor::text`
    : `NULL::text AS uol_experience_years,
       NULL::boolean AS is_eligible,
       NULL::text AS eligibility_status,
       NULL::text AS applicable_duration,
       NULL::text AS applicable_duration_factor`;

  const scoped = appendStaffVisibilityClause(options);

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
       u.head_id::text AS manager_1_user_id,
       u.manager_2_id::text AS manager_2_user_id,
       ap.initial_rating,
       ap.calibrated_rating,
       ${normalizedScoreSelect}
       ${eligibilitySelect}
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
       ${scoped.clause}
     ORDER BY u.first_name, u.last_name, u.employee_id`,
    [eligibilityContext.cycleId, ...scoped.params],
  );

  return result.rows.map((row) =>
    mapOverviewRow(row, {
      financialYear: eligibilityContext.financialYear,
      cycleEndDate: eligibilityContext.cycleEndDate,
    }),
  );
}
