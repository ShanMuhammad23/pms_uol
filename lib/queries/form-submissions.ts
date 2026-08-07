import "server-only";

import { computeAppraisalEligibility, resolveReferenceEndDate } from "@/lib/appraisal-eligibility";
import { db } from "@/lib/db";
import { getDefaultAppraisalCycle } from "@/lib/queries/appraisal-cycles";
import {
  calculateScorePercent,
  getActiveFinancialYearQuartileBands,
  resolveSubmissionPerformanceQuartile,
} from "@/lib/queries/performance-rating";
import { getFormTemplateById } from "@/lib/queries/forms";
import { listAttachmentsForAppraisal } from "@/lib/queries/employee-forms";
import { isScoredQuestion } from "@/app/helpers/form-questions";
import type {
  EmployeeFormAnswerAttachment,
  EmployeeFormAnswerRecord,
} from "@/types/employee-forms";
import type { ManagerReviewAnswerInput } from "@/types/employee-forms";
import type {
  FormSubmissionDetail,
  FormSubmissionListItem,
} from "@/types/form-submissions";
import type { AppraisalStatus, PerformanceRating, QuestionRecord } from "@/types/forms";
import { flattenAllQuestions } from "@/types/forms";
import {
  resolveManagerApprovalAdvance,
  toEmployeeManagers,
} from "@/app/helpers/manager-review";
import { appendStaffVisibilityClause } from "@/lib/queries/staff-list-scope";
import { assertManagerEligible, ensureManager2Column } from "@/lib/queries/users";
import type { StaffListScope } from "@/lib/queries/staff-list-scope";

export class FormSubmissionError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "FormSubmissionError";
  }
}

interface SubmissionListRow {
  id: string | null;
  employee_user_id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  designation: string | null;
  role_category: string | null;
  date_of_joining: string | null;
  emp_category: string | null;
  emp_sub_category: string | null;
  template_id: number | null;
  template_title: string | null;
  entity_id: string | null;
  entity_name: string | null;
  parent_entity_name: string | null;
  org_level_1_name: string | null;
  org_level_2_name: string | null;
  status: AppraisalStatus;
  manager_level: number | null;
  manager_1_user_id: string | null;
  manager_2_user_id: string | null;
  system_raw_score: string;
  max_raw_score: string;
  initial_score_numeric: string | null;
  manager_1_score: string | null;
  manager_2_score: string | null;
  initial_rating: PerformanceRating | null;
  credit_hrs_erp_score_adj: string | null;
  pub_oric_score_adj: string | null;
  qec_score_adj: string | null;
  calibration_factor: string | null;
  normalized_score: string | null;
  calibrated_score_numeric: string | null;
  calibrated_rating: PerformanceRating | null;
  stored_quartile_name: string | null;
  uol_experience_years: string | null;
  is_eligible: boolean | null;
  eligibility_status: "Fully Eligible" | "Partially Eligible" | "Not Eligible" | null;
  applicable_duration: string | null;
  applicable_duration_factor: string | null;
  remarks_evaluation: string | null;
  hr_approval_status: string | null;
  manager1_overall_remarks: string | null;
  manager2_overall_remarks: string | null;
  current_salary: string | null;
  previous_salary: string | null;
  applicable_salary_for_increment: string | null;
  applicable_matrix: string | null;
  calculated_increment_percentage: string | null;
  increment_per_matrix: string | null;
  approved_increment_percentage: string | null;
  revised_salary: string | null;
  revised_salary_ro: string | null;
  hod_review_comments: string | null;
  remarks_compensation: string | null;
  qualification: string | null;
  qualification_year: number | null;
  qualification_subject: string | null;
  qualification_institute: string | null;
  qualification_country: string | null;
  submitted_at: string | null;
  form_assigned: boolean;
  direct_score_entry: boolean;
  self_assessment_disabled: boolean;
  assessment_eligibility: boolean | null;
  ineligibility_reason: string | null;
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

async function hasQualificationsTable(): Promise<boolean> {
  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = 'employee_qualifications'
     ) AS exists`,
  );

  return Boolean(result.rows[0]?.exists);
}

async function hasAssessmentEligibilityColumn(): Promise<boolean> {
  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'users'
         AND column_name = 'assessment_eligibility'
     ) AS exists`,
  );

  return Boolean(result.rows[0]?.exists);
}

async function ensureAssessmentEligibilityColumn(): Promise<void> {
  await db.query(
    `ALTER TABLE users
     ADD COLUMN IF NOT EXISTS assessment_eligibility BOOLEAN NOT NULL DEFAULT TRUE`,
  );
  await db.query(
    `ALTER TABLE users
     ADD COLUMN IF NOT EXISTS ineligibility_reason TEXT`,
  );
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getAnswersForSubmission(
  appraisalId: number,
  filledById: number,
): Promise<EmployeeFormAnswerRecord[]> {
  await db.query(
    `ALTER TABLE appraisal_answers ADD COLUMN IF NOT EXISTS remarks TEXT`,
  );

  const result = await db.query<{
    question_id: string;
    text_response: string | null;
    selected_option_id: string | null;
    points_earned: string;
    remarks: string | null;
  }>(
    `SELECT question_id, text_response, selected_option_id, points_earned, remarks
     FROM appraisal_answers
     WHERE appraisal_id = $1
       AND filled_by_id = $2`,
    [appraisalId, filledById],
  );

  // Load attachments uploaded by this contributor (e.g. the employee) and group
  // them per question so every reviewer role sees the same attachment collection.
  const attachments = await listAttachmentsForAppraisal(appraisalId, filledById);
  const attachmentsByQuestion = new Map<number, EmployeeFormAnswerAttachment[]>();
  for (const attachment of attachments) {
    const current = attachmentsByQuestion.get(attachment.questionId) ?? [];
    current.push(attachment);
    attachmentsByQuestion.set(attachment.questionId, current);
  }

  return result.rows.map((row) => {
    const questionId = Number(row.question_id);
    return {
      questionId,
      textResponse: row.text_response,
      selectedOptionId: row.selected_option_id
        ? Number(row.selected_option_id)
        : null,
      pointsEarned: Number(row.points_earned),
      remarks: row.remarks ?? null,
      attachments: attachmentsByQuestion.get(questionId) ?? [],
    };
  });
}

function mapSubmissionRow(
  row: SubmissionListRow,
  quartileBands: Awaited<ReturnType<typeof getActiveFinancialYearQuartileBands>>,
  eligibilityContext: {
    financialYear: number | null;
    cycleEndDate: string | null;
  },
): FormSubmissionListItem {
  const rawScore = toNumber(row.system_raw_score) ?? 0;
  const maxRawScore = Number(row.max_raw_score);
  const scorePercent = calculateScorePercent(rawScore, maxRawScore);
  const hasAppraisal = Boolean(row.id);
  const scoreO = toNumber(row.initial_score_numeric) ?? rawScore;
  const normalizedScore =
    toNumber(row.normalized_score) ?? toNumber(row.calibrated_score_numeric);

  // Build a partial submission-like object for the shared resolver.
  // The performance level and quartile must be resolved from the
  // NORMALIZED score percentage (Score O + adjustments + calibration
  // factor), NOT the raw self-assessment score percentage. Using the raw
  // score % here was the root cause of the matrix not matching the Staff
  // Listing — the persisted performanceLevelName/quartileName were based
  // on the self-assessment score, while the dashboard matrix used the
  // normalized score.
  const resolved = hasAppraisal
    ? resolveSubmissionPerformanceQuartile(
        {
          scoreO,
          rawScore,
          creditHrsErpScoreAdj: toNumber(row.credit_hrs_erp_score_adj),
          pubOricScoreAdj: toNumber(row.pub_oric_score_adj),
          qecScoreAdj: toNumber(row.qec_score_adj),
          calibrationFactor: toNumber(row.calibration_factor),
          maxRawScore,
        },
        quartileBands,
      )
    : null;

  // Prefer FY-scoped values stored on the appraisal; compute only as fallback.
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
    dateOfJoining: row.date_of_joining,
    empCategory: row.emp_category,
    empSubCategory: row.emp_sub_category,
    templateId: row.template_id,
    templateTitle: row.template_title,
    formAssigned: Boolean(row.form_assigned),
    directScoreEntry: Boolean(row.direct_score_entry),
    entityId: row.entity_id ? Number(row.entity_id) : null,
    entityName: row.entity_name,
    parentEntityName: row.parent_entity_name,
    orgLevel1Name: row.org_level_1_name,
    orgLevel2Name: row.org_level_2_name,
    status: row.status,
    managerLevel: row.manager_level != null ? Number(row.manager_level) : null,
    employeeUserId: row.employee_user_id ? Number(row.employee_user_id) : null,
    manager1UserId: row.manager_1_user_id
      ? Number(row.manager_1_user_id)
      : null,
    manager2UserId: row.manager_2_user_id
      ? Number(row.manager_2_user_id)
      : null,
    rawScore,
    maxRawScore,
    scorePercent,
    scoreO,
    manager1Score: toNumber(row.manager_1_score),
    manager2Score: toNumber(row.manager_2_score),
    ratingO: row.initial_rating,
    creditHrsErpScoreAdj: toNumber(row.credit_hrs_erp_score_adj),
    pubOricScoreAdj: toNumber(row.pub_oric_score_adj),
    qecScoreAdj: toNumber(row.qec_score_adj),
    calibrationFactor: toNumber(row.calibration_factor),
    normalizedScore,
    ratingN: row.calibrated_rating,
    performanceLevelName: resolved?.performanceLevelName ?? null,
    quartileName: row.stored_quartile_name ?? resolved?.quartileName ?? null,
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
    remarksEvaluation: row.remarks_evaluation,
    hrApprovalStatus: (row.hr_approval_status as "pending" | "approved" | "review_required" | null) ?? null,
    manager1OverallRemarks: row.manager1_overall_remarks,
    manager2OverallRemarks: row.manager2_overall_remarks,
    currentSalary: toNumber(row.current_salary),
    previousSalary: toNumber(row.previous_salary),
    applicableSalaryForIncrement: toNumber(row.applicable_salary_for_increment),
    applicableMatrix: row.applicable_matrix,
    applicableIncrementPercent: toNumber(row.calculated_increment_percentage),
    incrementPerMatrix: toNumber(row.increment_per_matrix),
    incrementAdjusted: toNumber(row.approved_increment_percentage),
    revisedSalary: toNumber(row.revised_salary),
    revisedSalaryRo: toNumber(row.revised_salary_ro),
    hodReviewComments: row.hod_review_comments,
    remarksCompensation: row.remarks_compensation,
    qualification: row.qualification,
    qualificationYear: row.qualification_year,
    qualificationSubject: row.qualification_subject,
    qualificationInstitute: row.qualification_institute,
    qualificationCountry: row.qualification_country,
    submittedAt: row.submitted_at,
    selfAssessmentEnabled: !row.self_assessment_disabled,
    assessmentEligibility: row.assessment_eligibility ?? true,
    ineligibilityReason: row.ineligibility_reason ?? null,
  };
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
  const financialYear = financialYearResult.rows[0]?.year ?? cycleResult?.fiscalYear ?? null;
  const referenceEndDate = resolveReferenceEndDate({ financialYear });

  return {
    cycleId: cycleResult?.id ?? null,
    financialYear,
    cycleEndDate: formatReferenceDate(referenceEndDate),
  };
}

async function ensureEligibilityColumns(): Promise<void> {
  await db.query(
    `ALTER TABLE appraisals
     ADD COLUMN IF NOT EXISTS eligibility_status VARCHAR(30),
     ADD COLUMN IF NOT EXISTS applicable_duration_factor NUMERIC(3, 1)`,
  );
}

async function ensureHrApprovalStatusColumn(): Promise<void> {
  await db.query(
    `ALTER TABLE appraisals
     ADD COLUMN IF NOT EXISTS hr_approval_status VARCHAR(20) DEFAULT 'pending'`,
  );
}

async function ensureOverallRemarksColumns(): Promise<void> {
  await db.query(
    `ALTER TABLE appraisals
     ADD COLUMN IF NOT EXISTS manager1_overall_remarks TEXT,
     ADD COLUMN IF NOT EXISTS manager2_overall_remarks TEXT`,
  );
  await db.query(
    `ALTER TABLE form_templates
     ADD COLUMN IF NOT EXISTS additional_remarks_enabled BOOLEAN NOT NULL DEFAULT FALSE`,
  );
}

function formatReferenceDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function listFormSubmissions(
  options?: StaffListScope,
): Promise<FormSubmissionListItem[]> {
  const [
    excelReady,
    roleCategoryReady,
    qualsReady,
    quartileBands,
    eligibilityContext,
  ] = await Promise.all([
    hasExcelSheetColumns(),
    hasRoleCategoryColumn(),
    hasQualificationsTable(),
    getActiveFinancialYearQuartileBands(),
    getEligibilityContext(),
    ensureManagerLevelColumn(),
    ensureEligibilityColumns(),
    ensureManager2Column(),
    ensureAssessmentEligibilityColumn(),
    ensureHrApprovalStatusColumn(),
    ensureOverallRemarksColumns(),
  ]);

  const roleCategorySelect = roleCategoryReady
    ? `u.role_category,`
    : `NULL::text AS role_category,`;

  const excelSelect = excelReady
    ? `
         u.designation,
         ${roleCategorySelect}
         u.date_of_joining::text,
         u.emp_category::text AS emp_category,
         u.emp_sub_category::text AS emp_sub_category,
         ap.initial_score_numeric::text,
         ap.credit_hrs_erp_score_adj::text,
         ap.pub_oric_score_adj::text,
         ap.qec_score_adj::text,
         ap.calibration_factor::text,
         ap.normalized_score::text,
         ap.calibrated_score_numeric::text,
         pq.name AS stored_quartile_name,
         ap.uol_experience_years::text,
         ap.is_eligible,
         ap.eligibility_status,
         ap.applicable_duration,
         ap.applicable_duration_factor::text,
         ap.remarks_evaluation,
         ap.hr_approval_status,
         ap.manager1_overall_remarks,
         ap.manager2_overall_remarks,
         ap.current_salary::text,
         ap.previous_salary::text,
         ap.applicable_salary_for_increment::text,
         ap.applicable_matrix,
         ap.calculated_increment_percentage::text,
         ap.increment_per_matrix::text,
         ap.approved_increment_percentage::text,
         ap.revised_salary::text,
         ap.revised_salary_ro::text,
         COALESCE(NULLIF(ap.manager2_overall_remarks, ''), ap.manager1_overall_remarks) AS hod_review_comments,
         ap.remarks_compensation,
    `
    : `
         NULL::text AS designation,
         ${roleCategorySelect}
         NULL::text AS date_of_joining,
         u.emp_category::text AS emp_category,
         u.emp_sub_category::text AS emp_sub_category,
         NULL::text AS initial_score_numeric,
         NULL::text AS credit_hrs_erp_score_adj,
         NULL::text AS pub_oric_score_adj,
         NULL::text AS qec_score_adj,
         NULL::text AS calibration_factor,
         NULL::text AS normalized_score,
         NULL::text AS calibrated_score_numeric,
         NULL::text AS stored_quartile_name,
         NULL::text AS uol_experience_years,
         NULL::boolean AS is_eligible,
         NULL::text AS eligibility_status,
         NULL::text AS applicable_duration,
         NULL::text AS applicable_duration_factor,
         NULL::text AS remarks_evaluation,
         NULL::text AS hr_approval_status,
         NULL::text AS manager1_overall_remarks,
         NULL::text AS manager2_overall_remarks,
         NULL::text AS current_salary,
         NULL::text AS previous_salary,
         NULL::text AS applicable_salary_for_increment,
         NULL::text AS applicable_matrix,
         ap.calculated_increment_percentage::text,
         NULL::text AS increment_per_matrix,
         ap.approved_increment_percentage::text,
         NULL::text AS revised_salary,
         NULL::text AS revised_salary_ro,
         NULL::text AS hod_review_comments,
         NULL::text AS remarks_compensation,
    `;

  const qualSelect = qualsReady
    ? `
         qual.qualification,
         qual.year AS qualification_year,
         qual.subject AS qualification_subject,
         qual.institute AS qualification_institute,
         qual.country AS qualification_country,
    `
    : `
         NULL::text AS qualification,
         NULL::int AS qualification_year,
         NULL::text AS qualification_subject,
         NULL::text AS qualification_institute,
         NULL::text AS qualification_country,
    `;

  const qualJoin = qualsReady
    ? `
       LEFT JOIN LATERAL (
         SELECT eq.qualification, eq.year, eq.subject, eq.institute, eq.country
         FROM employee_qualifications eq
         WHERE eq.user_id = u.id
         ORDER BY eq.is_primary DESC, eq.year DESC NULLS LAST, eq.id DESC
         LIMIT 1
       ) qual ON TRUE
    `
    : "";

  const quartileJoin = excelReady
    ? `LEFT JOIN performance_quartiles pq ON pq.id = ap.performance_quartile_id`
    : "";

  const scoped = appendStaffVisibilityClause(options);

  const result = await db.query<SubmissionListRow>(
    `SELECT
       ap.id,
       u.id::text AS employee_user_id,
       u.employee_id,
       CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
       u.email AS employee_email,
       ${excelSelect}
       ${qualSelect}
       ap.template_id,
       ft.title AS template_title,
       (
         EXISTS (
           SELECT 1
           FROM employee_form_assignments efa
           INNER JOIN form_templates efa_ft ON efa_ft.id = efa.template_id
           WHERE efa.employee_id = u.id
             AND (
               $1::int IS NULL
               OR efa_ft.cycle_id = $1
             )
         )
       ) AS form_assigned,
       (
         EXISTS (
           SELECT 1
           FROM direct_score_entry_assignments dsea
           WHERE dsea.employee_id = u.id
             AND (
               $1::int IS NULL
               OR dsea.cycle_id = $1
             )
         )
       ) AS direct_score_entry,
       u.entity_id,
       ent.name AS entity_name,
       p1.name AS parent_entity_name,
       CASE
         WHEN ent_cat.code = 'C1' THEN ent.name
         WHEN p1_cat.code = 'C1' THEN p1.name
         WHEN p2_cat.code = 'C1' THEN p2.name
         WHEN p3_cat.code = 'C1' THEN p3.name
         ELSE NULL
       END AS org_level_1_name,
       CASE
         WHEN ent_cat.code = 'C2' THEN ent.name
         WHEN p1_cat.code = 'C2' THEN p1.name
         WHEN p2_cat.code = 'C2' THEN p2.name
         WHEN p3_cat.code = 'C2' THEN p3.name
         ELSE NULL
       END AS org_level_2_name,
       COALESCE(ap.status, 'PENDING_SELF_ASSESSMENT') AS status,
       ap.manager_level,
       u.head_id::text AS manager_1_user_id,
       u.manager_2_id::text AS manager_2_user_id,
       COALESCE(ap.system_raw_score, 0) AS system_raw_score,
       ap.initial_rating,
       ap.calibrated_rating,
       (
         SELECT SUM(aa.points_earned)::text
         FROM appraisal_answers aa
         WHERE aa.appraisal_id = ap.id
           AND aa.filled_by_id = u.head_id
       ) AS manager_1_score,
       (
         SELECT SUM(aa.points_earned)::text
         FROM appraisal_answers aa
         WHERE aa.appraisal_id = ap.id
           AND aa.filled_by_id = u.manager_2_id
       ) AS manager_2_score,
       COALESCE(
         (
           SELECT SUM(fq.total_marks)::text
           FROM form_questions fq
           WHERE fq.template_id = ap.template_id
             AND fq.total_marks > 0
         ),
         '0'
       ) AS max_raw_score,
       ap.submitted_at::text,
       COALESCE(efa.self_assessment_disabled, false) AS self_assessment_disabled,
      COALESCE(u.assessment_eligibility, true) AS assessment_eligibility
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
     LEFT JOIN form_templates ft ON ft.id = ap.template_id
     LEFT JOIN employee_form_assignments efa ON efa.employee_id = u.id AND efa.template_id = ap.template_id
     LEFT JOIN entities ent ON ent.id = u.entity_id
     LEFT JOIN entity_categories ent_cat ON ent_cat.id = ent.entity_category_id
     LEFT JOIN entities p1 ON p1.id = ent.parent_entity_id
     LEFT JOIN entity_categories p1_cat ON p1_cat.id = p1.entity_category_id
     LEFT JOIN entities p2 ON p2.id = p1.parent_entity_id
     LEFT JOIN entity_categories p2_cat ON p2_cat.id = p2.entity_category_id
     LEFT JOIN entities p3 ON p3.id = p2.parent_entity_id
     LEFT JOIN entity_categories p3_cat ON p3_cat.id = p3.entity_category_id
     ${quartileJoin}
     ${qualJoin}
     WHERE u.is_active = TRUE
       AND u.employee_id <> 'EMP-0001'
       ${scoped.clause}
     ORDER BY u.first_name, u.last_name, u.employee_id`,
    [eligibilityContext.cycleId, ...scoped.params],
  );

  return result.rows.map((row) =>
    mapSubmissionRow(row, quartileBands, {
      financialYear: eligibilityContext.financialYear,
      cycleEndDate: eligibilityContext.cycleEndDate,
    }),
  );
}

export async function getFormSubmissionSummaryById(
  id: number,
): Promise<
  Pick<
    FormSubmissionListItem,
    | "id"
    | "entityId"
    | "status"
    | "managerLevel"
    | "manager1UserId"
    | "manager2UserId"
    | "assessmentEligibility"
    | "ineligibilityReason"
  > | null
> {
  await ensureManager2Column();
  await ensureAssessmentEligibilityColumn();

  const result = await db.query<{
    id: string;
    entity_id: string | null;
    status: AppraisalStatus;
    manager_level: number | null;
    manager_1_user_id: string | null;
    manager_2_user_id: string | null;
    assessment_eligibility: boolean | null;
    ineligibility_reason: string | null;
  }>(
    `SELECT ap.id,
            u.entity_id,
            ap.status,
            ap.manager_level,
            u.head_id::text AS manager_1_user_id,
            u.manager_2_id::text AS manager_2_user_id,
            COALESCE(u.assessment_eligibility, true) AS assessment_eligibility,
      u.ineligibility_reason
     FROM appraisals ap
     INNER JOIN users u ON u.id = ap.employee_id
     WHERE ap.id = $1
     LIMIT 1`,
    [id],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    entityId: row.entity_id ? Number(row.entity_id) : null,
    status: row.status,
    managerLevel: row.manager_level != null ? Number(row.manager_level) : null,
    manager1UserId: row.manager_1_user_id
      ? Number(row.manager_1_user_id)
      : null,
    manager2UserId: row.manager_2_user_id
      ? Number(row.manager_2_user_id)
      : null,
    assessmentEligibility: row.assessment_eligibility ?? true,
    ineligibilityReason: row.ineligibility_reason ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Bulk Review Queue                                                           */
/* -------------------------------------------------------------------------- */

export interface BulkReviewQueueItem {
  id: number;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  designation: string | null;
  entityId: number | null;
  entityName: string | null;
  parentEntityName: string | null;
  orgLevel1Name: string | null;
  orgLevel2Name: string | null;
  templateId: number | null;
  templateTitle: string | null;
  status: AppraisalStatus;
  managerLevel: number | null;
  manager1UserId: number | null;
  manager2UserId: number | null;
  submittedAt: string | null;
  selfAssessmentEnabled: boolean;
  assessmentEligibility: boolean;
}

/**
 * Returns submissions pending review by the given manager user ID.
 * Reuses `listFormSubmissions` (which already enforces staff visibility)
 * and filters in-memory for `PENDING_HEAD_REVIEW` where the viewer is the
 * assigned manager at the current manager_level.
 */
export async function listBulkReviewQueue(
  reviewerUserId: number,
): Promise<BulkReviewQueueItem[]> {
  const submissions = await listFormSubmissions({
    managedByUserId: reviewerUserId,
  });

  return submissions
    .filter((s) => s.status === "PENDING_HEAD_REVIEW")
    .filter((s) =>
      isAssignedManagerAtLevelInline(reviewerUserId, s, s.managerLevel ?? 1),
    )
    .filter((s) => s.assessmentEligibility)
    .map((s) => ({
      id: s.id,
      employeeId: s.employeeId,
      employeeName: s.employeeName,
      employeeEmail: s.employeeEmail,
      designation: s.designation,
      entityId: s.entityId,
      entityName: s.entityName,
      parentEntityName: s.parentEntityName,
      orgLevel1Name: s.orgLevel1Name,
      orgLevel2Name: s.orgLevel2Name,
      templateId: s.templateId,
      templateTitle: s.templateTitle,
      status: s.status,
      managerLevel: s.managerLevel,
      manager1UserId: s.manager1UserId ?? null,
      manager2UserId: s.manager2UserId ?? null,
      submittedAt: s.submittedAt,
      selfAssessmentEnabled: s.selfAssessmentEnabled,
      assessmentEligibility: s.assessmentEligibility,
    }));
}

/** Inline version to avoid a circular import with manager-review helper. */
function isAssignedManagerAtLevelInline(
  reviewerUserId: number,
  submission: Pick<FormSubmissionListItem, "manager1UserId" | "manager2UserId">,
  managerLevel: number,
): boolean {
  const m1 = submission.manager1UserId ?? null;
  const m2 = submission.manager2UserId ?? null;
  const assigned = managerLevel <= 1 ? m1 : m2;
  return assigned != null && assigned === reviewerUserId;
}

/* -------------------------------------------------------------------------- */
/* Bulk Review Question Data                                                   */
/* -------------------------------------------------------------------------- */

export interface BulkReviewQuestionRow {
  submissionId: number;
  employeeId: string;
  employeeName: string;
  /** Self-assessment score for this question (null when self-assessment disabled). */
  selfScore: number | null;
  /** Self-assessment remarks for this question (used as draft fallback). */
  selfRemarks: string | null;
  /** Current manager's saved score for this question. */
  managerScore: number | null;
  /** Current manager's saved remarks for this question. */
  managerRemarks: string | null;
  /** Manager 1's saved score (used as fallback for Manager 2 drafts). */
  manager1Score: number | null;
  /** Manager 1's saved remarks (used as fallback for Manager 2 drafts). */
  manager1Remarks: string | null;
}

export interface BulkReviewQuestionData {
  questionId: number;
  questionText: string;
  totalMarks: number;
  isRequired: boolean;
  sectionTitle: string | null;
  rows: BulkReviewQuestionRow[];
}

/**
 * Returns question-by-question data for the selected submissions.
 * Loads the template once (all submissions must share the same template),
 * then fetches self-assessment and manager answers for each submission.
 */
export async function getBulkReviewQuestionData(
  submissionIds: number[],
  reviewerUserId: number,
): Promise<{
  questions: BulkReviewQuestionData[];
  submissions: Array<{
    id: number;
    employeeId: string;
    employeeName: string;
    managerLevel: number | null;
    status: AppraisalStatus;
  }>;
}> {
  if (submissionIds.length === 0) {
    return { questions: [], submissions: [] };
  }

  // Fetch all submissions and filter to the ones the reviewer can access.
  const all = await listFormSubmissions({ managedByUserId: reviewerUserId });
  const selected = all.filter(
    (s) =>
      submissionIds.includes(s.id) &&
      s.status === "PENDING_HEAD_REVIEW" &&
      s.assessmentEligibility &&
      isAssignedManagerAtLevelInline(reviewerUserId, s, s.managerLevel ?? 1),
  );

  if (selected.length === 0) {
    return { questions: [], submissions: [] };
  }

  // All selected submissions should share the same template (same cycle).
  // Use the first one's template.
  const templateId = selected[0].templateId;
  if (!templateId) {
    return { questions: [], submissions: [] };
  }

  const template = await getFormTemplateById(templateId);
  if (!template) {
    return { questions: [], submissions: [] };
  }

  const allQuestions = flattenAllQuestions(template);
  const scoredQuestions = allQuestions.filter((q) => isScoredQuestion(q));

  // Build a section-title lookup.
  const sectionTitleByQuestionId = new Map<number, string | null>();
  for (const section of template.sections) {
    for (const q of section.questions) {
      sectionTitleByQuestionId.set(q.id, section.title);
    }
    for (const sub of section.subsections) {
      for (const q of sub.questions) {
        sectionTitleByQuestionId.set(q.id, sub.title);
      }
    }
  }

  // For each submission, fetch self-assessment answers and the reviewer's answers.
  const submissionMeta: Array<{
    id: number;
    employeeId: string;
    employeeName: string;
    employeeUserId: number;
    manager1UserId: number | null;
    managerLevel: number | null;
    status: AppraisalStatus;
  }> = [];

  for (const s of selected) {
    const empResult = await db.query<{ user_id: string }>(
      `SELECT ap.employee_id::text AS user_id
       FROM appraisals ap
       INNER JOIN users u ON u.id = ap.employee_id
       WHERE ap.id = $1`,
      [s.id],
    );
    const employeeUserId = Number(empResult.rows[0]?.user_id);
    if (!employeeUserId) continue;

    submissionMeta.push({
      id: s.id,
      employeeId: s.employeeId,
      employeeName: s.employeeName,
      employeeUserId,
      manager1UserId: s.manager1UserId ?? null,
      managerLevel: s.managerLevel,
      status: s.status,
    });
  }

  // Batch-fetch answers: self-assessment + reviewer answers per submission.
  const questionsData: BulkReviewQuestionData[] = [];

  for (const q of scoredQuestions) {
    const rows: BulkReviewQuestionRow[] = [];

    for (const meta of submissionMeta) {
      // Self-assessment answers
      const selfResult = await db.query<{
        points_earned: string;
        remarks: string | null;
      }>(
        `SELECT points_earned::text, remarks FROM appraisal_answers
         WHERE appraisal_id = $1 AND question_id = $2 AND filled_by_id = $3`,
        [meta.id, q.id, meta.employeeUserId],
      );
      const selfScore =
        selfResult.rows.length > 0
          ? Number(selfResult.rows[0].points_earned)
          : null;
      const selfRemarks = selfResult.rows[0]?.remarks ?? null;

      // Reviewer (manager) answers
      const mgrResult = await db.query<{
        points_earned: string;
        remarks: string | null;
      }>(
        `SELECT points_earned::text, remarks FROM appraisal_answers
         WHERE appraisal_id = $1 AND question_id = $2 AND filled_by_id = $3`,
        [meta.id, q.id, reviewerUserId],
      );
      const managerScore =
        mgrResult.rows.length > 0
          ? Number(mgrResult.rows[0].points_earned)
          : null;
      const managerRemarks = mgrResult.rows[0]?.remarks ?? null;

      // Manager 1 answers — used as fallback for Manager 2 drafts, mirroring
      // the individual assessment flow's buildManagerDraftMap logic.
      let manager1Score: number | null = null;
      let manager1Remarks: string | null = null;
      if (
        meta.managerLevel === 2 &&
        meta.manager1UserId != null &&
        meta.manager1UserId !== reviewerUserId
      ) {
        const m1Result = await db.query<{
          points_earned: string;
          remarks: string | null;
        }>(
          `SELECT points_earned::text, remarks FROM appraisal_answers
           WHERE appraisal_id = $1 AND question_id = $2 AND filled_by_id = $3`,
          [meta.id, q.id, meta.manager1UserId],
        );
        manager1Score =
          m1Result.rows.length > 0
            ? Number(m1Result.rows[0].points_earned)
            : null;
        manager1Remarks = m1Result.rows[0]?.remarks ?? null;
      }

      rows.push({
        submissionId: meta.id,
        employeeId: meta.employeeId,
        employeeName: meta.employeeName,
        selfScore: s_selfScoreEnabled(selected, meta.id)
          ? selfScore
          : null,
        selfRemarks: s_selfScoreEnabled(selected, meta.id)
          ? selfRemarks
          : null,
        managerScore,
        managerRemarks,
        manager1Score,
        manager1Remarks,
      });
    }

    questionsData.push({
      questionId: q.id,
      questionText: q.questionText,
      totalMarks: q.totalMarks,
      isRequired: q.isRequired,
      sectionTitle: sectionTitleByQuestionId.get(q.id) ?? null,
      rows,
    });
  }

  return {
    questions: questionsData,
    submissions: submissionMeta.map((m) => ({
      id: m.id,
      employeeId: m.employeeId,
      employeeName: m.employeeName,
      managerLevel: m.managerLevel,
      status: m.status,
    })),
  };
}

/** Check if self-assessment is enabled for a submission by id. */
function s_selfScoreEnabled(
  submissions: FormSubmissionListItem[],
  submissionId: number,
): boolean {
  return (
    submissions.find((s) => s.id === submissionId)?.selfAssessmentEnabled ??
    false
  );
}

/**
 * Save manager scores for a single question across multiple submissions.
 * Reuses the same validation logic as `saveManagerReviewAnswers`.
 */
export async function saveBulkReviewQuestionScores(
  reviewerUserId: number,
  questionId: number,
  entries: Array<{
    submissionId: number;
    pointsEarned: number;
    remarks?: string | null;
  }>,
  templateQuestions: QuestionRecord[],
): Promise<{ savedCount: number }> {
  const question = templateQuestions.find((q) => q.id === questionId);
  if (!question || !isScoredQuestion(question)) {
    throw new FormSubmissionError(
      "Question not found or is not a scored question.",
      404,
    );
  }

  await db.query(
    `ALTER TABLE appraisal_answers ADD COLUMN IF NOT EXISTS remarks TEXT`,
  );

  let savedCount = 0;

  for (const entry of entries) {
    const pointsEarned = Number(entry.pointsEarned ?? 0);
    if (
      Number.isNaN(pointsEarned) ||
      pointsEarned < 0 ||
      pointsEarned > Number(question.totalMarks)
    ) {
      throw new FormSubmissionError(
        `Score for "${question.questionText.slice(0, 80)}" must be between 0 and ${question.totalMarks}.`,
      );
    }

    const remarks =
      typeof entry.remarks === "string"
        ? entry.remarks.trim() || null
        : null;

    await db.query(
      `INSERT INTO appraisal_answers (
         appraisal_id,
         question_id,
         filled_by_id,
         text_response,
         selected_option_id,
         points_earned,
         remarks
       ) VALUES ($1, $2, $3, NULL, NULL, $4, $5)
       ON CONFLICT (appraisal_id, question_id, filled_by_id)
       DO UPDATE SET
         points_earned = EXCLUDED.points_earned,
         remarks = EXCLUDED.remarks,
         updated_at = CURRENT_TIMESTAMP`,
      [entry.submissionId, questionId, reviewerUserId, pointsEarned, remarks],
    );

    savedCount += 1;
  }

  return { savedCount };
}

/**
 * Finish (approve) the manager review for multiple submissions.
 * Reuses `approveManagerReview` for each submission, enforcing the same
 * status-transition logic as the individual review flow.
 */
export async function finishBulkReview(
  reviewerUserId: number,
  submissionIds: number[],
): Promise<{
  approved: Array<{ id: number; managerLevel: number; status: AppraisalStatus }>;
  skipped: Array<{ id: number; reason: string }>;
}> {
  const all = await listFormSubmissions({ managedByUserId: reviewerUserId });
  const accessible = new Set(
    all
      .filter(
        (s) =>
          s.status === "PENDING_HEAD_REVIEW" &&
          s.assessmentEligibility &&
          isAssignedManagerAtLevelInline(
            reviewerUserId,
            s,
            s.managerLevel ?? 1,
          ),
      )
      .map((s) => s.id),
  );

  const approved: Array<{
    id: number;
    managerLevel: number;
    status: AppraisalStatus;
  }> = [];
  const skipped: Array<{ id: number; reason: string }> = [];

  for (const id of submissionIds) {
    if (!accessible.has(id)) {
      skipped.push({
        id,
        reason: "Submission is not available for review or already processed.",
      });
      continue;
    }

    try {
      const result = await approveManagerReview(id);
      approved.push({ id, ...result });
    } catch (error) {
      const reason =
        error instanceof FormSubmissionError
          ? error.message
          : "Failed to approve submission.";
      skipped.push({ id, reason });
    }
  }

  return { approved, skipped };
}

async function seedManagerAnswersFromSource(
  appraisalId: number,
  reviewerUserId: number,
  sourceUserId: number,
): Promise<void> {
  const existing = await getAnswersForSubmission(appraisalId, reviewerUserId);
  if (existing.length > 0) {
    return;
  }

  const sourceAnswers = await getAnswersForSubmission(
    appraisalId,
    sourceUserId,
  );

  if (sourceAnswers.length === 0) {
    return;
  }

  await db.query(
    `ALTER TABLE appraisal_answers ADD COLUMN IF NOT EXISTS remarks TEXT`,
  );

  for (const answer of sourceAnswers) {
    await db.query(
      `INSERT INTO appraisal_answers (
         appraisal_id,
         question_id,
         filled_by_id,
         text_response,
         selected_option_id,
         points_earned,
         remarks
       ) VALUES ($1, $2, $3, NULL, NULL, $4, $5)
       ON CONFLICT (appraisal_id, question_id, filled_by_id) DO NOTHING`,
      [
        appraisalId,
        answer.questionId,
        reviewerUserId,
        answer.pointsEarned,
        answer.remarks,
      ],
    );
  }
}

export async function saveManagerReviewAnswers(
  appraisalId: number,
  reviewerUserId: number,
  answers: ManagerReviewAnswerInput[],
  templateQuestions: QuestionRecord[],
  options?: {
    managerLevel?: number;
    overallRemarks?: string | null;
  },
): Promise<EmployeeFormAnswerRecord[]> {
  const questionById = new Map(templateQuestions.map((q) => [q.id, q]));

  await db.query(
    `ALTER TABLE appraisal_answers ADD COLUMN IF NOT EXISTS remarks TEXT`,
  );

  for (const answer of answers) {
    const question = questionById.get(answer.questionId);
    if (!question || !isScoredQuestion(question)) {
      continue;
    }

    const pointsEarned = Number(answer.pointsEarned ?? 0);
    if (
      Number.isNaN(pointsEarned) ||
      pointsEarned < 0 ||
      pointsEarned > Number(question.totalMarks)
    ) {
      throw new FormSubmissionError(
        `Score for "${question.questionText.slice(0, 80)}" must be between 0 and ${question.totalMarks}.`,
      );
    }

    const remarks =
      typeof answer.remarks === "string"
        ? answer.remarks.trim() || null
        : null;

    await db.query(
      `INSERT INTO appraisal_answers (
         appraisal_id,
         question_id,
         filled_by_id,
         text_response,
         selected_option_id,
         points_earned,
         remarks
       ) VALUES ($1, $2, $3, NULL, NULL, $4, $5)
       ON CONFLICT (appraisal_id, question_id, filled_by_id)
       DO UPDATE SET
         points_earned = EXCLUDED.points_earned,
         remarks = EXCLUDED.remarks,
         updated_at = CURRENT_TIMESTAMP`,
      [appraisalId, answer.questionId, reviewerUserId, pointsEarned, remarks],
    );
  }

  // Save overall remarks independently from question-level answers.
  // Only write to the column matching the current manager level so Manager 2
  // never overwrites Manager 1 remarks (and vice versa).
  if (options?.overallRemarks !== undefined) {
    await ensureOverallRemarksColumns();
    const trimmedRemarks =
      typeof options.overallRemarks === "string"
        ? options.overallRemarks.trim() || null
        : null;
    const column =
      options?.managerLevel === 2
        ? "manager2_overall_remarks"
        : "manager1_overall_remarks";

    await db.query(
      `UPDATE appraisals
       SET ${column} = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [appraisalId, trimmedRemarks],
    );
  }

  return getAnswersForSubmission(appraisalId, reviewerUserId);
}

export async function approveManagerReview(appraisalId: number): Promise<{
  managerLevel: number;
  status: AppraisalStatus;
}> {
  await Promise.all([ensureManagerLevelColumn(), ensureManager2Column()]);

  const current = await db.query<{
    status: AppraisalStatus;
    manager_level: number;
    manager_1_user_id: string | null;
    manager_2_user_id: string | null;
  }>(
    `SELECT ap.status,
            ap.manager_level,
            u.head_id::text AS manager_1_user_id,
            u.manager_2_id::text AS manager_2_user_id
     FROM appraisals ap
     INNER JOIN users u ON u.id = ap.employee_id
     WHERE ap.id = $1`,
    [appraisalId],
  );

  const row = current.rows[0];
  if (!row) {
    throw new FormSubmissionError("Submission not found.", 404);
  }

  if (row.status !== "PENDING_HEAD_REVIEW") {
    throw new FormSubmissionError(
      "Manager review is not open for this submission.",
      409,
    );
  }

  const advance = resolveManagerApprovalAdvance(
    row.manager_level ?? 1,
    toEmployeeManagers({
      manager1UserId: row.manager_1_user_id
        ? Number(row.manager_1_user_id)
        : null,
      manager2UserId: row.manager_2_user_id
        ? Number(row.manager_2_user_id)
        : null,
    }),
  );

  await db.query(
    `UPDATE appraisals
     SET status = $2,
         manager_level = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [appraisalId, advance.status, advance.managerLevel],
  );

  return advance;
}

export async function approveHrCalibration(appraisalId: number): Promise<{
  status: AppraisalStatus;
}> {
  const current = await db.query<{ status: AppraisalStatus }>(
    `SELECT status FROM appraisals WHERE id = $1`,
    [appraisalId],
  );

  const row = current.rows[0];
  if (!row) {
    throw new FormSubmissionError("Submission not found.", 404);
  }

  let nextStatus: AppraisalStatus;

  if (row.status === "PENDING_HR_CALIBRATION") {
    nextStatus = "PENDING_BOARD_APPROVAL";
  } else if (row.status === "PENDING_BOARD_APPROVAL") {
    nextStatus = "APPROVED";
  } else {
    throw new FormSubmissionError(
      "HR/Board approval is not open for this submission.",
      409,
    );
  }

  await db.query(
    `UPDATE appraisals
     SET status = $2,
         hr_approval_status = 'approved',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [appraisalId, nextStatus],
  );

  return { status: nextStatus };
}

export async function setHrReviewRequired(appraisalId: number): Promise<{
  hrApprovalStatus: string;
}> {
  const result = await db.query<{ id: string }>(
    `UPDATE appraisals
     SET hr_approval_status = 'review_required',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id`,
    [appraisalId],
  );

  if (!result.rows[0]) {
    throw new FormSubmissionError("Submission not found.", 404);
  }

  return { hrApprovalStatus: "review_required" };
}

export async function getFormSubmissionById(
  id: number,
  options?: {
    reviewerUserId?: number | null;
    seedManagerAnswers?: boolean;
    canEditManagerReview?: boolean;
    canEditHrReview?: boolean;
    canEditScoreAdjustments?: boolean;
    isAssignedManagerForCurrentLevel?: boolean;
  },
): Promise<FormSubmissionDetail | null> {
  const submissions = await listFormSubmissions();
  const summary = submissions.find((item) => item.id === id);

  if (!summary) {
    return null;
  }

  const employeeResult = await db.query<{ user_id: string }>(
    `SELECT ap.employee_id::text AS user_id
     FROM appraisals ap
     INNER JOIN users u ON u.id = ap.employee_id
     WHERE ap.id = $1`,
    [id],
  );

  const employeeUserId = Number(employeeResult.rows[0]?.user_id);
  if (!employeeUserId) {
    return null;
  }

  const reviewerUserId =
    options?.reviewerUserId != null && Number.isFinite(options.reviewerUserId)
      ? Number(options.reviewerUserId)
      : null;

  if (
    options?.seedManagerAnswers &&
    reviewerUserId != null &&
    summary.status === "PENDING_HEAD_REVIEW"
  ) {
    const seedSourceUserId =
      summary.managerLevel === 2 && summary.manager1UserId != null
        ? summary.manager1UserId
        : employeeUserId;
    await seedManagerAnswersFromSource(
      id,
      reviewerUserId,
      seedSourceUserId,
    );
  }

  const answers = await getAnswersForSubmission(id, employeeUserId);
  const managerAnswers =
    reviewerUserId != null
      ? await getAnswersForSubmission(id, reviewerUserId)
      : [];

  const manager1Answers =
    summary.manager1UserId != null
      ? await getAnswersForSubmission(id, summary.manager1UserId)
      : [];
  const manager2Answers =
    summary.manager2UserId != null
      ? await getAnswersForSubmission(id, summary.manager2UserId)
      : [];

  let questions: FormSubmissionDetail["questions"] = [];
  let sections: FormSubmissionDetail["sections"] = [];
  let rootQuestions: FormSubmissionDetail["rootQuestions"] = [];
  let templateDescription: string | null = null;
  let additionalRemarksEnabled = false;

  if (summary.templateId) {
    const template = await getFormTemplateById(summary.templateId);
    if (template) {
      sections = template.sections;
      rootQuestions = template.questions;
      questions = flattenAllQuestions(template);
      templateDescription = template.description;
      additionalRemarksEnabled = template.additionalRemarksEnabled;
    }
  }

  const quartileBands = await getActiveFinancialYearQuartileBands();
  // Use the normalized score % (Score O + adjustments + calibration factor)
  // for resolving the quartile range, consistent with the Staff Listing and
  // Performance Matrix. Previously this used the raw self-assessment score %.
  const resolved = resolveSubmissionPerformanceQuartile(
    {
      scoreO: summary.scoreO,
      rawScore: summary.rawScore,
      creditHrsErpScoreAdj: summary.creditHrsErpScoreAdj,
      pubOricScoreAdj: summary.pubOricScoreAdj,
      qecScoreAdj: summary.qecScoreAdj,
      calibrationFactor: summary.calibrationFactor,
      maxRawScore: summary.maxRawScore,
    },
    quartileBands,
  );

  return {
    id: summary.id,
    employeeId: summary.employeeId,
    employeeName: summary.employeeName,
    employeeEmail: summary.employeeEmail,
    templateId: summary.templateId,
    templateTitle: summary.templateTitle,
    status: summary.status,
    managerLevel: summary.managerLevel,
    manager1UserId: summary.manager1UserId,
    manager2UserId: summary.manager2UserId,
    rawScore: summary.rawScore,
    maxRawScore: summary.maxRawScore,
    scorePercent: summary.scorePercent,
    performanceLevelName: summary.performanceLevelName,
    quartileName: summary.quartileName,
    quartileScoreMin: resolved?.scoreMin ?? null,
    quartileScoreMax: resolved?.scoreMax ?? null,
    submittedAt: summary.submittedAt,
    templateDescription,
    sections,
    rootQuestions,
    questions,
    answers,
    managerAnswers,
    manager1Answers,
    manager2Answers,
    canEditManagerReview: Boolean(options?.canEditManagerReview),
    canEditHrReview: Boolean(options?.canEditHrReview),
    isAssignedManagerForCurrentLevel: Boolean(
      options?.isAssignedManagerForCurrentLevel,
    ),
    creditHrsErpScoreAdj: summary.creditHrsErpScoreAdj,
    pubOricScoreAdj: summary.pubOricScoreAdj,
    qecScoreAdj: summary.qecScoreAdj,
    calibrationFactor: summary.calibrationFactor,
    calibratedScoreNumeric: summary.normalizedScore,
    initialScoreNumeric: summary.scoreO,
    canEditScoreAdjustments: Boolean(options?.canEditScoreAdjustments),
    selfAssessmentEnabled: summary.selfAssessmentEnabled,
    assessmentEligibility: summary.assessmentEligibility,
    ineligibilityReason: summary.ineligibilityReason ?? null,
    additionalRemarksEnabled,
    manager1OverallRemarks: summary.manager1OverallRemarks,
    manager2OverallRemarks: summary.manager2OverallRemarks,
  };
}

export type AppraisalRemarksField =
  | "remarksEvaluation"
  | "remarksCompensation";

export type AppraisalScoreAdjustmentField =
  | "creditHrsErpScoreAdj"
  | "pubOricScoreAdj"
  | "qecScoreAdj"
  | "calibrationFactor"
  | "calibratedScoreNumeric"
  | "initialScoreNumeric";

export async function updateAppraisalScoreAdjustments(
  appraisalId: number,
  fields: Partial<
    Pick<
      FormSubmissionDetail,
      AppraisalScoreAdjustmentField
    >
  >,
): Promise<{
  id: number;
  creditHrsErpScoreAdj: number | null;
  pubOricScoreAdj: number | null;
  qecScoreAdj: number | null;
  calibrationFactor: number | null;
  calibratedScoreNumeric: number | null;
  initialScoreNumeric: number | null;
}> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<
    AppraisalScoreAdjustmentField,
    string
  > = {
    creditHrsErpScoreAdj: "credit_hrs_erp_score_adj",
    pubOricScoreAdj: "pub_oric_score_adj",
    qecScoreAdj: "qec_score_adj",
    calibrationFactor: "calibration_factor",
    calibratedScoreNumeric: "calibrated_score_numeric",
    initialScoreNumeric: "initial_score_numeric",
  };

  for (const key of Object.keys(fields) as AppraisalScoreAdjustmentField[]) {
    const value = fields[key];
    if (value === undefined) continue;
    values.push(value);
    setClauses.push(`${fieldMap[key]} = $${values.length}`);
  }

  if (setClauses.length === 0) {
    throw new FormSubmissionError("No score adjustment fields provided.", 400);
  }

  setClauses.push("updated_at = CURRENT_TIMESTAMP");
  values.push(appraisalId);

  const result = await db.query<{
    id: string;
    credit_hrs_erp_score_adj: string | null;
    pub_oric_score_adj: string | null;
    qec_score_adj: string | null;
    calibration_factor: string | null;
    calibrated_score_numeric: string | null;
    initial_score_numeric: string | null;
  }>(
    `UPDATE appraisals
     SET ${setClauses.join(",\n         ")}
     WHERE id = $${values.length}
     RETURNING id,
       credit_hrs_erp_score_adj::text,
       pub_oric_score_adj::text,
       qec_score_adj::text,
       calibration_factor::text,
       calibrated_score_numeric::text,
       initial_score_numeric::text`,
    values,
  );

  if (!result.rows[0]) {
    throw new FormSubmissionError("Submission not found.", 404);
  }

  return {
    id: Number(result.rows[0].id),
    creditHrsErpScoreAdj: toNumber(result.rows[0].credit_hrs_erp_score_adj),
    pubOricScoreAdj: toNumber(result.rows[0].pub_oric_score_adj),
    qecScoreAdj: toNumber(result.rows[0].qec_score_adj),
    calibrationFactor: toNumber(result.rows[0].calibration_factor),
    calibratedScoreNumeric: toNumber(result.rows[0].calibrated_score_numeric),
    initialScoreNumeric: toNumber(result.rows[0].initial_score_numeric),
  };
}

export async function updateAppraisalRemarks(
  appraisalId: number,
  field: AppraisalRemarksField,
  value: string | null,
): Promise<{
  id: number;
  remarksEvaluation?: string | null;
  remarksCompensation?: string | null;
}> {
  if (field === "remarksEvaluation") {
    const result = await db.query<{
      id: string;
      remarks_evaluation: string | null;
    }>(
      `UPDATE appraisals
       SET remarks_evaluation = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, remarks_evaluation`,
      [appraisalId, value],
    );

    if (!result.rows[0]) {
      throw new FormSubmissionError("Submission not found.", 404);
    }

    return {
      id: Number(result.rows[0].id),
      remarksEvaluation: result.rows[0].remarks_evaluation,
    };
  }

  const result = await db.query<{
    id: string;
    remarks_compensation: string | null;
  }>(
    `UPDATE appraisals
     SET remarks_compensation = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, remarks_compensation`,
    [appraisalId, value],
  );

  if (!result.rows[0]) {
    throw new FormSubmissionError("Submission not found.", 404);
  }

  return {
    id: Number(result.rows[0].id),
    remarksCompensation: result.rows[0].remarks_compensation,
  };
}

/**
 * Updates the overall remarks for a specific manager level (1 or 2).
 * Manager 1 remarks and Manager 2 remarks are stored independently and
 * never overwrite each other.
 */
export async function updateAppraisalOverallRemarks(
  appraisalId: number,
  managerLevel: 1 | 2,
  value: string | null,
): Promise<{
  id: number;
  manager1OverallRemarks: string | null;
  manager2OverallRemarks: string | null;
}> {
  await ensureOverallRemarksColumns();

  const column =
    managerLevel === 1 ? "manager1_overall_remarks" : "manager2_overall_remarks";

  const result = await db.query<{
    id: string;
    manager1_overall_remarks: string | null;
    manager2_overall_remarks: string | null;
  }>(
    `UPDATE appraisals
     SET ${column} = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, manager1_overall_remarks, manager2_overall_remarks`,
    [appraisalId, value],
  );

  if (!result.rows[0]) {
    throw new FormSubmissionError("Submission not found.", 404);
  }

  return {
    id: Number(result.rows[0].id),
    manager1OverallRemarks: result.rows[0].manager1_overall_remarks,
    manager2OverallRemarks: result.rows[0].manager2_overall_remarks,
  };
}

export async function updateEmployeeRoleCategory(
  employeeCode: string,
  roleCategory: string | null,
): Promise<{ employeeId: string; roleCategory: string | null }> {
  if (!(await hasRoleCategoryColumn())) {
    throw new FormSubmissionError(
      "Role category column is not available. Run the excel-sheet columns migration.",
      503,
    );
  }

  const result = await db.query<{
    employee_id: string;
    role_category: string | null;
  }>(
    `UPDATE users
     SET role_category = $2
     WHERE employee_id = $1
     RETURNING employee_id, role_category`,
    [employeeCode, roleCategory],
  );

  if (!result.rows[0]) {
    throw new FormSubmissionError("Employee not found.", 404);
  }

  return {
    employeeId: result.rows[0].employee_id,
    roleCategory: result.rows[0].role_category,
  };
}

export async function bulkUpdateEmployeeListingFields(
  employeeIds: string[],
  fields: {
    roleCategory?: string | null;
    designation?: string | null;
    entityId?: number | null;
    templateId?: number | null;
    qualification?: string | null;
    qualificationYear?: number | null;
    qualificationSubject?: string | null;
    qualificationInstitute?: string | null;
    qualificationCountry?: string | null;
    creditHrsErpScoreAdj?: number | null;
    pubOricScoreAdj?: number | null;
    qecScoreAdj?: number | null;
    calibrationFactor?: number | null;
    manager1UserId?: number | null;
    manager2UserId?: number | null;
    assessmentEligibility?: boolean;
    systemRole?: string | null;
  },
): Promise<{
  updatedCount: number;
  employeeIds: string[];
  roleCategory?: string | null;
  designation?: string | null;
  entityId?: number | null;
  templateId?: number | null;
  qualification?: string | null;
  qualificationYear?: number | null;
  qualificationSubject?: string | null;
  qualificationInstitute?: string | null;
  qualificationCountry?: string | null;
  creditHrsErpScoreAdj?: number | null;
  pubOricScoreAdj?: number | null;
  qecScoreAdj?: number | null;
  calibrationFactor?: number | null;
  manager1UserId?: number | null;
  manager2UserId?: number | null;
  assessmentEligibility?: boolean;
  systemRole?: string | null;
}> {
  const uniqueIds = [...new Set(employeeIds.map((id) => id.trim()).filter(Boolean))];

  if (uniqueIds.length === 0) {
    throw new FormSubmissionError("At least one employeeId is required.", 400);
  }

  const updatesRole = "roleCategory" in fields;
  const updatesDesignation = "designation" in fields;
  const updatesEntity = "entityId" in fields;
  const updatesTemplate = "templateId" in fields;
  const updatesQualification = "qualification" in fields;
  const updatesQualificationYear = "qualificationYear" in fields;
  const updatesQualificationSubject = "qualificationSubject" in fields;
  const updatesQualificationInstitute = "qualificationInstitute" in fields;
  const updatesQualificationCountry = "qualificationCountry" in fields;
  const updatesChAdj = "creditHrsErpScoreAdj" in fields;
  const updatesOricAdj = "pubOricScoreAdj" in fields;
  const updatesQecAdj = "qecScoreAdj" in fields;
  const updatesCalFr = "calibrationFactor" in fields;
  const updatesManager1 = "manager1UserId" in fields;
  const updatesManager2 = "manager2UserId" in fields;
  const updatesAssessmentEligibility = "assessmentEligibility" in fields;
  const updatesSystemRole = "systemRole" in fields;

  const hasAnyUpdate =
    updatesRole ||
    updatesDesignation ||
    updatesEntity ||
    updatesTemplate ||
    updatesQualification ||
    updatesQualificationYear ||
    updatesQualificationSubject ||
    updatesQualificationInstitute ||
    updatesQualificationCountry ||
    updatesChAdj ||
    updatesOricAdj ||
    updatesQecAdj ||
    updatesCalFr ||
    updatesManager1 ||
    updatesManager2 ||
    updatesAssessmentEligibility ||
    updatesSystemRole;

  if (!hasAnyUpdate) {
    throw new FormSubmissionError(
      "Provide at least one field to update.",
      400,
    );
  }

  // Enforce manager eligibility for bulk manager assignments.
  if (updatesManager1 && fields.manager1UserId != null) {
    await assertManagerEligible(fields.manager1UserId, "Manager 1");
  }
  if (updatesManager2 && fields.manager2UserId != null) {
    await assertManagerEligible(fields.manager2UserId, "Manager 2");
  }

  if ((updatesRole || updatesDesignation) && !(await hasExcelSheetColumns())) {
    throw new FormSubmissionError(
      "Excel-sheet columns are not available. Run the excel-sheet columns migration.",
      503,
    );
  }

  if (updatesRole && !(await hasRoleCategoryColumn())) {
    throw new FormSubmissionError(
      "Role category column is not available. Run the excel-sheet columns migration.",
      503,
    );
  }

  // --- Update users table ---
  const userSetClauses: string[] = [];
  const userValues: unknown[] = [uniqueIds];
  let paramIdx = 1;

  if (updatesRole) {
    userValues.push(fields.roleCategory ?? null);
    userSetClauses.push(`role_category = $${++paramIdx}`);
  }
  if (updatesDesignation) {
    userValues.push(fields.designation ?? null);
    userSetClauses.push(`designation = $${++paramIdx}`);
  }
  if (updatesEntity) {
    userValues.push(fields.entityId ?? null);
    userSetClauses.push(`entity_id = $${++paramIdx}`);
  }
  if (updatesManager1) {
    userValues.push(fields.manager1UserId ?? null);
    userSetClauses.push(`head_id = $${++paramIdx}`);
  }
  if (updatesManager2) {
    userValues.push(fields.manager2UserId ?? null);
    userSetClauses.push(`manager_2_id = $${++paramIdx}`);
  }
  if (updatesAssessmentEligibility) {
    userValues.push(fields.assessmentEligibility);
    userSetClauses.push(`assessment_eligibility = $${++paramIdx}`);
  }
  if (updatesSystemRole) {
    userValues.push(fields.systemRole ?? null);
    userSetClauses.push(`system_role = $${++paramIdx}`);
  }

  let updatedUserIds: string[] = [];

  if (userSetClauses.length > 0) {
    const userResult = await db.query<{ employee_id: string }>(
      `UPDATE users
       SET ${userSetClauses.join(", ")}
       WHERE employee_id = ANY($1::text[])
       RETURNING employee_id`,
      userValues,
    );
    updatedUserIds = userResult.rows.map((r) => r.employee_id);
  } else {
    // Still need to get the user IDs for downstream updates
    const idResult = await db.query<{ id: string; employee_id: string }>(
      `SELECT id::text, employee_id FROM users WHERE employee_id = ANY($1::text[])`,
      [uniqueIds],
    );
    updatedUserIds = idResult.rows.map((r) => r.employee_id);
  }

  if (updatedUserIds.length === 0) {
    throw new FormSubmissionError("No matching employees found.", 404);
  }

  // --- Update employee_form_assignments (Form / templateId) ---
  if (updatesTemplate) {
    const templateId = fields.templateId ?? null;
    // Get user IDs for these employees
    const userIdResult = await db.query<{ id: string; employee_id: string }>(
      `SELECT id::text, employee_id FROM users WHERE employee_id = ANY($1::text[])`,
      [uniqueIds],
    );
    const userIds = userIdResult.rows.map((r) => Number(r.id));

    if (templateId != null) {
      // Upsert form assignment for each user
      for (const userId of userIds) {
        await db.query(
          `INSERT INTO employee_form_assignments (employee_id, template_id)
           VALUES ($1, $2)
           ON CONFLICT (employee_id, template_id) DO NOTHING`,
          [userId, templateId],
        );
      }
    }
  }

  // --- Update employee_qualifications ---
  const updatesAnyQualification =
    updatesQualification ||
    updatesQualificationYear ||
    updatesQualificationSubject ||
    updatesQualificationInstitute ||
    updatesQualificationCountry;

  if (updatesAnyQualification && (await hasQualificationsTable())) {
    const userIdResult = await db.query<{ id: string; employee_id: string }>(
      `SELECT id::text, employee_id FROM users WHERE employee_id = ANY($1::text[])`,
      [uniqueIds],
    );

    for (const userRow of userIdResult.rows) {
      const userId = Number(userRow.id);

      // Check if primary qualification exists
      const existing = await db.query<{ id: string }>(
        `SELECT id::text FROM employee_qualifications
         WHERE user_id = $1 AND is_primary = TRUE
         LIMIT 1`,
        [userId],
      );

      const qualSetClauses: string[] = [];
      const qualValues: unknown[] = [];
      let qualParamIdx = 0;

      if (updatesQualification) {
        qualValues.push(fields.qualification ?? null);
        qualSetClauses.push(`qualification = $${++qualParamIdx}`);
      }
      if (updatesQualificationYear) {
        qualValues.push(fields.qualificationYear ?? null);
        qualSetClauses.push(`year = $${++qualParamIdx}`);
      }
      if (updatesQualificationSubject) {
        qualValues.push(fields.qualificationSubject ?? null);
        qualSetClauses.push(`subject = $${++qualParamIdx}`);
      }
      if (updatesQualificationInstitute) {
        qualValues.push(fields.qualificationInstitute ?? null);
        qualSetClauses.push(`institute = $${++qualParamIdx}`);
      }
      if (updatesQualificationCountry) {
        qualValues.push(fields.qualificationCountry ?? null);
        qualSetClauses.push(`country = $${++qualParamIdx}`);
      }

      if (existing.rows.length > 0) {
        // Update existing primary qualification
        qualValues.push(Number(existing.rows[0].id));
        await db.query(
          `UPDATE employee_qualifications
           SET ${qualSetClauses.join(", ")}
           WHERE id = $${++qualParamIdx}`,
          qualValues,
        );
      } else {
        // Insert new primary qualification
        const insertCols: string[] = ["user_id", "is_primary"];
        const insertPlaceholders: string[] = ["$1", "TRUE"];
        const insertVals: unknown[] = [userId];
        let insertIdx = 1;

        if (updatesQualification) {
          insertCols.push("qualification");
          insertVals.push(fields.qualification ?? null);
          insertPlaceholders.push(`$${++insertIdx}`);
        }
        if (updatesQualificationYear) {
          insertCols.push("year");
          insertVals.push(fields.qualificationYear ?? null);
          insertPlaceholders.push(`$${++insertIdx}`);
        }
        if (updatesQualificationSubject) {
          insertCols.push("subject");
          insertVals.push(fields.qualificationSubject ?? null);
          insertPlaceholders.push(`$${++insertIdx}`);
        }
        if (updatesQualificationInstitute) {
          insertCols.push("institute");
          insertVals.push(fields.qualificationInstitute ?? null);
          insertPlaceholders.push(`$${++insertIdx}`);
        }
        if (updatesQualificationCountry) {
          insertCols.push("country");
          insertVals.push(fields.qualificationCountry ?? null);
          insertPlaceholders.push(`$${++insertIdx}`);
        }

        await db.query(
          `INSERT INTO employee_qualifications (${insertCols.join(", ")})
           VALUES (${insertPlaceholders.join(", ")})`,
          insertVals,
        );
      }
    }
  }

  // --- Update appraisals (score adjustments + calibration factor) ---
  const updatesAnyScoreAdj =
    updatesChAdj || updatesOricAdj || updatesQecAdj || updatesCalFr;

  if (updatesAnyScoreAdj) {
    const appraisalSetClauses: string[] = [];
    const appraisalValues: unknown[] = [];
    let appraisalParamIdx = 0;

    if (updatesChAdj) {
      appraisalValues.push(fields.creditHrsErpScoreAdj ?? null);
      appraisalSetClauses.push(`credit_hrs_erp_score_adj = $${++appraisalParamIdx}`);
    }
    if (updatesOricAdj) {
      appraisalValues.push(fields.pubOricScoreAdj ?? null);
      appraisalSetClauses.push(`pub_oric_score_adj = $${++appraisalParamIdx}`);
    }
    if (updatesQecAdj) {
      appraisalValues.push(fields.qecScoreAdj ?? null);
      appraisalSetClauses.push(`qec_score_adj = $${++appraisalParamIdx}`);
    }
    if (updatesCalFr) {
      appraisalValues.push(fields.calibrationFactor ?? null);
      appraisalSetClauses.push(`calibration_factor = $${++appraisalParamIdx}`);
    }

    // Get active cycle
    const cycleResult = await db.query<{ id: number }>(
      `SELECT id FROM appraisal_cycles WHERE is_active = TRUE LIMIT 1`,
    );
    const cycleId = cycleResult.rows[0]?.id;

    if (cycleId != null) {
      // Get user IDs
      const userIdResult = await db.query<{ id: string }>(
        `SELECT id::text FROM users WHERE employee_id = ANY($1::text[])`,
        [uniqueIds],
      );
      const userIds = userIdResult.rows.map((r) => Number(r.id));

      appraisalValues.push(userIds);
      appraisalValues.push(cycleId);

      await db.query(
        `UPDATE appraisals
         SET ${appraisalSetClauses.join(", ")}
         WHERE employee_id = ANY($${++appraisalParamIdx}::bigint[])
           AND cycle_id = $${++appraisalParamIdx}`,
        appraisalValues,
      );
    }
  }

  return {
    updatedCount: updatedUserIds.length,
    employeeIds: updatedUserIds,
    ...(updatesRole ? { roleCategory: fields.roleCategory ?? null } : {}),
    ...(updatesDesignation ? { designation: fields.designation ?? null } : {}),
    ...(updatesEntity ? { entityId: fields.entityId ?? null } : {}),
    ...(updatesTemplate ? { templateId: fields.templateId ?? null } : {}),
    ...(updatesQualification ? { qualification: fields.qualification ?? null } : {}),
    ...(updatesQualificationYear ? { qualificationYear: fields.qualificationYear ?? null } : {}),
    ...(updatesQualificationSubject ? { qualificationSubject: fields.qualificationSubject ?? null } : {}),
    ...(updatesQualificationInstitute ? { qualificationInstitute: fields.qualificationInstitute ?? null } : {}),
    ...(updatesQualificationCountry ? { qualificationCountry: fields.qualificationCountry ?? null } : {}),
    ...(updatesChAdj ? { creditHrsErpScoreAdj: fields.creditHrsErpScoreAdj ?? null } : {}),
    ...(updatesOricAdj ? { pubOricScoreAdj: fields.pubOricScoreAdj ?? null } : {}),
    ...(updatesQecAdj ? { qecScoreAdj: fields.qecScoreAdj ?? null } : {}),
    ...(updatesCalFr ? { calibrationFactor: fields.calibrationFactor ?? null } : {}),
    ...(updatesManager1 ? { manager1UserId: fields.manager1UserId ?? null } : {}),
    ...(updatesManager2 ? { manager2UserId: fields.manager2UserId ?? null } : {}),
    ...(updatesAssessmentEligibility ? { assessmentEligibility: fields.assessmentEligibility } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Reset Form to Self Assessment                                              */
/* -------------------------------------------------------------------------- */

/**
 * Permanently reset an appraisal submission back to the Self Assessment
 * stage. This removes all employee answers, manager answers, attachments,
 * score adjustments, calibration data, HR/Board approval data, and overall
 * remarks. The appraisal row itself is preserved (so the employee keeps
 * their form assignment) but every assessment-related field is cleared.
 *
 * An audit log entry is written to the `appraisal_logs` table with
 * action = 'RESET_FORM' capturing who performed the reset.
 *
 * This operation is wrapped in a transaction — if any step fails the entire
 * reset is rolled back.
 *
 * Authorization (HR / Board / Super Admin only) is enforced by the API
 * route before calling this function.
 */
export async function resetFormSubmission(
  appraisalId: number,
  resetByUserId: number,
): Promise<{
  status: AppraisalStatus;
  deletedAttachments: number;
  deletedAnswers: number;
  resetAppraisal: boolean;
}> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Capture the employee_id for the audit log before wiping data.
    const appraisalRow = await client.query<{ employee_id: string }>(
      `SELECT employee_id::text FROM appraisals WHERE id = $1`,
      [appraisalId],
    );

    if (appraisalRow.rows.length === 0) {
      throw new FormSubmissionError("Submission not found.", 404);
    }

    const employeeId = Number(appraisalRow.rows[0].employee_id);

    // 1. Delete all answer attachments for this appraisal.
    const attachmentsResult = await client.query(
      `DELETE FROM appraisal_answer_attachments WHERE appraisal_id = $1`,
      [appraisalId],
    );
    const deletedAttachments = attachmentsResult.rowCount ?? 0;

    // 2. Delete all answers (employee self-assessment + manager 1/2
    //    reviews). The filled_by_id column distinguishes who wrote each
    //    answer, but we remove every row for this appraisal. This clears
    //    all scores, selected options, text responses, and per-question
    //    remarks in a single operation.
    const answersResult = await client.query(
      `DELETE FROM appraisal_answers WHERE appraisal_id = $1`,
      [appraisalId],
    );
    const deletedAnswers = answersResult.rowCount ?? 0;

    // 3. Reset the appraisal row to a fresh Self Assessment state.
    //    Clear every assessment-related field: scores, ratings,
    //    adjustments, calibration, HR/Board approval, compensation,
    //    remarks, and workflow metadata.
    const appraisalResult = await client.query(
      `UPDATE appraisals
       SET status = 'PENDING_SELF_ASSESSMENT',
           manager_level = 1,
           system_raw_score = 0,
           initial_score_numeric = NULL,
           initial_rating = NULL,
           credit_hrs_erp_score_adj = NULL,
           pub_oric_score_adj = NULL,
           qec_score_adj = NULL,
           calibration_factor = NULL,
           normalized_score = NULL,
           calibrated_score_numeric = NULL,
           calibrated_rating = NULL,
           performance_quartile_id = NULL,
           is_eligible = NULL,
           eligibility_status = NULL,
           applicable_duration = NULL,
           applicable_duration_factor = NULL,
           remarks_evaluation = NULL,
           hr_approval_status = 'pending',
           current_salary = NULL,
           previous_salary = NULL,
           applicable_salary_for_increment = NULL,
           applicable_matrix = NULL,
           calculated_increment_percentage = NULL,
           increment_per_matrix = NULL,
           approved_increment_percentage = NULL,
           revised_salary = NULL,
           revised_salary_ro = NULL,
           hod_review_comments = NULL,
           remarks_compensation = NULL,
           effective_date = NULL,
           employee_strengths = NULL,
           employee_weaknesses = NULL,
           committee_feedback = NULL,
           next_year_targets = NULL,
           manager1_overall_remarks = NULL,
           manager2_overall_remarks = NULL,
           submitted_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [appraisalId],
    );
    const resetAppraisal = (appraisalResult.rowCount ?? 0) > 0;

    // 4. Write an audit log entry to appraisal_logs.
    //    The table is created in schema.sql but currently unused — this
    //    is the first operational use. Store the previous status and the
    //    reset actor in the JSONB columns for traceability.
    //
    //    Note: explicit casts ($n::type) are required because the same
    //    parameter is used in both a typed column context (changed_by_id
    //    bigint) and inside jsonb_build_object, where PostgreSQL cannot
    //    infer the type on its own (error 42P08).
    await client.query(
      `INSERT INTO appraisal_logs
         (appraisal_id, changed_by_id, action_performed, old_value, new_value, timestamp)
       VALUES
         ($1::bigint, $2::bigint, 'RESET_FORM',
          jsonb_build_object(
            'reset_by', $2::bigint,
            'employee_id', $3::bigint,
            'reset_at', to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
            'deleted_attachments', $4::int,
            'deleted_answers', $5::int
          ),
          jsonb_build_object('status', 'PENDING_SELF_ASSESSMENT', 'manager_level', 1),
          CURRENT_TIMESTAMP)`,
      [
        appraisalId,
        resetByUserId,
        employeeId,
        deletedAttachments,
        deletedAnswers,
      ],
    );

    await client.query("COMMIT");

    // Debug logging — verify deletion counts for troubleshooting.
    console.info(
      `[resetFormSubmission] appraisal=${appraisalId} ` +
        `deletedAttachments=${deletedAttachments} ` +
        `deletedAnswers=${deletedAnswers} ` +
        `resetAppraisal=${resetAppraisal}`,
    );

    return {
      status: "PENDING_SELF_ASSESSMENT",
      deletedAttachments,
      deletedAnswers,
      resetAppraisal,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
