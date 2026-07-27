import "server-only";

import { computeAppraisalEligibility, resolveReferenceEndDate } from "@/lib/appraisal-eligibility";
import { db } from "@/lib/db";
import { getDefaultAppraisalCycle } from "@/lib/queries/appraisal-cycles";
import {
  calculateScorePercent,
  getActiveFinancialYearQuartileBands,
  resolvePerformanceQuartile,
} from "@/lib/queries/performance-rating";
import { getFormTemplateById } from "@/lib/queries/forms";
import { isScoredQuestion } from "@/app/helpers/form-questions";
import type { EmployeeFormAnswerRecord } from "@/types/employee-forms";
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
import { ensureManager2Column } from "@/lib/queries/users";
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
  self_assessment_disabled: boolean;
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

  return result.rows.map((row) => ({
    questionId: Number(row.question_id),
    textResponse: row.text_response,
    selectedOptionId: row.selected_option_id
      ? Number(row.selected_option_id)
      : null,
    pointsEarned: Number(row.points_earned),
    remarks: row.remarks ?? null,
    attachments: [],
  }));
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
  const resolved = hasAppraisal
    ? resolvePerformanceQuartile(scorePercent, quartileBands)
    : null;
  const scoreO = toNumber(row.initial_score_numeric) ?? rawScore;
  const normalizedScore =
    toNumber(row.normalized_score) ?? toNumber(row.calibrated_score_numeric);
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
         ap.current_salary::text,
         ap.previous_salary::text,
         ap.applicable_salary_for_increment::text,
         ap.applicable_matrix,
         ap.calculated_increment_percentage::text,
         ap.increment_per_matrix::text,
         ap.approved_increment_percentage::text,
         ap.revised_salary::text,
         ap.revised_salary_ro::text,
         ap.hod_review_comments,
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
       COALESCE(efa.self_assessment_disabled, false) AS self_assessment_disabled
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
  > | null
> {
  await ensureManager2Column();

  const result = await db.query<{
    id: string;
    entity_id: string | null;
    status: AppraisalStatus;
    manager_level: number | null;
    manager_1_user_id: string | null;
    manager_2_user_id: string | null;
  }>(
    `SELECT ap.id,
            u.entity_id,
            ap.status,
            ap.manager_level,
            u.head_id::text AS manager_1_user_id,
            u.manager_2_id::text AS manager_2_user_id
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
  };
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
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [appraisalId, nextStatus],
  );

  return { status: nextStatus };
}

export async function getFormSubmissionById(
  id: number,
  options?: {
    reviewerUserId?: number | null;
    seedManagerAnswers?: boolean;
    canEditManagerReview?: boolean;
    canEditHrReview?: boolean;
    canEditScoreAdjustments?: boolean;
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

  if (summary.templateId) {
    const template = await getFormTemplateById(summary.templateId);
    if (template) {
      sections = template.sections;
      rootQuestions = template.questions;
      questions = flattenAllQuestions(template);
      templateDescription = template.description;
    }
  }

  const quartileBands = await getActiveFinancialYearQuartileBands();
  const resolved = resolvePerformanceQuartile(summary.scorePercent, quartileBands);

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
    creditHrsErpScoreAdj: summary.creditHrsErpScoreAdj,
    pubOricScoreAdj: summary.pubOricScoreAdj,
    qecScoreAdj: summary.qecScoreAdj,
    calibrationFactor: summary.calibrationFactor,
    calibratedScoreNumeric: summary.normalizedScore,
    canEditScoreAdjustments: Boolean(options?.canEditScoreAdjustments),
    selfAssessmentEnabled: summary.selfAssessmentEnabled,
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
  | "calibratedScoreNumeric";

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
  }>(
    `UPDATE appraisals
     SET ${setClauses.join(",\n         ")}
     WHERE id = $${values.length}
     RETURNING id,
       credit_hrs_erp_score_adj::text,
       pub_oric_score_adj::text,
       qec_score_adj::text,
       calibration_factor::text,
       calibrated_score_numeric::text`,
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
  },
): Promise<{
  updatedCount: number;
  employeeIds: string[];
  roleCategory?: string | null;
}> {
  const uniqueIds = [...new Set(employeeIds.map((id) => id.trim()).filter(Boolean))];

  if (uniqueIds.length === 0) {
    throw new FormSubmissionError("At least one employeeId is required.", 400);
  }

  const updatesRole = "roleCategory" in fields;

  if (!updatesRole) {
    throw new FormSubmissionError(
      "Provide roleCategory to update.",
      400,
    );
  }

  if (updatesRole && !(await hasRoleCategoryColumn())) {
    throw new FormSubmissionError(
      "Role category column is not available. Run the excel-sheet columns migration.",
      503,
    );
  }

  const setClauses: string[] = [];
  const values: unknown[] = [uniqueIds];

  if (updatesRole) {
    values.push(fields.roleCategory ?? null);
    setClauses.push(`role_category = $${values.length}`);
  }

  const result = await db.query<{ employee_id: string }>(
    `UPDATE users
     SET ${setClauses.join(", ")}
     WHERE employee_id = ANY($1::text[])
     RETURNING employee_id`,
    values,
  );

  if (result.rows.length === 0) {
    throw new FormSubmissionError("No matching employees found.", 404);
  }

  return {
    updatedCount: result.rows.length,
    employeeIds: result.rows.map((row) => row.employee_id),
    ...(updatesRole ? { roleCategory: fields.roleCategory ?? null } : {}),
  };
}
