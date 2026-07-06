import "server-only";

import type { PoolClient } from "pg";
import { db } from "@/lib/db";
import { getFormTemplateById } from "@/lib/queries/forms";
import type {
  AssignedFormListItem,
  EmployeeFormAnswerInput,
  EmployeeFormAnswerRecord,
  EmployeeFormDetail,
  EmployeeFormStatus,
  SaveEmployeeFormInput,
} from "@/types/employee-forms";
import type { FormTemplateRecord, QuestionRecord } from "@/types/forms";
import { flattenAllQuestions } from "@/types/forms";

function getTemplateQuestions(template: FormTemplateRecord): QuestionRecord[] {
  return flattenAllQuestions(template);
}

interface UserStaffRow {
  id: string;
  staff_category_id: number | null;
  staff_sub_category_id: number | null;
}

interface AppraisalRow {
  id: string;
  status: string;
  submitted_at: string | null;
  updated_at: string;
  system_raw_score: number;
}

export class EmployeeFormError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "EmployeeFormError";
  }
}

async function getUserStaffCategories(
  userId: number,
  client?: PoolClient,
): Promise<UserStaffRow> {
  const executor = client ?? db;
  const result = await executor.query<UserStaffRow>(
    `SELECT id, staff_category_id, staff_sub_category_id
     FROM users
     WHERE id = $1`,
    [userId],
  );

  if (result.rows.length === 0) {
    throw new EmployeeFormError("User not found.", 404);
  }

  return result.rows[0];
}

async function getAssignedTemplateForUser(
  userId: number,
  client?: PoolClient,
): Promise<{
  templateId: number;
  title: string;
  description: string | null;
  staffCategoryName: string | null;
  staffSubCategoryName: string | null;
  questionCount: number;
} | null> {
  const user = await getUserStaffCategories(userId, client);

  if (!user.staff_category_id || !user.staff_sub_category_id) {
    return null;
  }

  const executor = client ?? db;
  const result = await executor.query<{
    id: string;
    title: string;
    description: string | null;
    staff_category_name: string | null;
    staff_sub_category_name: string | null;
    question_count: string;
  }>(
    `SELECT
       ft.id,
       ft.title,
       ft.description,
       sc.name AS staff_category_name,
       ssc.name AS staff_sub_category_name,
       COUNT(fq.id)::text AS question_count
     FROM form_templates ft
     LEFT JOIN staff_categories sc ON sc.id = ft.staff_category_id
     LEFT JOIN staff_sub_categories ssc ON ssc.id = ft.staff_sub_category_id
     LEFT JOIN form_questions fq ON fq.template_id = ft.id
     WHERE ft.staff_category_id = $1
       AND ft.staff_sub_category_id = $2
     GROUP BY ft.id, sc.name, ssc.name
     LIMIT 1`,
    [user.staff_category_id, user.staff_sub_category_id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    templateId: Number(row.id),
    title: row.title,
    description: row.description,
    staffCategoryName: row.staff_category_name,
    staffSubCategoryName: row.staff_sub_category_name,
    questionCount: Number(row.question_count),
  };
}

async function assertTemplateAssignedToUser(
  userId: number,
  templateId: number,
  client?: PoolClient,
): Promise<void> {
  const assigned = await getAssignedTemplateForUser(userId, client);

  if (!assigned || assigned.templateId !== templateId) {
    throw new EmployeeFormError("This form is not assigned to you.", 403);
  }
}

function resolveFormStatus(
  appraisal: AppraisalRow | null,
  answerCount: number,
): EmployeeFormStatus {
  if (!appraisal) {
    return "NOT_STARTED";
  }

  if (appraisal.submitted_at) {
    return "SUBMITTED";
  }

  return answerCount > 0 ? "DRAFT" : "NOT_STARTED";
}

async function getAppraisalForUserTemplate(
  userId: number,
  templateId: number,
  client?: PoolClient,
): Promise<AppraisalRow | null> {
  const executor = client ?? db;
  const result = await executor.query<AppraisalRow>(
    `SELECT
       id,
       status,
       submitted_at::text,
       updated_at::text,
       system_raw_score
     FROM appraisals
     WHERE employee_id = $1
       AND template_id = $2
     LIMIT 1`,
    [userId, templateId],
  );

  return result.rows[0] ?? null;
}

async function getAnswersForAppraisal(
  appraisalId: number,
  userId: number,
  client?: PoolClient,
): Promise<EmployeeFormAnswerRecord[]> {
  const executor = client ?? db;
  const result = await executor.query<{
    question_id: string;
    text_response: string | null;
    selected_option_id: string | null;
    points_earned: number;
  }>(
    `SELECT question_id, text_response, selected_option_id, points_earned
     FROM appraisal_answers
     WHERE appraisal_id = $1
       AND filled_by_id = $2`,
    [appraisalId, userId],
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

async function getOrCreateAppraisal(
  userId: number,
  templateId: number,
  client: PoolClient,
): Promise<AppraisalRow> {
  const existing = await getAppraisalForUserTemplate(userId, templateId, client);
  if (existing) {
    return existing;
  }

  const result = await client.query<AppraisalRow>(
    `INSERT INTO appraisals (employee_id, template_id, status)
     VALUES ($1, $2, 'PENDING_SELF_ASSESSMENT')
     RETURNING id, status, submitted_at::text, updated_at::text, system_raw_score`,
    [userId, templateId],
  );

  return result.rows[0];
}

function isScoredQuestion(question: QuestionRecord): boolean {
  return question.totalMarks > 0 && question.inputType === "NUMBER";
}

function calculateRawScore(
  template: FormTemplateRecord,
  answers: Array<{ questionId: number; pointsEarned: number }>,
): number {
  const answerMap = new Map(
    answers.map((answer) => [answer.questionId, answer.pointsEarned]),
  );

  return getTemplateQuestions(template)
    .filter(isScoredQuestion)
    .reduce((sum, question) => sum + (answerMap.get(question.id) ?? 0), 0);
}

function calculateMaxRawScore(template: FormTemplateRecord): number {
  return getTemplateQuestions(template)
    .filter(isScoredQuestion)
    .reduce((sum, question) => sum + question.totalMarks, 0);
}

function validateAnswers(
  template: FormTemplateRecord,
  answers: EmployeeFormAnswerInput[],
  submit: boolean,
): EmployeeFormAnswerInput[] {
  const answerMap = new Map(
    answers.map((answer) => [answer.questionId, answer]),
  );

  for (const question of getTemplateQuestions(template)) {
    const answer = answerMap.get(question.id);
    const isScored = isScoredQuestion(question);

    if (!submit && !question.isRequired && !isScored) {
      continue;
    }

    if (submit && isScored && !answer) {
      throw new EmployeeFormError(
        `Enter a score for "${question.questionText.slice(0, 80)}".`,
      );
    }

    if (submit && question.isRequired && !isScored && !answer) {
      throw new EmployeeFormError(
        `Question "${question.questionText.slice(0, 80)}" is required.`,
      );
    }

    if (!answer) {
      continue;
    }

    if (isScored || question.inputType === "NUMBER") {
      const value = answer.pointsEarned ?? Number(answer.textResponse);
      if (Number.isNaN(value)) {
        throw new EmployeeFormError(
          `Enter a valid score for "${question.questionText.slice(0, 80)}".`,
        );
      }
      if (value < 0 || value > question.totalMarks) {
        throw new EmployeeFormError(
          `Score for "${question.questionText.slice(0, 80)}" must be between 0 and ${question.totalMarks}.`,
        );
      }
    }

    if (["TEXT", "TEXTAREA"].includes(question.inputType)) {
      if (submit && question.isRequired && !answer.textResponse?.trim()) {
        throw new EmployeeFormError(
          `Question "${question.questionText.slice(0, 80)}" is required.`,
        );
      }
    }

    if (["RADIO", "SELECT"].includes(question.inputType)) {
      if (submit && question.isRequired && !answer.selectedOptionId) {
        throw new EmployeeFormError(
          `Select an option for "${question.questionText.slice(0, 80)}".`,
        );
      }
    }

    if (question.inputType === "CHECKBOX") {
      if (submit && question.isRequired && !answer.selectedOptionId) {
        throw new EmployeeFormError(
          `Select at least one option for "${question.questionText.slice(0, 80)}".`,
        );
      }
    }
  }

  return answers;
}

function normalizeAnswer(
  template: FormTemplateRecord,
  answer: EmployeeFormAnswerInput,
): {
  textResponse: string | null;
  selectedOptionId: number | null;
  pointsEarned: number;
} {
  const question = getTemplateQuestions(template).find(
    (item) => item.id === answer.questionId,
  );

  if (!question) {
    throw new EmployeeFormError("One or more answers reference invalid questions.");
  }

  if (question.inputType === "NUMBER" || isScoredQuestion(question)) {
    const pointsEarned = Number(
      answer.pointsEarned ?? answer.textResponse ?? 0,
    );
    return {
      textResponse: String(pointsEarned),
      selectedOptionId: null,
      pointsEarned,
    };
  }

  if (["RADIO", "SELECT", "CHECKBOX"].includes(question.inputType)) {
    const option = question.options.find(
      (item) => item.id === answer.selectedOptionId,
    );

    return {
      textResponse: null,
      selectedOptionId: answer.selectedOptionId ?? null,
      pointsEarned: option?.pointsAssigned ?? 0,
    };
  }

  return {
    textResponse: answer.textResponse?.trim() || null,
    selectedOptionId: null,
    pointsEarned: 0,
  };
}

export async function listAssignedFormsForUser(
  userId: number,
): Promise<AssignedFormListItem[]> {
  const assigned = await getAssignedTemplateForUser(userId);

  if (!assigned) {
    return [];
  }

  const appraisal = await getAppraisalForUserTemplate(
    userId,
    assigned.templateId,
  );
  const answers = appraisal
    ? await getAnswersForAppraisal(Number(appraisal.id), userId)
    : [];

  return [
    {
      templateId: assigned.templateId,
      title: assigned.title,
      description: assigned.description,
      staffCategoryName: assigned.staffCategoryName,
      staffSubCategoryName: assigned.staffSubCategoryName,
      questionCount: assigned.questionCount,
      status: resolveFormStatus(appraisal, answers.length),
      submittedAt: appraisal?.submitted_at ?? null,
      updatedAt: appraisal?.updated_at ?? null,
    },
  ];
}

export async function getEmployeeFormDetail(
  userId: number,
  templateId: number,
): Promise<EmployeeFormDetail> {
  await assertTemplateAssignedToUser(userId, templateId);

  const template = await getFormTemplateById(templateId);
  if (!template) {
    throw new EmployeeFormError("Form not found.", 404);
  }

  const appraisal = await getAppraisalForUserTemplate(userId, templateId);
  const answers = appraisal
    ? await getAnswersForAppraisal(Number(appraisal.id), userId)
    : [];

  const normalizedAnswers = answers.map((answer) => {
    const normalized = normalizeAnswer(template, answer);
    return {
      questionId: answer.questionId,
      pointsEarned: normalized.pointsEarned,
    };
  });

  const rawScore = calculateRawScore(template, normalizedAnswers);
  const maxRawScore = calculateMaxRawScore(template);

  return {
    template,
    appraisalId: appraisal ? Number(appraisal.id) : null,
    status: resolveFormStatus(appraisal, answers.length),
    submittedAt: appraisal?.submitted_at ?? null,
    answers,
    rawScore: appraisal?.submitted_at
      ? appraisal.system_raw_score
      : rawScore,
    maxRawScore,
  };
}

export async function saveEmployeeForm(
  userId: number,
  templateId: number,
  input: SaveEmployeeFormInput,
): Promise<EmployeeFormDetail> {
  await assertTemplateAssignedToUser(userId, templateId);

  const template = await getFormTemplateById(templateId);
  if (!template) {
    throw new EmployeeFormError("Form not found.", 404);
  }

  const submit = Boolean(input.submit);
  const validatedAnswers = validateAnswers(template, input.answers, submit);
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existing = await getAppraisalForUserTemplate(
      userId,
      templateId,
      client,
    );

    if (existing?.submitted_at) {
      throw new EmployeeFormError(
        "This form has already been submitted and cannot be edited.",
        409,
      );
    }

    const appraisal = await getOrCreateAppraisal(userId, templateId, client);

    const normalizedAnswers: Array<{
      questionId: number;
      normalized: ReturnType<typeof normalizeAnswer>;
    }> = [];

    for (const answer of validatedAnswers) {
      const normalized = normalizeAnswer(template, answer);
      normalizedAnswers.push({ questionId: answer.questionId, normalized });

      await client.query(
        `INSERT INTO appraisal_answers (
           appraisal_id,
           question_id,
           filled_by_id,
           text_response,
           selected_option_id,
           points_earned
         ) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (appraisal_id, question_id, filled_by_id)
         DO UPDATE SET
           text_response = EXCLUDED.text_response,
           selected_option_id = EXCLUDED.selected_option_id,
           points_earned = EXCLUDED.points_earned,
           updated_at = CURRENT_TIMESTAMP`,
        [
          appraisal.id,
          answer.questionId,
          userId,
          normalized.textResponse,
          normalized.selectedOptionId,
          normalized.pointsEarned,
        ],
      );
    }

    if (submit) {
      const savedAnswers = await getAnswersForAppraisal(
        Number(appraisal.id),
        userId,
        client,
      );

      for (const question of getTemplateQuestions(template).filter(isScoredQuestion)) {
        const saved = savedAnswers.find(
          (answer) => answer.questionId === question.id,
        );

        if (!saved || saved.textResponse === null) {
          throw new EmployeeFormError(
            `Enter a score for "${question.questionText.slice(0, 80)}".`,
          );
        }

        const score = saved.pointsEarned;
        if (score < 0 || score > question.totalMarks) {
          throw new EmployeeFormError(
            `Score for "${question.questionText.slice(0, 80)}" must be between 0 and ${question.totalMarks}.`,
          );
        }
      }

      const rawScore = calculateRawScore(
        template,
        savedAnswers.map((answer) => ({
          questionId: answer.questionId,
          pointsEarned: answer.pointsEarned,
        })),
      );

      await client.query(
        `UPDATE appraisals
         SET system_raw_score = $1,
             submitted_at = CURRENT_TIMESTAMP,
             status = 'PENDING_HEAD_REVIEW',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [rawScore, appraisal.id],
      );
    } else {
      await client.query(
        `UPDATE appraisals
         SET updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [appraisal.id],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return getEmployeeFormDetail(userId, templateId);
}
