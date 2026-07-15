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
import type { EmployeeFormAnswerRecord } from "@/types/employee-forms";
import type {
  FormSubmissionDetail,
  FormSubmissionListItem,
} from "@/types/form-submissions";
import type { AppraisalStatus, PerformanceRating } from "@/types/forms";
import { flattenAllQuestions } from "@/types/forms";

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
  employee_id: string;
  employee_name: string;
  employee_email: string;
  designation: string | null;
  grade_group: string | null;
  date_of_joining: string | null;
  emp_category: string | null;
  emp_sub_category: string | null;
  template_id: number | null;
  template_title: string | null;
  staff_category_id: number | null;
  staff_category_name: string | null;
  staff_sub_category_id: number | null;
  staff_sub_category_name: string | null;
  entity_id: string | null;
  entity_name: string | null;
  parent_entity_name: string | null;
  status: AppraisalStatus;
  system_raw_score: number;
  max_raw_score: string;
  initial_score_numeric: string | null;
  initial_rating: PerformanceRating | null;
  credit_hrs_erp_score_adj: string | null;
  pub_oric_score_adj: string | null;
  calibration_factor: string | null;
  normalized_score: string | null;
  calibrated_score_numeric: string | null;
  calibrated_rating: PerformanceRating | null;
  stored_quartile_name: string | null;
  uol_experience_years: string | null;
  is_eligible: boolean | null;
  applicable_duration: string | null;
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
  const result = await db.query<{
    question_id: string;
    text_response: string | null;
    selected_option_id: string | null;
    points_earned: number;
  }>(
    `SELECT question_id, text_response, selected_option_id, points_earned
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
    pointsEarned: row.points_earned,
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
  const rawScore = row.system_raw_score ?? 0;
  const maxRawScore = Number(row.max_raw_score);
  const scorePercent = calculateScorePercent(rawScore, maxRawScore);
  const resolved = resolvePerformanceQuartile(scorePercent, quartileBands);
  const scoreO = toNumber(row.initial_score_numeric) ?? rawScore;
  const normalizedScore =
    toNumber(row.normalized_score) ?? toNumber(row.calibrated_score_numeric);
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
    gradeGroup: row.grade_group,
    dateOfJoining: row.date_of_joining,
    empCategory: row.emp_category,
    empSubCategory: row.emp_sub_category,
    templateId: row.template_id,
    templateTitle: row.template_title,
    staffCategoryId: row.staff_category_id,
    staffCategoryName: row.staff_category_name,
    staffSubCategoryId: row.staff_sub_category_id,
    staffSubCategoryName: row.staff_sub_category_name,
    entityId: row.entity_id ? Number(row.entity_id) : null,
    entityName: row.entity_name,
    parentEntityName: row.parent_entity_name,
    status: row.status,
    rawScore,
    maxRawScore,
    scorePercent,
    scoreO,
    ratingO: row.initial_rating,
    creditHrsErpScoreAdj: toNumber(row.credit_hrs_erp_score_adj),
    pubOricScoreAdj: toNumber(row.pub_oric_score_adj),
    calibrationFactor: toNumber(row.calibration_factor),
    normalizedScore,
    ratingN: row.calibrated_rating,
    performanceLevelName: resolved?.performanceLevelName ?? null,
    quartileName: row.stored_quartile_name ?? resolved?.quartileName ?? null,
    initialRating: row.initial_rating,
    calibratedRating: row.calibrated_rating,
    uolExperienceYears:
      toNumber(row.uol_experience_years) ?? eligibility.uolExperienceYears,
    isEligible: row.is_eligible ?? eligibility.isEligible,
    applicableDuration: row.applicable_duration ?? eligibility.applicableDuration,
    eligibilityStatus: eligibility.status,
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

  const financialYear = financialYearResult.rows[0]?.year ?? cycleResult?.fiscalYear ?? null;
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

function formatReferenceDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function listFormSubmissions(): Promise<FormSubmissionListItem[]> {
  const [excelReady, qualsReady, quartileBands, eligibilityContext] =
    await Promise.all([
    hasExcelSheetColumns(),
    hasQualificationsTable(),
    getActiveFinancialYearQuartileBands(),
    getEligibilityContext(),
  ]);

  const excelSelect = excelReady
    ? `
         u.designation,
         u.grade_group,
         u.date_of_joining::text,
         u.emp_category::text AS emp_category,
         u.emp_sub_category::text AS emp_sub_category,
         ap.initial_score_numeric::text,
         ap.credit_hrs_erp_score_adj::text,
         ap.pub_oric_score_adj::text,
         ap.calibration_factor::text,
         ap.normalized_score::text,
         ap.calibrated_score_numeric::text,
         pq.name AS stored_quartile_name,
         ap.uol_experience_years::text,
         ap.is_eligible,
         ap.applicable_duration,
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
         NULL::text AS grade_group,
         NULL::text AS date_of_joining,
         u.emp_category::text AS emp_category,
         u.emp_sub_category::text AS emp_sub_category,
         NULL::text AS initial_score_numeric,
         NULL::text AS credit_hrs_erp_score_adj,
         NULL::text AS pub_oric_score_adj,
         NULL::text AS calibration_factor,
         NULL::text AS normalized_score,
         NULL::text AS calibrated_score_numeric,
         NULL::text AS stored_quartile_name,
         NULL::text AS uol_experience_years,
         NULL::boolean AS is_eligible,
         NULL::text AS applicable_duration,
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

  const result = await db.query<SubmissionListRow>(
    `SELECT
       ap.id,
       u.employee_id,
       CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
       u.email AS employee_email,
       ${excelSelect}
       ${qualSelect}
       ap.template_id,
       ft.title AS template_title,
       COALESCE(ft.staff_category_id, u.staff_category_id) AS staff_category_id,
       COALESCE(sc.name, sc_user.name) AS staff_category_name,
       COALESCE(ft.staff_sub_category_id, u.staff_sub_category_id) AS staff_sub_category_id,
       COALESCE(ssc.name, ssc_user.name) AS staff_sub_category_name,
       u.entity_id,
       ent.name AS entity_name,
       parent_ent.name AS parent_entity_name,
       COALESCE(ap.status, 'PENDING_SELF_ASSESSMENT') AS status,
       COALESCE(ap.system_raw_score, 0) AS system_raw_score,
       ap.initial_rating,
       ap.calibrated_rating,
       COALESCE(
         (
           SELECT SUM(fq.total_marks)::text
           FROM form_questions fq
           WHERE fq.template_id = ap.template_id
             AND fq.input_type = 'NUMBER'
             AND fq.total_marks > 0
         ),
         '0'
       ) AS max_raw_score,
       ap.submitted_at::text
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
     LEFT JOIN staff_categories sc ON sc.id = ft.staff_category_id
     LEFT JOIN staff_sub_categories ssc ON ssc.id = ft.staff_sub_category_id
     LEFT JOIN staff_categories sc_user ON sc_user.id = u.staff_category_id
     LEFT JOIN staff_sub_categories ssc_user ON ssc_user.id = u.staff_sub_category_id
     LEFT JOIN entities ent ON ent.id = u.entity_id
     LEFT JOIN entities parent_ent ON parent_ent.id = ent.parent_entity_id
     ${quartileJoin}
     ${qualJoin}
     WHERE u.is_active = TRUE
       AND u.employee_id <> 'EMP-0001'
     ORDER BY u.first_name, u.last_name, u.employee_id`,
    [eligibilityContext.cycleId],
  );

  return result.rows.map((row) =>
    mapSubmissionRow(row, quartileBands, {
      financialYear: eligibilityContext.financialYear,
      cycleEndDate: eligibilityContext.cycleEndDate,
    }),
  );
}

export async function getFormSubmissionById(
  id: number,
): Promise<FormSubmissionDetail | null> {
  const submissions = await listFormSubmissions();
  const summary = submissions.find((item) => item.id === id);

  if (!summary) {
    return null;
  }

  const employeeResult = await db.query<{ user_id: string }>(
    `SELECT ap.employee_id::text AS user_id
     FROM appraisals ap
     WHERE ap.id = $1`,
    [id],
  );

  const employeeUserId = Number(employeeResult.rows[0]?.user_id);
  if (!employeeUserId) {
    return null;
  }

  const answers = await getAnswersForSubmission(id, employeeUserId);

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
    staffCategoryName: summary.staffCategoryName,
    staffSubCategoryName: summary.staffSubCategoryName,
    status: summary.status,
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
  };
}
