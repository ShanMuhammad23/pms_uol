import "server-only";

import { db } from "@/lib/db";
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
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
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
  initial_rating: PerformanceRating | null;
  calibrated_rating: PerformanceRating | null;
  submitted_at: string;
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

export async function listFormSubmissions(): Promise<FormSubmissionListItem[]> {
  const [result, quartileBands] = await Promise.all([
    db.query<SubmissionListRow>(
      `SELECT
         ap.id,
         u.employee_id,
         CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
         u.email AS employee_email,
         ap.template_id,
         ft.title AS template_title,
         ft.staff_category_id,
         sc.name AS staff_category_name,
         ft.staff_sub_category_id,
         ssc.name AS staff_sub_category_name,
         u.entity_id,
         ent.name AS entity_name,
         parent_ent.name AS parent_entity_name,
         ap.status,
         ap.system_raw_score,
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
       FROM appraisals ap
       INNER JOIN users u ON u.id = ap.employee_id
       LEFT JOIN form_templates ft ON ft.id = ap.template_id
       LEFT JOIN staff_categories sc ON sc.id = ft.staff_category_id
       LEFT JOIN staff_sub_categories ssc ON ssc.id = ft.staff_sub_category_id
       LEFT JOIN entities ent ON ent.id = u.entity_id
       LEFT JOIN entities parent_ent ON parent_ent.id = ent.parent_entity_id
       WHERE ap.submitted_at IS NOT NULL
       ORDER BY ap.submitted_at DESC`,
    ),
    getActiveFinancialYearQuartileBands(),
  ]);

  return result.rows.map((row) => {
    const rawScore = row.system_raw_score;
    const maxRawScore = Number(row.max_raw_score);
    const scorePercent = calculateScorePercent(rawScore, maxRawScore);
    const resolved = resolvePerformanceQuartile(scorePercent, quartileBands);

    return {
      id: Number(row.id),
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      employeeEmail: row.employee_email,
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
      performanceLevelName: resolved?.performanceLevelName ?? null,
      quartileName: resolved?.quartileName ?? null,
      initialRating: row.initial_rating,
      calibratedRating: row.calibrated_rating,
      submittedAt: row.submitted_at,
    };
  });
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
    ...summary,
    quartileScoreMin: resolved?.scoreMin ?? null,
    quartileScoreMax: resolved?.scoreMax ?? null,
    templateDescription,
    sections,
    rootQuestions,
    questions,
    answers,
  };
}
