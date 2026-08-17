import "server-only";

import type { PoolClient } from "pg";
import { computeAppraisalEligibility } from "@/lib/appraisal-eligibility";
import { db } from "@/lib/db";
import {
  resolveSelfAssessmentAdvance,
  toEmployeeManagers,
} from "@/app/helpers/manager-review";
import { getFormTemplateById } from "@/lib/queries/forms";
import { getReturnHistory } from "@/lib/queries/form-submissions";
import {
  deleteFormAttachmentFile,
  resolveFormAttachmentAbsolutePath,
  storeFormAttachmentFile,
  ALLOWED_FORM_ATTACHMENT_MIME_TYPES,
  MAX_FORM_ATTACHMENT_BYTES,
} from "@/lib/uploads/form-attachments";
import type {
  AssignedFormListItem,
  EmployeeAssessmentEligibilityStatus,
  EmployeeFormAnswerAttachment,
  EmployeeFormAnswerInput,
  EmployeeFormAnswerRecord,
  EmployeeFormDetail,
  EmployeeFormStatus,
  SaveEmployeeFormInput,
} from "@/types/employee-forms";
import type {
  AppraisalStatus,
  FormTemplateRecord,
  QuestionRecord,
} from "@/types/forms";
import { APPRAISAL_STATUSES, flattenAllQuestions } from "@/types/forms";

function getTemplateQuestions(template: FormTemplateRecord): QuestionRecord[] {
  return flattenAllQuestions(template);
}

interface AppraisalRow {
  id: string;
  status: string;
  submitted_at: string | null;
  updated_at: string;
  system_raw_score: string;
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

type UserAssessmentEligibilityContext = {
  assessmentEligibility: boolean;
  ineligibilityReason: string | null;
  dateOfJoining: string | null;
};

type ResolvedAssessmentEligibility = {
  assessmentEligibility: boolean;
  eligibilityStatus: EmployeeAssessmentEligibilityStatus;
  canFillAssessment: boolean;
  ineligibilityReason: string | null;
};

async function getUserAssessmentEligibilityContext(
  userId: number,
  client?: PoolClient,
): Promise<UserAssessmentEligibilityContext> {
  const executor = client ?? db;
  const result = await executor.query<{
    assessment_eligibility: boolean;
    ineligibility_reason: string | null;
    date_of_joining: string | null;
  }>(
    `SELECT
       COALESCE(assessment_eligibility, true) AS assessment_eligibility,
       ineligibility_reason,
       date_of_joining::text AS date_of_joining
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId],
  );

  const row = result.rows[0];
  return {
    assessmentEligibility: row?.assessment_eligibility ?? true,
    ineligibilityReason: row?.ineligibility_reason ?? null,
    dateOfJoining: row?.date_of_joining ? row.date_of_joining.slice(0, 10) : null,
  };
}

function resolveEmployeeAssessmentEligibility(
  ctx: UserAssessmentEligibilityContext,
  financialYear: number | null | undefined,
): ResolvedAssessmentEligibility {
  if (!ctx.assessmentEligibility) {
    return {
      assessmentEligibility: false,
      eligibilityStatus: "Ineligible",
      canFillAssessment: false,
      ineligibilityReason: ctx.ineligibilityReason,
    };
  }

  const computed = computeAppraisalEligibility(ctx.dateOfJoining, {
    financialYear: financialYear ?? undefined,
  });

  return {
    assessmentEligibility: true,
    eligibilityStatus: computed.status,
    canFillAssessment: computed.isEligible,
    ineligibilityReason: null,
  };
}

async function assertUserCanFillAssessment(
  userId: number,
  fiscalYear: number,
  client?: PoolClient,
): Promise<void> {
  const ctx = await getUserAssessmentEligibilityContext(userId, client);
  const resolved = resolveEmployeeAssessmentEligibility(ctx, fiscalYear);
  if (!resolved.canFillAssessment) {
    const message =
      resolved.eligibilityStatus === "Ineligible"
        ? "Score editing is disabled: you are not eligible for assessment."
        : "Score editing is disabled: you are not eligible for this appraisal cycle based on your length of service.";
    throw new EmployeeFormError(message, 403);
  }
}

async function listExplicitlyAssignedTemplatesForUser(
  userId: number,
  client?: PoolClient,
): Promise<
  Array<{
    templateId: number;
    title: string;
    description: string | null;
    questionCount: number;
    selfAssessmentEnabled: boolean;
    fiscalYear: number;
  }>
> {
  const executor = client ?? db;
  const result = await executor.query<{
    id: string;
    title: string;
    description: string | null;
    question_count: string;
    self_assessment_disabled: boolean;
    fiscal_year: number;
  }>(
    `SELECT
       ft.id,
       ft.title,
       ft.description,
       efa.self_assessment_disabled,
       ac.fiscal_year,
       COUNT(fq.id)::text AS question_count
     FROM employee_form_assignments efa
     INNER JOIN form_templates ft ON ft.id = efa.template_id
     INNER JOIN appraisal_cycles ac ON ac.id = ft.cycle_id
     LEFT JOIN form_questions fq ON fq.template_id = ft.id
     WHERE efa.employee_id = $1
     GROUP BY ft.id, efa.self_assessment_disabled, ac.fiscal_year
     ORDER BY ft.id DESC`,
    [userId],
  );

  return result.rows.map((row) => ({
    templateId: Number(row.id),
    title: row.title,
    description: row.description,
    questionCount: Number(row.question_count),
    selfAssessmentEnabled: !row.self_assessment_disabled,
    fiscalYear: Number(row.fiscal_year),
  }));
}

async function assertTemplateAssignedToUser(
  userId: number,
  templateId: number,
  client?: PoolClient,
): Promise<void> {
  const explicitAssignments = await listExplicitlyAssignedTemplatesForUser(
    userId,
    client,
  );
  const matched = explicitAssignments.some(
    (template) => template.templateId === templateId,
  );
  if (!matched) {
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

function resolveAppraisalWorkflowStatus(
  appraisal: AppraisalRow | null,
  selfAssessmentEnabled = true,
): AppraisalStatus {
  const defaultStatus: AppraisalStatus = selfAssessmentEnabled
    ? "PENDING_SELF_ASSESSMENT"
    : "PENDING_HEAD_REVIEW";

  if (!appraisal?.status) {
    return defaultStatus;
  }

  if ((APPRAISAL_STATUSES as string[]).includes(appraisal.status)) {
    return appraisal.status as AppraisalStatus;
  }

  return defaultStatus;
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
    points_earned: string;
    remarks: string | null;
  }>(
    `SELECT question_id, text_response, selected_option_id, points_earned, remarks
     FROM appraisal_answers
     WHERE appraisal_id = $1
       AND filled_by_id = $2`,
    [appraisalId, userId],
  );

  const attachments = await listAttachmentsForAppraisal(
    appraisalId,
    userId,
    client,
  );
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
      remarks: row.remarks,
      attachments: attachmentsByQuestion.get(questionId) ?? [],
    };
  });
}

export async function listAttachmentsForAppraisal(
  appraisalId: number,
  userId: number,
  client?: PoolClient,
): Promise<EmployeeFormAnswerAttachment[]> {
  const executor = client ?? db;

  const result = await executor.query<{
    id: string;
    question_id: string;
    original_filename: string;
    mime_type: string | null;
    size_bytes: string;
    created_at: string;
  }>(
    `SELECT id, question_id, original_filename, mime_type, size_bytes::text, created_at::text
     FROM appraisal_answer_attachments
     WHERE appraisal_id = $1
       AND filled_by_id = $2
     ORDER BY created_at ASC, id ASC`,
    [appraisalId, userId],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    questionId: Number(row.question_id),
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at,
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

  const template = await getFormTemplateById(templateId);
  if (!template) {
    throw new EmployeeFormError("Form not found.", 404);
  }

  const assignment = await listExplicitlyAssignedTemplatesForUser(userId, client);
  const matched = assignment.find((a) => a.templateId === templateId);
  const selfAssessmentEnabled = matched?.selfAssessmentEnabled ?? template.selfAssessmentEnabled;

  const initialStatus = selfAssessmentEnabled
    ? "PENDING_SELF_ASSESSMENT"
    : "PENDING_HEAD_REVIEW";

  const result = await client.query<AppraisalRow>(
    `INSERT INTO appraisals (employee_id, template_id, status)
     VALUES ($1, $2, $3)
     RETURNING id, status, submitted_at::text, updated_at::text, system_raw_score`,
    [userId, templateId, initialStatus],
  );

  return result.rows[0];
}

function isScoredQuestion(question: QuestionRecord): boolean {
  return Number(question.totalMarks) > 0;
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
    .reduce((sum, question) => sum + Number(question.totalMarks), 0);
}

function validateAnswers(
  template: FormTemplateRecord,
  answers: EmployeeFormAnswerInput[],
  submit: boolean,
  selfAssessmentEnabled: boolean,
): EmployeeFormAnswerInput[] {
  const formSelfAssessmentEnabled = selfAssessmentEnabled;

  // Build a set of question IDs that the employee is allowed to answer.
  // Questions with selfAssessmentEnabled=false (or when form-level
  // self-assessment is disabled) are restricted to manager/HOD only.
  const allowedQuestionIds = new Set(
    getTemplateQuestions(template)
      .filter(
        (question) =>
          formSelfAssessmentEnabled && question.selfAssessmentEnabled,
      )
      .map((question) => question.id),
  );

  // Strip out any answers for restricted questions — the employee must not
  // be able to persist scores or remarks for HOD-only questions, even via
  // direct API requests.
  const filteredAnswers = answers.filter((answer) =>
    allowedQuestionIds.has(answer.questionId),
  );

  const answerMap = new Map(
    filteredAnswers.map((answer) => [answer.questionId, answer]),
  );

  for (const question of getTemplateQuestions(template)) {
    // Skip HOD-only questions — employee self-assessment should not validate them
    // Also skip all questions when form-level self-assessment is disabled
    if (!formSelfAssessmentEnabled || !question.selfAssessmentEnabled) {
      continue;
    }

    const answer = answerMap.get(question.id);
    const isScored = isScoredQuestion(question);

    if (!submit && !question.isRequired && !isScored) {
      continue;
    }

    if (submit && isScored && question.isRequired && !answer) {
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

    if (isScored) {
      // Optional scored questions may be skipped (or have remarks only)
      if (answer.pointsEarned === undefined || answer.pointsEarned === null) {
        if (question.isRequired) {
          throw new EmployeeFormError(
            `Enter a score for "${question.questionText.slice(0, 80)}".`,
          );
        }
        continue;
      }

      const value = Number(answer.pointsEarned);
      if (Number.isNaN(value)) {
        throw new EmployeeFormError(
          `Enter a valid score for "${question.questionText.slice(0, 80)}".`,
        );
      }
      if (value < 0 || value > Number(question.totalMarks)) {
        throw new EmployeeFormError(
          `Score for "${question.questionText.slice(0, 80)}" must be between 0 and ${question.totalMarks}.`,
        );
      }
    } else if (question.inputType === "NUMBER") {
      const value = answer.pointsEarned ?? Number(answer.textResponse);
      if (Number.isNaN(value)) {
        throw new EmployeeFormError(
          `Enter a valid number for "${question.questionText.slice(0, 80)}".`,
        );
      }
    }

    if (["TEXT", "TEXTAREA"].includes(question.inputType)) {
      // Employee fill is score + optional remarks; narrative text is not required.
      continue;
    }

    if (["RADIO", "SELECT"].includes(question.inputType)) {
      // Options are display-only on the employee fill screen.
      continue;
    }

    if (question.inputType === "CHECKBOX") {
      continue;
    }
  }

  return filteredAnswers;
}

function normalizeAnswer(
  template: FormTemplateRecord,
  answer: EmployeeFormAnswerInput,
): {
  textResponse: string | null;
  selectedOptionId: number | null;
  pointsEarned: number;
  remarks: string | null;
} {
  const question = getTemplateQuestions(template).find(
    (item) => item.id === answer.questionId,
  );

  if (!question) {
    throw new EmployeeFormError("One or more answers reference invalid questions.");
  }

  const remarks = answer.remarks?.trim() || null;
  const scoredPoints = isScoredQuestion(question)
    ? Number(answer.pointsEarned ?? 0)
    : 0;

  if (question.inputType === "NUMBER" || isScoredQuestion(question)) {
    const pointsEarned = Number(answer.pointsEarned ?? 0);
    return {
      textResponse: null,
      selectedOptionId: null,
      pointsEarned,
      remarks,
    };
  }

  if (["RADIO", "SELECT", "CHECKBOX"].includes(question.inputType)) {
    const option = question.options.find(
      (item) => item.id === answer.selectedOptionId,
    );

    return {
      textResponse: null,
      selectedOptionId: answer.selectedOptionId ?? null,
      pointsEarned: option?.pointsAssigned ?? scoredPoints,
      remarks,
    };
  }

  return {
    textResponse: answer.textResponse?.trim() || null,
    selectedOptionId: null,
    pointsEarned: scoredPoints,
    remarks,
  };
}

export async function listAssignedFormsForUser(
  userId: number,
): Promise<AssignedFormListItem[]> {
  const explicitAssignments = await listExplicitlyAssignedTemplatesForUser(userId);
  const eligibilityCtx = await getUserAssessmentEligibilityContext(userId);

  return Promise.all(
    explicitAssignments.map(async (assigned) => {
      const appraisal = await getAppraisalForUserTemplate(userId, assigned.templateId);
      const eligibility = resolveEmployeeAssessmentEligibility(
        eligibilityCtx,
        assigned.fiscalYear,
      );

      return {
        templateId: assigned.templateId,
        title: assigned.title,
        description: assigned.description,
        questionCount: assigned.questionCount,
        status: resolveAppraisalWorkflowStatus(appraisal, assigned.selfAssessmentEnabled),
        selfAssessmentEnabled: assigned.selfAssessmentEnabled,
        submittedAt: appraisal?.submitted_at ?? null,
        updatedAt: appraisal?.updated_at ?? null,
        eligibilityStatus: eligibility.eligibilityStatus,
        canFillAssessment: eligibility.canFillAssessment,
        ineligibilityReason: eligibility.ineligibilityReason,
      } satisfies AssignedFormListItem;
    }),
  );
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

  const assignments = await listExplicitlyAssignedTemplatesForUser(userId);
  const matchedAssignment = assignments.find((a) => a.templateId === templateId);
  const selfAssessmentEnabled = matchedAssignment?.selfAssessmentEnabled ?? template.selfAssessmentEnabled;

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

  const eligibilityCtx = await getUserAssessmentEligibilityContext(userId);
  const eligibility = resolveEmployeeAssessmentEligibility(
    eligibilityCtx,
    template.fiscalYear,
  );

  const managerResult = await db.query<{ head_name: string | null; manager_2_name: string | null }>(
    `SELECT CONCAT(h.first_name, ' ', h.last_name) AS head_name,
            CONCAT(m2.first_name, ' ', m2.last_name) AS manager_2_name
     FROM users u
     LEFT JOIN users h ON h.id = u.head_id
     LEFT JOIN users m2 ON m2.id = u.manager_2_id
     WHERE u.id = $1 LIMIT 1`,
    [userId],
  );
  const headName = managerResult.rows[0]?.head_name ?? null;
  const manager2Name = managerResult.rows[0]?.manager_2_name ?? null;

  // Fetch return history — for the employee view, only show returns to
  // "employee" and "manager1" levels (not manager2).
  const returnHistory = appraisal
    ? (await getReturnHistory(Number(appraisal.id))).filter(
        (entry) => entry.returnLevel === "employee" || entry.returnLevel === "manager1",
      )
    : [];

  return {
    template,
    appraisalId: appraisal ? Number(appraisal.id) : null,
    status: resolveFormStatus(appraisal, answers.length),
    submittedAt: appraisal?.submitted_at ?? null,
    answers,
    rawScore: appraisal?.submitted_at
      ? Number(appraisal.system_raw_score)
      : rawScore,
    maxRawScore,
    selfAssessmentEnabled,
    assessmentEligibility: eligibility.assessmentEligibility,
    eligibilityStatus: eligibility.eligibilityStatus,
    canFillAssessment: eligibility.canFillAssessment,
    ineligibilityReason: eligibility.ineligibilityReason,
    headName,
    manager2Name,
    returnHistory,
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

  await assertUserCanFillAssessment(userId, template.fiscalYear);

  const submit = Boolean(input.submit);
  const assignments = await listExplicitlyAssignedTemplatesForUser(userId);
  const matchedAssignment = assignments.find((a) => a.templateId === templateId);
  const selfAssessmentEnabled = matchedAssignment?.selfAssessmentEnabled ?? template.selfAssessmentEnabled;
  const validatedAnswers = validateAnswers(template, input.answers, submit, selfAssessmentEnabled);
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
           points_earned,
           remarks
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (appraisal_id, question_id, filled_by_id)
         DO UPDATE SET
           text_response = EXCLUDED.text_response,
           selected_option_id = EXCLUDED.selected_option_id,
           points_earned = EXCLUDED.points_earned,
           remarks = EXCLUDED.remarks,
           updated_at = CURRENT_TIMESTAMP`,
        [
          appraisal.id,
          answer.questionId,
          userId,
          normalized.textResponse,
          normalized.selectedOptionId,
          normalized.pointsEarned,
          normalized.remarks,
        ],
      );
    }

    if (submit) {
      const savedAnswers = await getAnswersForAppraisal(
        Number(appraisal.id),
        userId,
        client,
      );

      const formSelfAssessmentEnabled = selfAssessmentEnabled;

      for (const question of getTemplateQuestions(template).filter(
        (q) =>
          isScoredQuestion(q) &&
          formSelfAssessmentEnabled &&
          q.selfAssessmentEnabled &&
          q.isRequired,
      )) {
        const saved = savedAnswers.find(
          (answer) => answer.questionId === question.id,
        );

        if (!saved) {
          throw new EmployeeFormError(
            `Enter a score for "${question.questionText.slice(0, 80)}".`,
          );
        }

        const score = Number(saved.pointsEarned);
        const maxMarks = Number(question.totalMarks);
        if (Number.isNaN(score) || score < 0 || score > maxMarks) {
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

      // Fetch the employee's manager assignments to determine the correct
      // next workflow status. When both Manager 1 and Manager 2 are NULL,
      // the Manager Review stage is bypassed and the submission transitions
      // directly to HR Alignment (PENDING_HR_CALIBRATION).
      const managerResult = await client.query<{
        head_id: string | null;
        manager_2_id: string | null;
      }>(
        `SELECT head_id, manager_2_id FROM users WHERE id = $1`,
        [userId],
      );
      const managerRow = managerResult.rows[0];
      const managers = toEmployeeManagers({
        headId: managerRow?.head_id ? Number(managerRow.head_id) : null,
        manager2Id: managerRow?.manager_2_id
          ? Number(managerRow.manager_2_id)
          : null,
      });
      const advance = resolveSelfAssessmentAdvance(managers);

      await client.query(
        `UPDATE appraisals
         SET system_raw_score = $1,
             submitted_at = CURRENT_TIMESTAMP,
             status = $2,
             manager_level = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [rawScore, advance.status, advance.managerLevel, appraisal.id],
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

export async function addEmployeeFormAttachment(
  userId: number,
  templateId: number,
  questionId: number,
  file: {
    originalFilename: string;
    mimeType: string | null;
    bytes: Buffer;
  },
): Promise<EmployeeFormAnswerAttachment> {
  await assertTemplateAssignedToUser(userId, templateId);

  const template = await getFormTemplateById(templateId);
  if (!template) {
    throw new EmployeeFormError("Form not found.", 404);
  }

  await assertUserCanFillAssessment(userId, template.fiscalYear);

  const question = getTemplateQuestions(template).find(
    (item) => item.id === questionId,
  );
  if (!question) {
    throw new EmployeeFormError("Question not found on this form.", 404);
  }

  if (file.bytes.byteLength === 0) {
    throw new EmployeeFormError("Empty files are not allowed.", 400);
  }

  if (file.bytes.byteLength > MAX_FORM_ATTACHMENT_BYTES) {
    throw new EmployeeFormError("Attachment must be 10 MB or smaller.", 400);
  }

  if (
    file.mimeType &&
    !ALLOWED_FORM_ATTACHMENT_MIME_TYPES.has(file.mimeType)
  ) {
    throw new EmployeeFormError(
      "Unsupported file type. Use PDF, image, Word, Excel, or plain text.",
      400,
    );
  }

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

    await client.query(
      `INSERT INTO appraisal_answers (
         appraisal_id,
         question_id,
         filled_by_id,
         text_response,
         selected_option_id,
         points_earned,
         remarks
       ) VALUES ($1, $2, $3, NULL, NULL, 0, NULL)
       ON CONFLICT (appraisal_id, question_id, filled_by_id) DO NOTHING`,
      [appraisal.id, questionId, userId],
    );

    const stored = await storeFormAttachmentFile({
      appraisalId: Number(appraisal.id),
      questionId,
      originalFilename: file.originalFilename,
      bytes: file.bytes,
    });

    const result = await client.query<{
      id: string;
      question_id: string;
      original_filename: string;
      mime_type: string | null;
      size_bytes: string;
      created_at: string;
    }>(
      `INSERT INTO appraisal_answer_attachments (
         appraisal_id,
         question_id,
         filled_by_id,
         original_filename,
         stored_filename,
         relative_path,
         mime_type,
         size_bytes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, question_id, original_filename, mime_type, size_bytes::text, created_at::text`,
      [
        appraisal.id,
        questionId,
        userId,
        file.originalFilename,
        stored.storedFilename,
        stored.relativePath,
        file.mimeType,
        file.bytes.byteLength,
      ],
    );

    await client.query("COMMIT");

    const row = result.rows[0];
    return {
      id: Number(row.id),
      questionId: Number(row.question_id),
      originalFilename: row.original_filename,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      createdAt: row.created_at,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getEmployeeFormAttachmentForDownload(
  userId: number,
  templateId: number,
  attachmentId: number,
): Promise<{
  absolutePath: string;
  originalFilename: string;
  mimeType: string | null;
}> {
  await assertTemplateAssignedToUser(userId, templateId);

  const result = await db.query<{
    relative_path: string;
    original_filename: string;
    mime_type: string | null;
    appraisal_employee_id: string;
  }>(
    `SELECT
       att.relative_path,
       att.original_filename,
       att.mime_type,
       ap.employee_id::text AS appraisal_employee_id
     FROM appraisal_answer_attachments att
     INNER JOIN appraisals ap ON ap.id = att.appraisal_id
     WHERE att.id = $1
       AND ap.template_id = $2`,
    [attachmentId, templateId],
  );

  if (result.rows.length === 0) {
    throw new EmployeeFormError("Attachment not found.", 404);
  }

  const row = result.rows[0];
  if (Number(row.appraisal_employee_id) !== userId) {
    throw new EmployeeFormError("Attachment not found.", 404);
  }

  return {
    absolutePath: resolveFormAttachmentAbsolutePath(row.relative_path),
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
  };
}

export async function deleteEmployeeFormAttachment(
  userId: number,
  templateId: number,
  attachmentId: number,
): Promise<void> {
  await assertTemplateAssignedToUser(userId, templateId);

  const appraisal = await getAppraisalForUserTemplate(userId, templateId);
  if (!appraisal) {
    throw new EmployeeFormError("Attachment not found.", 404);
  }
  if (appraisal.submitted_at) {
    throw new EmployeeFormError(
      "This form has already been submitted and cannot be edited.",
      409,
    );
  }

  const template = await getFormTemplateById(templateId);
  if (!template) {
    throw new EmployeeFormError("Form not found.", 404);
  }
  await assertUserCanFillAssessment(userId, template.fiscalYear);

  const result = await db.query<{ relative_path: string }>(
    `DELETE FROM appraisal_answer_attachments
     WHERE id = $1
       AND appraisal_id = $2
       AND filled_by_id = $3
     RETURNING relative_path`,
    [attachmentId, appraisal.id, userId],
  );

  if (result.rows.length === 0) {
    throw new EmployeeFormError("Attachment not found.", 404);
  }

  await deleteFormAttachmentFile(result.rows[0].relative_path);
}

/**
 * Reviewer-scoped attachment download.
 *
 * Unlike {@link getEmployeeFormAttachmentForDownload}, this does NOT restrict
 * the download to the employee who owns the appraisal. Access control is
 * enforced by the caller (the submission-detail API route validates that the
 * requesting user is authorised to view the submission). This lets Manager 1,
 * Manager 2, HR, Board, and Super Admin download attachments uploaded by the
 * employee throughout the assessment lifecycle.
 */
export async function getSubmissionAttachmentForDownload(
  submissionId: number,
  attachmentId: number,
): Promise<{
  absolutePath: string;
  originalFilename: string;
  mimeType: string | null;
}> {

  const result = await db.query<{
    relative_path: string;
    original_filename: string;
    mime_type: string | null;
  }>(
    `SELECT
       att.relative_path,
       att.original_filename,
       att.mime_type
     FROM appraisal_answer_attachments att
     INNER JOIN appraisals ap ON ap.id = att.appraisal_id
     WHERE att.id = $1
       AND ap.id = $2`,
    [attachmentId, submissionId],
  );

  if (result.rows.length === 0) {
    throw new EmployeeFormError("Attachment not found.", 404);
  }

  const row = result.rows[0];
  return {
    absolutePath: resolveFormAttachmentAbsolutePath(row.relative_path),
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
  };
}
