import "server-only";

import { db } from "@/lib/db";
import { getDbClient } from "@/lib/db-context";
import { getFormTemplateById } from "@/lib/queries/forms";
import { flattenAllQuestions } from "@/types/forms";
import type { QuestionRecord, FormSectionRecord, FormRatingScaleRecord } from "@/types/forms";
import type {
  EmployeeFormAnswerAttachment,
  EmployeeFormAnswerRecord,
} from "@/types/employee-forms";
import { hydrateAnswerPoints } from "@/app/helpers/form-rating-scoring";

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
  templateDescription: string | null;
  selfAssessmentEnabled: boolean;
  /** Whether the form template has additional_remarks_enabled = TRUE. */
  additionalRemarksEnabled: boolean;
  ratingBased: boolean;
  ratingScales: FormRatingScaleRecord[];
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
   * Map of submissionId → authored answers (open-assessment sections) for the
   * current reviewer. Keyed by submissionId.
   */
  managerAuthoredAnswersBySubmission: Record<
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
  /**
   * When true, only employees where the reviewer is Manager 1 (`head_id`)
   * or Manager 2 (`manager_2_id`). Used so Super Admin / HR / Board can
   * separate their own manager queue from the org-wide list.
   */
  managedOnly = false,
  /**
   * Super Admin / HR / Board. In the org-wide list (`managedOnly` false)
   * they may score any pending employee, not only people they manage.
   */
  isAdmin = false,
): Promise<DirectAssessmentData | null> {
  const template = await getFormTemplateById(templateId);
  if (!template) {
    return null;
  }

  const questions = flattenAllQuestions(template);

  let visibilityClause = "";
  let visibilityParams: unknown[] = [];

  if (managedOnly || isHead) {
    visibilityClause = `AND (
      u.head_id = $2
      OR u.manager_2_id = $2
    )`;
    visibilityParams = [reviewerUserId];
  }

  const templateParamIndex = visibilityParams.length === 0 ? 2 : 3;

  const result = await getDbClient().query<AssignmentRow>(
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
    const isAssignedReviewer = assignedReviewerAtLevel === reviewerUserId;
    // Org-wide admin view: score anyone still in manager review.
    // "My Direct Assessments" stays limited to people the admin manages.
    const adminMayEditAnyone = isAdmin && !managedOnly;

    const canEdit =
      submissionId !== 0 &&
      status === "PENDING_HEAD_REVIEW" &&
      (isAssignedReviewer || adminMayEditAnyone);

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
  const managerAuthoredAnswersBySubmission: Record<
    number,
    EmployeeFormAnswerRecord[]
  > = {};

  // BATCH: Fetch all answers for all submissions in one query instead of
  // looping per employee. Collect all (submissionId, filledById) pairs we need.
  const submissionIdsForAnswers = employees
    .filter((e) => e.submissionId !== 0)
    .map((e) => e.submissionId);

  const filledByIds = new Set<number>();
  for (const emp of employees) {
    if (emp.submissionId === 0) continue;
    filledByIds.add(reviewerUserId);
    if (emp.manager1UserId != null) filledByIds.add(emp.manager1UserId);
    if (emp.manager2UserId != null) filledByIds.add(emp.manager2UserId);
  }

  // Batch query: all answers for all relevant submissions + filled_by combos.
  // Keyed by `${appraisal_id}:${filled_by_id}` → list of answer records.
  // Only fetches rows with question_id NOT NULL (normal answers).
  const answersByTriple = new Map<
    string,
    Array<{
      questionId: number;
      textResponse: string | null;
      selectedOptionId: number | null;
      pointsEarned: number;
      remarks: string | null;
      ratingValue: number | null;
    }>
  >();

  if (submissionIdsForAnswers.length > 0 && filledByIds.size > 0) {
    const ansResult = await getDbClient().query<{
      appraisal_id: string;
      question_id: string;
      filled_by_id: string;
      text_response: string | null;
      selected_option_id: string | null;
      points_earned: string;
      remarks: string | null;
      rating_value: string | null;
    }>(
      `SELECT appraisal_id::text, question_id::text, filled_by_id::text,
              text_response, selected_option_id::text, points_earned::text, remarks,
              rating_value::text
       FROM appraisal_answers
       WHERE appraisal_id = ANY($1::bigint[])
         AND filled_by_id = ANY($2::bigint[])
         AND question_id IS NOT NULL`,
      [submissionIdsForAnswers, [...filledByIds]],
    );
    for (const row of ansResult.rows) {
      const key = `${row.appraisal_id}:${row.filled_by_id}`;
      const list = answersByTriple.get(key) ?? [];
      list.push({
        questionId: Number(row.question_id),
        textResponse: row.text_response,
        selectedOptionId: row.selected_option_id
          ? Number(row.selected_option_id)
          : null,
        pointsEarned: Number(row.points_earned),
        remarks: row.remarks ?? null,
        ratingValue:
          row.rating_value == null || row.rating_value === ""
            ? null
            : Number(row.rating_value),
      });
      answersByTriple.set(key, list);
    }
  }

  // Batch query: authored answers (open-assessment sections) for all
  // relevant submissions + filled_by combos. Keyed by
  // `${appraisal_id}:${filled_by_id}` → list of authored answer records.
  const authoredAnswersByTriple = new Map<
    string,
    EmployeeFormAnswerRecord[]
  >();

  if (submissionIdsForAnswers.length > 0 && filledByIds.size > 0) {
    const authoredResult = await getDbClient().query<{
      appraisal_id: string;
      filled_by_id: string;
      id: string;
      text_response: string | null;
      points_earned: string;
      remarks: string | null;
      authored_question_text: string | null;
      authored_total_marks: string;
      open_section_id: string | null;
      rating_value: string | null;
    }>(
      `SELECT appraisal_id::text, filled_by_id::text, id::text,
              text_response, points_earned::text, remarks,
              authored_question_text, authored_total_marks::text,
              open_section_id::text, rating_value::text
       FROM appraisal_answers
       WHERE appraisal_id = ANY($1::bigint[])
         AND filled_by_id = ANY($2::bigint[])
         AND open_section_id IS NOT NULL
       ORDER BY id ASC`,
      [submissionIdsForAnswers, [...filledByIds]],
    );
    for (const row of authoredResult.rows) {
      const key = `${row.appraisal_id}:${row.filled_by_id}`;
      const list = authoredAnswersByTriple.get(key) ?? [];
      list.push({
        questionId: 0,
        textResponse: row.text_response,
        selectedOptionId: null,
        pointsEarned: Number(row.points_earned),
        ratingValue:
          row.rating_value == null || row.rating_value === ""
            ? null
            : Number(row.rating_value),
        remarks: row.remarks ?? null,
        attachments: [],
        authoredQuestionText: row.authored_question_text,
        authoredTotalMarks: Number(row.authored_total_marks),
        openSectionId: row.open_section_id
          ? Number(row.open_section_id)
          : null,
      });
      authoredAnswersByTriple.set(key, list);
    }
  }

  const getAuthoredAnswersForUser = (
    submissionId: number,
    filledById: number,
  ): EmployeeFormAnswerRecord[] => {
    const key = `${submissionId}:${filledById}`;
    return authoredAnswersByTriple.get(key) ?? [];
  };

  // Batch query: all attachments for all relevant submissions.
  const attachmentsByQuestionKey = new Map<
    string,
    EmployeeFormAnswerAttachment[]
  >();

  if (submissionIdsForAnswers.length > 0 && filledByIds.size > 0) {
    const attResult = await getDbClient().query<{
      appraisal_id: string;
      question_id: string;
      filled_by_id: string;
      id: string;
      original_filename: string;
      mime_type: string | null;
      size_bytes: string;
      created_at: string;
    }>(
      `SELECT aa.appraisal_id::text, aa.question_id::text, aa.filled_by_id::text,
              aa.id, aa.original_filename, aa.mime_type,
              aa.size_bytes::text, aa.created_at::text
       FROM appraisal_answer_attachments aa
       WHERE aa.appraisal_id = ANY($1::bigint[])
         AND aa.filled_by_id = ANY($2::bigint[])`,
      [submissionIdsForAnswers, [...filledByIds]],
    );
    for (const row of attResult.rows) {
      const key = `${row.appraisal_id}:${row.question_id}`;
      const list = attachmentsByQuestionKey.get(key) ?? [];
      list.push({
        id: Number(row.id),
        questionId: Number(row.question_id),
        originalFilename: row.original_filename,
        mimeType: row.mime_type,
        sizeBytes: Number(row.size_bytes),
        createdAt: row.created_at,
      });
      attachmentsByQuestionKey.set(key, list);
    }
  }

  // Helper: assemble EmployeeFormAnswerRecord[] for a given submission + user.
  const getAnswersForUser = (
    submissionId: number,
    filledById: number,
  ): EmployeeFormAnswerRecord[] => {
    const key = `${submissionId}:${filledById}`;
    const list = answersByTriple.get(key) ?? [];
    return hydrateAnswerPoints(
      list.map((a) => ({
        ...a,
        attachments:
          attachmentsByQuestionKey.get(`${submissionId}:${a.questionId}`) ?? [],
      })),
      questions,
      template.ratingBased,
      template.ratingScales,
    );
  };

  for (const emp of employees) {
    if (emp.submissionId === 0) continue;

    if (emp.canEdit) {
      const assignedReviewerId =
        (emp.managerLevel ?? 1) === 2
          ? emp.manager2UserId ?? emp.manager1UserId
          : emp.manager1UserId;
      const assignedAnswers =
        assignedReviewerId != null
          ? getAnswersForUser(emp.submissionId, assignedReviewerId)
          : [];
      const ownAnswers = getAnswersForUser(emp.submissionId, reviewerUserId);
      // Admin proxying a manager should see that manager's scores (Score O).
      managerAnswersBySubmission[emp.submissionId] =
        assignedReviewerId === reviewerUserId
          ? ownAnswers
          : assignedAnswers.length > 0
            ? assignedAnswers
            : ownAnswers;
    } else {
      const lastReviewerId =
        (emp.managerLevel ?? 1) === 2
          ? emp.manager2UserId ?? emp.manager1UserId
          : emp.manager1UserId;
      if (lastReviewerId != null) {
        managerAnswersBySubmission[emp.submissionId] = getAnswersForUser(
          emp.submissionId,
          lastReviewerId,
        );
      }
    }

    if (emp.manager1UserId != null) {
      manager1AnswersBySubmission[emp.submissionId] = getAnswersForUser(
        emp.submissionId,
        emp.manager1UserId,
      );
    }

    // Authored answers for the current reviewer.
    const authoredReviewerId =
      emp.canEdit
        ? ((emp.managerLevel ?? 1) === 2
            ? emp.manager2UserId ?? emp.manager1UserId
            : emp.manager1UserId)
        : ((emp.managerLevel ?? 1) === 2
            ? emp.manager2UserId ?? emp.manager1UserId
            : emp.manager1UserId);
    if (authoredReviewerId != null) {
      managerAuthoredAnswersBySubmission[emp.submissionId] =
        getAuthoredAnswersForUser(emp.submissionId, authoredReviewerId);
    } else {
      managerAuthoredAnswersBySubmission[emp.submissionId] = [];
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
    const remarksRows = await getDbClient().query<{
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
    templateDescription: template.description ?? null,
    selfAssessmentEnabled: template.selfAssessmentEnabled,
    additionalRemarksEnabled: template.additionalRemarksEnabled,
    ratingBased: template.ratingBased,
    ratingScales: template.ratingScales ?? [],
    questions,
    sections: template.sections,
    rootQuestions: template.questions,
    employees,
    managerAnswersBySubmission,
    manager1AnswersBySubmission,
    managerAuthoredAnswersBySubmission,
    overallRemarksBySubmission,
  };
}
