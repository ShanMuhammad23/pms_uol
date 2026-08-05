import "server-only";

import { db } from "@/lib/db";
import { getFormTemplateById } from "@/lib/queries/forms";
import { listAttachmentsForAppraisal } from "@/lib/queries/employee-forms";
import { flattenAllQuestions } from "@/types/forms";
import type { QuestionRecord, FormSectionRecord } from "@/types/forms";
import type {
  EmployeeFormAnswerAttachment,
  EmployeeFormAnswerRecord,
} from "@/types/employee-forms";
import {
  resolveEntitySubtreeIds,
} from "@/lib/queries/entity-scope";

export interface DirectAssessmentEmployee {
  submissionId: number;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  managerLevel: number | null;
  status: string;
  manager1UserId: number | null;
  manager2UserId: number | null;
  canEdit: boolean;
  designation: string | null;
  roleCategory: string | null;
  entityId: number | null;
  entityName: string | null;
  parentEntityName: string | null;
}

export interface DirectAssessmentOverallRemarks {
  manager1: string | null;
  manager2: string | null;
}

export interface DirectAssessmentData {
  templateId: number;
  templateTitle: string;
  selfAssessmentEnabled: boolean;
  /** Whether the form template has additional_remarks_enabled = TRUE. */
  additionalRemarksEnabled: boolean;
  questions: QuestionRecord[];
  sections: FormSectionRecord[];
  rootQuestions: QuestionRecord[];
  employees: DirectAssessmentEmployee[];
  /** Map of submissionId → array of manager answers for the current reviewer */
  managerAnswersBySubmission: Record<
    number,
    EmployeeFormAnswerRecord[]
  >;
  /** Map of submissionId → array of manager 1 answers (for manager 2 fallback) */
  manager1AnswersBySubmission: Record<
    number,
    EmployeeFormAnswerRecord[]
  >;
  /**
   * Map of submissionId → overall remarks (manager1 / manager2) stored on the
   * appraisal. Reuses the same columns as the standard assessment workflow so
   * Direct Assessment and standard assessment share one data model.
   */
  overallRemarksBySubmission: Record<number, DirectAssessmentOverallRemarks>;
}

interface AssignmentRow {
  appraisal_id: string | null;
  employee_code: string;
  employee_name: string;
  employee_email: string;
  status: string;
  manager_level: number | null;
  manager_1_user_id: string | null;
  manager_2_user_id: string | null;
  designation: string | null;
  role_category: string | null;
  entity_id: string | null;
  entity_name: string | null;
  parent_entity_name: string | null;
}

export async function getDirectAssessmentData(
  templateId: number,
  reviewerUserId: number,
  isHead: boolean,
  headEntityId: number | null,
): Promise<DirectAssessmentData | null> {
  const template = await getFormTemplateById(templateId);
  if (!template) {
    return null;
  }

  const questions = flattenAllQuestions(template);

  // Build visibility clause for head roles
  let visibilityClause = "";
  let visibilityParams: unknown[] = [];

  if (isHead) {
    const scopedEntityIds =
      headEntityId != null && Number.isFinite(headEntityId)
        ? await resolveEntitySubtreeIds(headEntityId)
        : [];

    if (scopedEntityIds.length > 0) {
      visibilityClause = `AND (
        u.entity_id = ANY($2::bigint[])
        OR u.head_id = $3
        OR u.manager_2_id = $3
      )`;
      visibilityParams = [scopedEntityIds, reviewerUserId];
    } else {
      visibilityClause = `AND (
        u.head_id = $2
        OR u.manager_2_id = $2
      )`;
      visibilityParams = [reviewerUserId];
    }
  }

  const templateParamIndex = isHead
    ? (visibilityParams.length === 2 ? 4 : 3)
    : 2;

  const result = await db.query<AssignmentRow>(
    `SELECT
       ap.id::text AS appraisal_id,
       u.employee_id AS employee_code,
       CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
       u.email AS employee_email,
       COALESCE(ap.status, 'PENDING_HEAD_REVIEW') AS status,
       ap.manager_level,
       u.head_id::text AS manager_1_user_id,
       u.manager_2_id::text AS manager_2_user_id,
       u.designation,
       u.role_category,
       u.entity_id::text AS entity_id,
       org.name AS entity_name,
       parent_org.name AS parent_entity_name
     FROM employee_form_assignments efa
     INNER JOIN users u ON u.id = efa.employee_id
     LEFT JOIN entities org ON org.id = u.entity_id
     LEFT JOIN entities parent_org ON parent_org.id = org.parent_entity_id
     LEFT JOIN LATERAL (
       SELECT ap_inner.*
       FROM appraisals ap_inner
       WHERE ap_inner.employee_id = u.id
         AND ap_inner.template_id = $${templateParamIndex}
       ORDER BY ap_inner.updated_at DESC NULLS LAST, ap_inner.id DESC
       LIMIT 1
     ) ap ON TRUE
     WHERE efa.template_id = $1
       AND efa.self_assessment_disabled = true
       AND u.is_active = TRUE
       AND u.employee_id <> 'EMP-0001'
       AND COALESCE(u.assessment_eligibility, true) = true
       ${visibilityClause}`,
    [templateId, ...visibilityParams, templateId],
  );

  const employees: DirectAssessmentEmployee[] = result.rows.map((row) => {
    const managerLevel = row.manager_level != null ? Number(row.manager_level) : null;
    const manager1UserId = row.manager_1_user_id ? Number(row.manager_1_user_id) : null;
    const manager2UserId = row.manager_2_user_id ? Number(row.manager_2_user_id) : null;
    const submissionId = row.appraisal_id ? Number(row.appraisal_id) : 0;
    const status = row.status;

    const assignedReviewerAtLevel =
      (managerLevel ?? 1) === 2 ? manager2UserId : manager1UserId;

    const canEdit =
      submissionId !== 0 &&
      status === "PENDING_HEAD_REVIEW" &&
      assignedReviewerAtLevel === reviewerUserId;

    return {
      submissionId,
      employeeId: row.employee_code,
      employeeName: row.employee_name,
      employeeEmail: row.employee_email,
      managerLevel,
      status,
      manager1UserId,
      manager2UserId,
      canEdit,
      designation: row.designation,
      roleCategory: row.role_category,
      entityId: row.entity_id ? Number(row.entity_id) : null,
      entityName: row.entity_name,
      parentEntityName: row.parent_entity_name,
    };
  });

  const managerAnswersBySubmission: Record<
    number,
    EmployeeFormAnswerRecord[]
  > = {};
  const manager1AnswersBySubmission: Record<
    number,
    EmployeeFormAnswerRecord[]
  > = {};

  for (const emp of employees) {
    if (emp.submissionId === 0) continue;

    if (emp.canEdit) {
      // Fetch the current reviewer's existing draft answers
      const existing = await getAnswersForSubmission(
        emp.submissionId,
        reviewerUserId,
      );
      managerAnswersBySubmission[emp.submissionId] = existing;
    } else {
      // For locked employees, fetch answers from whoever last reviewed
      const lastReviewerId =
        (emp.managerLevel ?? 1) === 2
          ? emp.manager2UserId ?? emp.manager1UserId
          : emp.manager1UserId;
      if (lastReviewerId != null) {
        const lockedAnswers = await getAnswersForSubmission(
          emp.submissionId,
          lastReviewerId,
        );
        managerAnswersBySubmission[emp.submissionId] = lockedAnswers;
      }
    }

    // Always fetch Manager 1 answers for Manager 2 fallback display
    if (emp.manager1UserId != null) {
      const mgr1Answers = await getAnswersForSubmission(
        emp.submissionId,
        emp.manager1UserId,
      );
      manager1AnswersBySubmission[emp.submissionId] = mgr1Answers;
    }
  }

  // Fetch overall remarks for every submission. Reuses the same
  // manager1_overall_remarks / manager2_overall_remarks columns as the
  // standard assessment workflow so both flows share one data model.
  const overallRemarksBySubmission: Record<
    number,
    DirectAssessmentOverallRemarks
  > = {};
  const submissionIds = employees
    .map((e) => e.submissionId)
    .filter((id) => id !== 0);

  if (submissionIds.length > 0) {
    await ensureOverallRemarksColumns();
    const remarksRows = await db.query<{
      id: string;
      manager1_overall_remarks: string | null;
      manager2_overall_remarks: string | null;
    }>(
      `SELECT id::text,
              manager1_overall_remarks,
              manager2_overall_remarks
       FROM appraisals
       WHERE id = ANY($1::bigint[])`,
      [submissionIds],
    );
    for (const row of remarksRows.rows) {
      const id = Number(row.id);
      overallRemarksBySubmission[id] = {
        manager1: row.manager1_overall_remarks ?? null,
        manager2: row.manager2_overall_remarks ?? null,
      };
    }
  }

  return {
    templateId,
    templateTitle: template.title,
    selfAssessmentEnabled: template.selfAssessmentEnabled,
    additionalRemarksEnabled: template.additionalRemarksEnabled,
    questions,
    sections: template.sections,
    rootQuestions: template.questions,
    employees,
    managerAnswersBySubmission,
    manager1AnswersBySubmission,
    overallRemarksBySubmission,
  };
}

async function ensureOverallRemarksColumns(): Promise<void> {
  await db.query(
    `ALTER TABLE appraisals
     ADD COLUMN IF NOT EXISTS manager1_overall_remarks TEXT,
     ADD COLUMN IF NOT EXISTS manager2_overall_remarks TEXT`,
  );
}

async function getAnswersForSubmission(
  appraisalId: number,
  filledById: number,
): Promise<EmployeeFormAnswerRecord[]> {
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
