import "server-only";

import { db } from "@/lib/db";
import { getFormTemplateById } from "@/lib/queries/forms";
import { flattenAllQuestions } from "@/types/forms";
import type { QuestionRecord, FormSectionRecord } from "@/types/forms";
import type { EmployeeFormAnswerRecord } from "@/types/employee-forms";
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
}

export interface DirectAssessmentData {
  templateId: number;
  templateTitle: string;
  selfAssessmentEnabled: boolean;
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
       u.manager_2_id::text AS manager_2_user_id
     FROM employee_form_assignments efa
     INNER JOIN users u ON u.id = efa.employee_id
     LEFT JOIN LATERAL (
       SELECT ap_inner.*
       FROM appraisals ap_inner
       WHERE ap_inner.employee_id = u.id
         AND ap_inner.template_id = $${templateParamIndex}
       ORDER BY ap_inner.updated_at DESC NULLS LAST, ap_inner.id DESC
       LIMIT 1
     ) ap ON TRUE
     WHERE efa.template_id = $1
       AND u.is_active = TRUE
       AND u.employee_id <> 'EMP-0001'
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

  return {
    templateId,
    templateTitle: template.title,
    selfAssessmentEnabled: template.selfAssessmentEnabled,
    questions,
    sections: template.sections,
    rootQuestions: template.questions,
    employees,
    managerAnswersBySubmission,
    manager1AnswersBySubmission,
  };
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
