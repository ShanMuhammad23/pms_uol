import "server-only";

import type { PoolClient } from "pg";
import { db } from "../db";
import { upsertIncrementMatrices } from "./increment-matrices";
import type {
  EmployeeCategory,
  FieldType,
  FormTemplateInput,
  FormTemplateListItem,
  FormTemplateRecord,
  SubCategory,
} from "@/types/forms";

interface FormTemplateListRow {
  id: string;
  title: string;
  description: string | null;
  cycle_id: number;
  fiscal_year: number;
  target_category: EmployeeCategory;
  target_sub_category: SubCategory;
  question_count: string;
  appraisal_count: string;
  created_at: string;
  updated_at: string;
}

interface FormTemplateRow {
  id: string;
  title: string;
  description: string | null;
  cycle_id: number;
  fiscal_year: number;
  target_category: EmployeeCategory;
  target_sub_category: SubCategory;
  created_at: string;
  updated_at: string;
}

interface QuestionRow {
  id: string;
  question_text: string;
  input_type: FieldType;
  is_required: boolean;
  sort_order: number;
}

interface OptionRow {
  id: string;
  question_id: string;
  option_label: string;
  points_assigned: number;
  sort_order: number;
}

export class FormTemplateError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "FormTemplateError";
  }
}

async function checkDuplicateTarget(
  cycleId: number,
  targetCategory: EmployeeCategory,
  targetSubCategory: SubCategory,
  excludeId?: number,
  client?: PoolClient,
): Promise<void> {
  const executor = client ?? db;
  const params: Array<number | EmployeeCategory | SubCategory> = [
    cycleId,
    targetCategory,
    targetSubCategory,
  ];

  let query = `SELECT id FROM form_templates
               WHERE cycle_id = $1 AND target_category = $2 AND target_sub_category = $3`;

  if (excludeId !== undefined) {
    query += " AND id != $4";
    params.push(excludeId);
  }

  const result = await executor.query(query, params);

  if (result.rows.length > 0) {
    throw new FormTemplateError(
      "A form template already exists for this cycle, category, and sub-category combination.",
      409,
    );
  }
}

async function insertQuestionsAndOptions(
  templateId: number,
  input: FormTemplateInput,
  client: PoolClient,
): Promise<void> {
  for (const question of input.questions) {
    const questionResult = await client.query<{ id: string }>(
      `INSERT INTO form_questions (template_id, question_text, input_type, is_required, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        templateId,
        question.questionText,
        question.inputType,
        question.isRequired,
        question.sortOrder,
      ],
    );

    const questionId = Number(questionResult.rows[0].id);

    for (const option of question.options) {
      await client.query(
        `INSERT INTO question_options (question_id, option_label, points_assigned, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [questionId, option.optionLabel, option.pointsAssigned, option.sortOrder],
      );
    }
  }
}

async function getQuestionsForTemplate(
  templateId: number,
  client?: PoolClient,
): Promise<FormTemplateRecord["questions"]> {
  const executor = client ?? db;

  const questionsResult = await executor.query<QuestionRow>(
    `SELECT id, question_text, input_type, is_required, sort_order
     FROM form_questions
     WHERE template_id = $1
     ORDER BY sort_order ASC`,
    [templateId],
  );

  const questions: FormTemplateRecord["questions"] = [];

  for (const question of questionsResult.rows) {
    const optionsResult = await executor.query<OptionRow>(
      `SELECT id, question_id, option_label, points_assigned, sort_order
       FROM question_options
       WHERE question_id = $1
       ORDER BY sort_order ASC`,
      [question.id],
    );

    questions.push({
      id: Number(question.id),
      questionText: question.question_text,
      inputType: question.input_type,
      isRequired: question.is_required,
      sortOrder: question.sort_order,
      options: optionsResult.rows.map((option) => ({
        id: Number(option.id),
        optionLabel: option.option_label,
        pointsAssigned: option.points_assigned,
        sortOrder: option.sort_order,
      })),
    });
  }

  return questions;
}

export async function listFormTemplates(): Promise<FormTemplateListItem[]> {
  const result = await db.query<FormTemplateListRow>(
    `SELECT
       ft.id,
       ft.title,
       ft.description,
       ft.cycle_id,
       ac.fiscal_year,
       ft.target_category,
       ft.target_sub_category,
       COUNT(DISTINCT fq.id)::text AS question_count,
       COUNT(DISTINCT ap_linked.appraisal_id)::text AS appraisal_count,
       ft.created_at::text,
       ft.updated_at::text
     FROM form_templates ft
     INNER JOIN appraisal_cycles ac ON ac.id = ft.cycle_id
     LEFT JOIN form_questions fq ON fq.template_id = ft.id
     LEFT JOIN (
       SELECT ap.id AS appraisal_id, ft_match.id AS template_id
       FROM appraisals ap
       INNER JOIN users u ON u.id = ap.employee_id
       INNER JOIN form_templates ft_match ON ft_match.cycle_id = ap.cycle_id
         AND ft_match.target_category = u.emp_category
         AND ft_match.target_sub_category = u.emp_sub_category
     ) ap_linked ON ap_linked.template_id = ft.id
     GROUP BY ft.id, ac.fiscal_year
     ORDER BY ft.updated_at DESC`,
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    description: row.description,
    cycleId: row.cycle_id,
    fiscalYear: row.fiscal_year,
    targetCategory: row.target_category,
    targetSubCategory: row.target_sub_category,
    questionCount: Number(row.question_count),
    appraisalCount: Number(row.appraisal_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getFormTemplateById(
  id: number,
): Promise<FormTemplateRecord | null> {
  const result = await db.query<FormTemplateRow>(
    `SELECT
       ft.id,
       ft.title,
       ft.description,
       ft.cycle_id,
       ac.fiscal_year,
       ft.target_category,
       ft.target_sub_category,
       ft.created_at::text,
       ft.updated_at::text
     FROM form_templates ft
     INNER JOIN appraisal_cycles ac ON ac.id = ft.cycle_id
     WHERE ft.id = $1`,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const { getIncrementMatricesByCycleId } = await import("./increment-matrices");

  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    cycleId: row.cycle_id,
    fiscalYear: row.fiscal_year,
    targetCategory: row.target_category,
    targetSubCategory: row.target_sub_category,
    questions: await getQuestionsForTemplate(Number(row.id)),
    incrementMatrices: await getIncrementMatricesByCycleId(row.cycle_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createFormTemplate(
  input: FormTemplateInput,
  createdById?: number,
): Promise<FormTemplateRecord> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await checkDuplicateTarget(
      input.cycleId,
      input.targetCategory,
      input.targetSubCategory,
      undefined,
      client,
    );

    const templateResult = await client.query<{ id: string }>(
      `INSERT INTO form_templates (
         title,
         description,
         cycle_id,
         target_category,
         target_sub_category,
         created_by
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.title,
        input.description || null,
        input.cycleId,
        input.targetCategory,
        input.targetSubCategory,
        createdById ?? null,
      ],
    );

    const templateId = Number(templateResult.rows[0].id);

    await insertQuestionsAndOptions(templateId, input, client);
    await upsertIncrementMatrices(input.cycleId, input.incrementMatrices, client);

    await client.query("COMMIT");

    const created = await getFormTemplateById(templateId);
    if (!created) {
      throw new FormTemplateError("Failed to load created form template.", 500);
    }

    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateFormTemplate(
  id: number,
  input: FormTemplateInput,
): Promise<FormTemplateRecord> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query<{ id: string }>(
      `SELECT id FROM form_templates WHERE id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      throw new FormTemplateError("Form template not found.", 404);
    }

    await checkDuplicateTarget(
      input.cycleId,
      input.targetCategory,
      input.targetSubCategory,
      id,
      client,
    );

    await client.query(
      `UPDATE form_templates
       SET title = $1,
           description = $2,
           cycle_id = $3,
           target_category = $4,
           target_sub_category = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [
        input.title,
        input.description || null,
        input.cycleId,
        input.targetCategory,
        input.targetSubCategory,
        id,
      ],
    );

    await client.query(`DELETE FROM form_questions WHERE template_id = $1`, [id]);
    await insertQuestionsAndOptions(id, input, client);
    await upsertIncrementMatrices(input.cycleId, input.incrementMatrices, client);

    await client.query("COMMIT");

    const updated = await getFormTemplateById(id);
    if (!updated) {
      throw new FormTemplateError("Failed to load updated form template.", 500);
    }

    return updated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteFormTemplate(id: number): Promise<{
  appraisalCount: number;
}> {
  const appraisalResult = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM appraisals ap
     INNER JOIN users u ON u.id = ap.employee_id
     INNER JOIN form_templates ft ON ft.id = $1
     WHERE ap.cycle_id = ft.cycle_id
       AND u.emp_category = ft.target_category
       AND u.emp_sub_category = ft.target_sub_category`,
    [id],
  );

  const appraisalCount = Number(appraisalResult.rows[0]?.count ?? 0);

  const result = await db.query(
    `DELETE FROM form_templates WHERE id = $1 RETURNING id`,
    [id],
  );

  if (result.rows.length === 0) {
    throw new FormTemplateError("Form template not found.", 404);
  }

  return { appraisalCount };
}
