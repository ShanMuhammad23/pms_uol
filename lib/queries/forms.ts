import "server-only";

import type { PoolClient } from "pg";
import { db } from "../db";
import { upsertIncrementMatrices } from "./increment-matrices";
import { getAppraisalCycleById, getDefaultAppraisalCycle, ensureDefaultAppraisalCycle } from "./appraisal-cycles";
import type {
  EmployeeCategory,
  FieldType,
  FormSectionInput,
  FormTemplateInput,
  FormTemplateListItem,
  FormTemplateRecord,
  QuestionInput,
  QuestionOptionInput,
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

interface SectionRow {
  id: string;
  parent_section_id: string | null;
  title: string;
  sort_order: number;
}

interface QuestionRow {
  id: string;
  section_id: string | null;
  question_text: string;
  input_type: FieldType;
  is_required: boolean;
  sort_order: number;
  self_assessment_enabled: boolean;
  hod_assessment_enabled: boolean;
  total_marks: number;
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
    public meta?: { existingFormId?: number; existingFormTitle?: string },
  ) {
    super(message);
    this.name = "FormTemplateError";
  }
}

const APPRAISAL_ANSWER_BLOCK_MESSAGE =
  "This form has appraisal answers linked to questions that would be removed. Delete or archive those answers first, or only edit question text/options in place.";

async function resolveCycleId(cycleId?: number): Promise<number> {
  if (cycleId) {
    const selected = await getAppraisalCycleById(cycleId);
    if (!selected) {
      throw new FormTemplateError("Selected appraisal cycle was not found.", 400);
    }
    return cycleId;
  }

  const cycle =
    (await getDefaultAppraisalCycle()) ?? (await ensureDefaultAppraisalCycle());

  return cycle.id;
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

  let query = `SELECT id, title FROM form_templates
               WHERE cycle_id = $1 AND target_category = $2 AND target_sub_category = $3`;

  if (excludeId !== undefined) {
    query += " AND id != $4";
    params.push(excludeId);
  }

  const result = await executor.query<{ id: string; title: string }>(
    query,
    params,
  );

  if (result.rows.length > 0) {
    throw new FormTemplateError(
      "A form template already exists for this cycle, category, and sub-category combination.",
      409,
      {
        existingFormId: Number(result.rows[0].id),
        existingFormTitle: result.rows[0].title,
      },
    );
  }
}

async function assertQuestionCanBeDeleted(
  questionId: number,
  client: PoolClient,
): Promise<void> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM appraisal_answers
     WHERE question_id = $1`,
    [questionId],
  );

  if (Number(result.rows[0]?.count ?? 0) > 0) {
    throw new FormTemplateError(APPRAISAL_ANSWER_BLOCK_MESSAGE, 409);
  }
}

async function assertOptionCanBeDeleted(
  optionId: number,
  client: PoolClient,
): Promise<void> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM appraisal_answers
     WHERE selected_option_id = $1`,
    [optionId],
  );

  if (Number(result.rows[0]?.count ?? 0) > 0) {
    throw new FormTemplateError(APPRAISAL_ANSWER_BLOCK_MESSAGE, 409);
  }
}

async function insertQuestionWithOptions(
  templateId: number,
  question: QuestionInput,
  sectionId: number | null,
  client: PoolClient,
): Promise<number> {
  const questionResult = await client.query<{ id: string }>(
    `INSERT INTO form_questions (
       template_id,
       section_id,
       question_text,
       input_type,
       is_required,
       sort_order,
       self_assessment_enabled,
       hod_assessment_enabled,
       total_marks
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      templateId,
      sectionId,
      question.questionText,
      question.inputType,
      question.isRequired,
      question.sortOrder,
      question.selfAssessmentEnabled,
      question.hodAssessmentEnabled,
      question.totalMarks,
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

  return questionId;
}

async function syncOptions(
  questionId: number,
  options: QuestionOptionInput[],
  client: PoolClient,
): Promise<void> {
  const existingResult = await client.query<{ id: string }>(
    `SELECT id FROM question_options WHERE question_id = $1`,
    [questionId],
  );
  const existingIds = new Set(
    existingResult.rows.map((row) => Number(row.id)),
  );
  const inputIds = new Set(
    options.flatMap((option) => (option.id !== undefined ? [option.id] : [])),
  );

  for (const existingId of existingIds) {
    if (!inputIds.has(existingId)) {
      await assertOptionCanBeDeleted(existingId, client);
      await client.query(`DELETE FROM question_options WHERE id = $1`, [
        existingId,
      ]);
    }
  }

  for (const option of options) {
    if (option.id !== undefined) {
      await client.query(
        `UPDATE question_options
         SET option_label = $1,
             points_assigned = $2,
             sort_order = $3
         WHERE id = $4 AND question_id = $5`,
        [
          option.optionLabel,
          option.pointsAssigned,
          option.sortOrder,
          option.id,
          questionId,
        ],
      );
      continue;
    }

    await client.query(
      `INSERT INTO question_options (question_id, option_label, points_assigned, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [questionId, option.optionLabel, option.pointsAssigned, option.sortOrder],
    );
  }
}

async function syncQuestion(
  templateId: number,
  question: QuestionInput,
  sectionId: number | null,
  client: PoolClient,
): Promise<number> {
  if (question.id !== undefined) {
    const updated = await client.query(
      `UPDATE form_questions
       SET section_id = $1,
           question_text = $2,
           input_type = $3,
           is_required = $4,
           sort_order = $5,
           self_assessment_enabled = $6,
           hod_assessment_enabled = $7,
           total_marks = $8
       WHERE id = $9 AND template_id = $10`,
      [
        sectionId,
        question.questionText,
        question.inputType,
        question.isRequired,
        question.sortOrder,
        question.selfAssessmentEnabled,
        question.hodAssessmentEnabled,
        question.totalMarks,
        question.id,
        templateId,
      ],
    );

    if (updated.rowCount === 0) {
      throw new FormTemplateError("One or more questions could not be updated.", 400);
    }

    await syncOptions(question.id, question.options, client);
    return question.id;
  }

  return insertQuestionWithOptions(templateId, question, sectionId, client);
}

async function upsertSection(
  templateId: number,
  section: Pick<FormSectionInput, "id" | "title" | "sortOrder">,
  parentSectionId: number | null,
  client: PoolClient,
): Promise<number> {
  if (section.id !== undefined) {
    await client.query(
      `UPDATE form_sections
       SET title = $1,
           sort_order = $2,
           parent_section_id = $3
       WHERE id = $4 AND template_id = $5`,
      [
        section.title,
        section.sortOrder,
        parentSectionId,
        section.id,
        templateId,
      ],
    );
    return section.id;
  }

  const sectionResult = await client.query<{ id: string }>(
    `INSERT INTO form_sections (template_id, parent_section_id, title, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [templateId, parentSectionId, section.title, section.sortOrder],
  );

  return Number(sectionResult.rows[0].id);
}

function collectStructureIds(input: FormTemplateInput): {
  sectionIds: Set<number>;
  questionIds: Set<number>;
} {
  const sectionIds = new Set<number>();
  const questionIds = new Set<number>();

  for (const section of input.sections) {
    if (section.id !== undefined) {
      sectionIds.add(section.id);
    }

    for (const question of section.questions) {
      if (question.id !== undefined) {
        questionIds.add(question.id);
      }
    }

    for (const subsection of section.subsections) {
      if (subsection.id !== undefined) {
        sectionIds.add(subsection.id);
      }

      for (const question of subsection.questions) {
        if (question.id !== undefined) {
          questionIds.add(question.id);
        }
      }
    }
  }

  for (const question of input.questions) {
    if (question.id !== undefined) {
      questionIds.add(question.id);
    }
  }

  return { sectionIds, questionIds };
}

async function syncFormStructure(
  templateId: number,
  input: FormTemplateInput,
  client: PoolClient,
): Promise<void> {
  const { sectionIds, questionIds } = collectStructureIds(input);

  const existingQuestions = await client.query<{ id: string }>(
    `SELECT id FROM form_questions WHERE template_id = $1`,
    [templateId],
  );

  for (const row of existingQuestions.rows) {
    const questionId = Number(row.id);
    if (!questionIds.has(questionId)) {
      await assertQuestionCanBeDeleted(questionId, client);
      await client.query(`DELETE FROM form_questions WHERE id = $1`, [
        questionId,
      ]);
    }
  }

  const existingSections = await client.query<{
    id: string;
    parent_section_id: string | null;
  }>(`SELECT id, parent_section_id FROM form_sections WHERE template_id = $1`, [
    templateId,
  ]);

  const sectionsToDelete = existingSections.rows.filter(
    (row) => !sectionIds.has(Number(row.id)),
  );
  const subsectionsToDelete = sectionsToDelete.filter(
    (row) => row.parent_section_id,
  );
  const topSectionsToDelete = sectionsToDelete.filter(
    (row) => !row.parent_section_id,
  );

  for (const row of [...subsectionsToDelete, ...topSectionsToDelete]) {
    await client.query(`DELETE FROM form_sections WHERE id = $1`, [row.id]);
  }

  for (const section of input.sections) {
    const sectionId = await upsertSection(templateId, section, null, client);

    for (const question of section.questions) {
      await syncQuestion(templateId, question, sectionId, client);
    }

    for (const subsection of section.subsections) {
      const subsectionId = await upsertSection(
        templateId,
        subsection,
        sectionId,
        client,
      );

      for (const question of subsection.questions) {
        await syncQuestion(templateId, question, subsectionId, client);
      }
    }
  }

  for (const question of input.questions) {
    await syncQuestion(templateId, question, null, client);
  }
}

async function insertSectionsAndQuestions(
  templateId: number,
  input: FormTemplateInput,
  client: PoolClient,
): Promise<void> {
  for (const section of input.sections) {
    const sectionResult = await client.query<{ id: string }>(
      `INSERT INTO form_sections (template_id, parent_section_id, title, sort_order)
       VALUES ($1, NULL, $2, $3)
       RETURNING id`,
      [templateId, section.title, section.sortOrder],
    );

    const sectionId = Number(sectionResult.rows[0].id);

    for (const question of section.questions) {
      await insertQuestionWithOptions(templateId, question, sectionId, client);
    }

    for (const subsection of section.subsections) {
      const subsectionResult = await client.query<{ id: string }>(
        `INSERT INTO form_sections (template_id, parent_section_id, title, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [templateId, sectionId, subsection.title, subsection.sortOrder],
      );

      const subsectionId = Number(subsectionResult.rows[0].id);

      for (const question of subsection.questions) {
        await insertQuestionWithOptions(
          templateId,
          question,
          subsectionId,
          client,
        );
      }
    }
  }

  for (const question of input.questions) {
    await insertQuestionWithOptions(templateId, question, null, client);
  }
}

function mapQuestionRow(
  question: QuestionRow,
  optionsByQuestionId: Map<number, FormTemplateRecord["questions"][number]["options"]>,
): FormTemplateRecord["questions"][number] {
  return {
    id: Number(question.id),
    questionText: question.question_text,
    inputType: question.input_type,
    isRequired: question.is_required,
    sortOrder: question.sort_order,
    selfAssessmentEnabled: question.self_assessment_enabled,
    hodAssessmentEnabled: question.hod_assessment_enabled,
    totalMarks: question.total_marks,
    sectionId: question.section_id ? Number(question.section_id) : undefined,
    options: optionsByQuestionId.get(Number(question.id)) ?? [],
  };
}

async function getOptionsByQuestionId(
  questionIds: string[],
  client?: PoolClient,
): Promise<Map<number, FormTemplateRecord["questions"][number]["options"]>> {
  const optionsByQuestionId = new Map<
    number,
    FormTemplateRecord["questions"][number]["options"]
  >();

  if (questionIds.length === 0) {
    return optionsByQuestionId;
  }

  const executor = client ?? db;
  const optionsResult = await executor.query<OptionRow>(
    `SELECT id, question_id, option_label, points_assigned, sort_order
     FROM question_options
     WHERE question_id = ANY($1::bigint[])
     ORDER BY sort_order ASC`,
    [questionIds],
  );

  for (const option of optionsResult.rows) {
    const questionId = Number(option.question_id);
    const existing = optionsByQuestionId.get(questionId) ?? [];
    existing.push({
      id: Number(option.id),
      optionLabel: option.option_label,
      pointsAssigned: option.points_assigned,
      sortOrder: option.sort_order,
    });
    optionsByQuestionId.set(questionId, existing);
  }

  return optionsByQuestionId;
}

async function getFormStructureForTemplate(
  templateId: number,
  client?: PoolClient,
): Promise<{
  sections: FormTemplateRecord["sections"];
  questions: FormTemplateRecord["questions"];
}> {
  const executor = client ?? db;

  const sectionsResult = await executor.query<SectionRow>(
    `SELECT id, parent_section_id, title, sort_order
     FROM form_sections
     WHERE template_id = $1
     ORDER BY sort_order ASC`,
    [templateId],
  );

  const questionsResult = await executor.query<QuestionRow>(
    `SELECT
       id,
       section_id,
       question_text,
       input_type,
       is_required,
       sort_order,
       self_assessment_enabled,
       hod_assessment_enabled,
       total_marks
     FROM form_questions
     WHERE template_id = $1
     ORDER BY sort_order ASC`,
    [templateId],
  );

  const optionsByQuestionId = await getOptionsByQuestionId(
    questionsResult.rows.map((question) => question.id),
    client,
  );

  const questionsBySectionId = new Map<number, FormTemplateRecord["questions"]>();
  const rootQuestions: FormTemplateRecord["questions"] = [];

  for (const question of questionsResult.rows) {
    const mapped = mapQuestionRow(question, optionsByQuestionId);

    if (!question.section_id) {
      rootQuestions.push(mapped);
      continue;
    }

    const sectionId = Number(question.section_id);
    const existing = questionsBySectionId.get(sectionId) ?? [];
    existing.push(mapped);
    questionsBySectionId.set(sectionId, existing);
  }

  const topLevelSections = sectionsResult.rows.filter(
    (section) => !section.parent_section_id,
  );

  const sections: FormTemplateRecord["sections"] = [];

  for (const section of topLevelSections) {
    const sectionId = Number(section.id);
    const subsections = sectionsResult.rows
      .filter((row) => row.parent_section_id === section.id)
      .map((subsection) => ({
        id: Number(subsection.id),
        title: subsection.title,
        sortOrder: subsection.sort_order,
        questions: questionsBySectionId.get(Number(subsection.id)) ?? [],
      }));

    sections.push({
      id: sectionId,
      title: section.title,
      sortOrder: section.sort_order,
      subsections,
      questions: questionsBySectionId.get(sectionId) ?? [],
    });
  }

  return { sections, questions: rootQuestions };
}

export async function getFormTemplateAppraisalCount(
  templateId: number,
): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(DISTINCT ap_linked.appraisal_id)::text AS count
     FROM form_templates ft
     LEFT JOIN (
       SELECT ap.id AS appraisal_id, ft_match.id AS template_id
       FROM appraisals ap
       INNER JOIN users u ON u.id = ap.employee_id
       INNER JOIN form_templates ft_match ON ft_match.cycle_id = ap.cycle_id
         AND ft_match.target_category = u.emp_category
         AND ft_match.target_sub_category = u.emp_sub_category
     ) ap_linked ON ap_linked.template_id = ft.id
     WHERE ft.id = $1`,
    [templateId],
  );

  return Number(result.rows[0]?.count ?? 0);
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
  const structure = await getFormStructureForTemplate(Number(row.id));

  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    cycleId: row.cycle_id,
    fiscalYear: row.fiscal_year,
    targetCategory: row.target_category,
    targetSubCategory: row.target_sub_category,
    sections: structure.sections,
    questions: structure.questions,
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

    const cycleId = await resolveCycleId(input.cycleId);

    await checkDuplicateTarget(
      cycleId,
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
        cycleId,
        input.targetCategory,
        input.targetSubCategory,
        createdById ?? null,
      ],
    );

    const templateId = Number(templateResult.rows[0].id);

    await insertSectionsAndQuestions(templateId, input, client);

    if (input.incrementMatrices && input.incrementMatrices.length > 0) {
      await upsertIncrementMatrices(cycleId, input.incrementMatrices, client);
    }

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

    const existing = await client.query<{ id: string; cycle_id: number }>(
      `SELECT id, cycle_id FROM form_templates WHERE id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      throw new FormTemplateError("Form template not found.", 404);
    }

    const cycleId = await resolveCycleId(
      input.cycleId ?? Number(existing.rows[0].cycle_id),
    );

    await checkDuplicateTarget(
      cycleId,
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
        cycleId,
        input.targetCategory,
        input.targetSubCategory,
        id,
      ],
    );

    await syncFormStructure(id, input, client);

    if (input.incrementMatrices && input.incrementMatrices.length > 0) {
      await upsertIncrementMatrices(cycleId, input.incrementMatrices, client);
    }

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

export async function assignFormTemplateToEmployees(
  templateId: number,
  employeeCodes: string[],
): Promise<{ assignedCount: number; templateId: number }> {
  const normalizedCodes = [...new Set(employeeCodes.map((code) => code.trim()).filter(Boolean))];
  if (normalizedCodes.length === 0) {
    throw new FormTemplateError("At least one employee is required.", 400);
  }

  const templateResult = await db.query<{ id: string; cycle_id: number }>(
    `SELECT id, cycle_id
     FROM form_templates
     WHERE id = $1`,
    [templateId],
  );

  if (!templateResult.rows[0]) {
    throw new FormTemplateError("Form template not found.", 404);
  }

  const cycleId = Number(templateResult.rows[0].cycle_id);

  const result = await db.query<{ employee_id: string }>(
    `WITH selected_users AS (
       SELECT id, employee_id
       FROM users
       WHERE employee_id = ANY($1::text[])
         AND is_active = TRUE
     ),
     assigned AS (
       INSERT INTO employee_form_assignments (employee_id, template_id)
       SELECT su.id, $2
       FROM selected_users su
       ON CONFLICT (employee_id, template_id) DO UPDATE
         SET updated_at = CURRENT_TIMESTAMP
       RETURNING employee_id
     ),
     touched_appraisals AS (
       INSERT INTO appraisals (employee_id, cycle_id, template_id, status)
       SELECT su.id, $3, $2, 'PENDING_SELF_ASSESSMENT'
       FROM selected_users su
       ON CONFLICT (employee_id, template_id) DO UPDATE
         SET cycle_id = EXCLUDED.cycle_id,
             template_id = EXCLUDED.template_id,
             updated_at = CURRENT_TIMESTAMP
       RETURNING employee_id
     )
     SELECT su.employee_id
     FROM selected_users su`,
    [normalizedCodes, templateId, cycleId],
  );

  if (result.rows.length === 0) {
    throw new FormTemplateError("No matching active employees found.", 404);
  }

  return {
    assignedCount: result.rows.length,
    templateId,
  };
}

export async function listFormTemplateAssignedEmployees(
  templateId: number,
): Promise<Array<{ employeeId: string; employeeName: string; email: string | null }>> {
  const result = await db.query<{
    employee_id: string;
    employee_name: string;
    email: string | null;
  }>(
    `SELECT
       u.employee_id,
       CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
       u.email
     FROM employee_form_assignments efa
     INNER JOIN users u ON u.id = efa.employee_id
     WHERE efa.template_id = $1
     ORDER BY u.first_name, u.last_name, u.employee_id`,
    [templateId],
  );

  return result.rows.map((row) => ({
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    email: row.email,
  }));
}
