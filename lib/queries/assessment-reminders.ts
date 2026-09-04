import "server-only";

import { getDbClient } from "@/lib/db-context";

/** Employee self-assessment reminder cooldown. */
export const EMPLOYEE_REMINDER_INTERVAL = "48 hours";

/** Manager digest reminder cooldown. */
export const MANAGER_REMINDER_INTERVAL = "3 days";

export interface PendingSelfAssessmentReminder {
  assignmentId: number;
  appraisalId: number | null;
  employeeUserId: number;
  employeeName: string;
  employeeEmail: string;
  formTitle: string;
  cycleFiscalYear: number;
}

export interface PendingManagerReminder {
  managerUserId: number;
  managerName: string;
  managerEmail: string;
  /** Direct assessments (self-assessment disabled) awaiting this manager. */
  directAssessmentCount: number;
  /** Employee submissions awaiting this manager's review. */
  pendingReviewCount: number;
}

/**
 * Employees who have a form assigned in the active cycle with self-assessment
 * enabled and have not completed self-assessment yet.
 *
 * Source of truth is the assignment (same as the dashboard), not whether an
 * appraisal row already exists. Incomplete means:
 * - no appraisal for this cycle, OR
 * - appraisal still PENDING_SELF_ASSESSMENT / not submitted
 */
export async function listPendingSelfAssessmentReminders(
  cycleId: number,
): Promise<PendingSelfAssessmentReminder[]> {
  const result = await getDbClient().query<{
    assignment_id: string;
    appraisal_id: string | null;
    employee_user_id: string;
    employee_name: string;
    employee_email: string;
    form_title: string;
    fiscal_year: number;
  }>(
    `SELECT
       efa.id::text AS assignment_id,
       ap.id::text AS appraisal_id,
       u.id::text AS employee_user_id,
       CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
       u.email AS employee_email,
       ft.title AS form_title,
       ac.fiscal_year
     FROM employee_form_assignments efa
     INNER JOIN form_templates ft ON ft.id = efa.template_id
     INNER JOIN appraisal_cycles ac ON ac.id = ft.cycle_id
     INNER JOIN users u ON u.id = efa.employee_id
     LEFT JOIN appraisals ap
       ON ap.employee_id = u.id
      AND ap.cycle_id = ft.cycle_id
     WHERE ft.cycle_id = $1
       AND efa.self_assessment_disabled = FALSE
       AND u.is_active = TRUE
       AND COALESCE(u.assessment_eligibility, TRUE) = TRUE
       AND u.employee_id <> 'EMP-0001'
       AND u.email IS NOT NULL
       AND BTRIM(u.email) <> ''
       AND (
         ap.id IS NULL
         OR (
           ap.status = 'PENDING_SELF_ASSESSMENT'
           AND ap.submitted_at IS NULL
         )
       )
       AND (
         efa.last_self_assessment_reminder_at IS NULL
         OR efa.last_self_assessment_reminder_at
              <= (CURRENT_TIMESTAMP - $2::interval)
       )
     ORDER BY efa.id ASC`,
    [cycleId, EMPLOYEE_REMINDER_INTERVAL],
  );

  return result.rows.map((row) => ({
    assignmentId: Number(row.assignment_id),
    appraisalId: row.appraisal_id != null ? Number(row.appraisal_id) : null,
    employeeUserId: Number(row.employee_user_id),
    employeeName: row.employee_name,
    employeeEmail: row.employee_email,
    formTitle: row.form_title,
    cycleFiscalYear: Number(row.fiscal_year),
  }));
}

/**
 * Managers who currently have pending direct assessments and/or pending
 * submission reviews, and whose last digest is older than 3 days (or never sent).
 *
 * "Current reviewer" is resolved from manager_level + head_id / manager_2_id
 * (same rules as the live manager review queue).
 */
export async function listPendingManagerReminders(
  cycleId: number,
): Promise<PendingManagerReminder[]> {
  const result = await getDbClient().query<{
    manager_user_id: string;
    manager_name: string;
    manager_email: string;
    direct_assessment_count: string;
    pending_review_count: string;
  }>(
    `WITH pending AS (
       SELECT
         CASE
           WHEN COALESCE(ap.manager_level, 1) <= 1 THEN emp.head_id
           ELSE emp.manager_2_id
         END AS manager_id,
         efa.self_assessment_disabled
       FROM appraisals ap
       INNER JOIN users emp ON emp.id = ap.employee_id
       INNER JOIN employee_form_assignments efa
         ON efa.employee_id = emp.id
        AND efa.template_id = ap.template_id
       WHERE ap.cycle_id = $1
         AND ap.status = 'PENDING_HEAD_REVIEW'
         AND ap.template_id IS NOT NULL
         AND emp.is_active = TRUE
         AND COALESCE(emp.assessment_eligibility, TRUE) = TRUE
         AND emp.employee_id <> 'EMP-0001'
     ),
     counts AS (
       SELECT
         manager_id,
         COUNT(*) FILTER (WHERE self_assessment_disabled = TRUE)::int
           AS direct_assessment_count,
         COUNT(*) FILTER (WHERE self_assessment_disabled = FALSE)::int
           AS pending_review_count
       FROM pending
       WHERE manager_id IS NOT NULL
       GROUP BY manager_id
     )
     SELECT
       m.id::text AS manager_user_id,
       CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
       m.email AS manager_email,
       c.direct_assessment_count::text,
       c.pending_review_count::text
     FROM counts c
     INNER JOIN users m ON m.id = c.manager_id
     WHERE m.is_active = TRUE
       AND m.email IS NOT NULL
       AND BTRIM(m.email) <> ''
       AND (c.direct_assessment_count + c.pending_review_count) > 0
       AND (
         m.last_manager_reminder_at IS NULL
         OR m.last_manager_reminder_at
              <= (CURRENT_TIMESTAMP - $2::interval)
       )
     ORDER BY m.id ASC`,
    [cycleId, MANAGER_REMINDER_INTERVAL],
  );

  return result.rows.map((row) => ({
    managerUserId: Number(row.manager_user_id),
    managerName: row.manager_name,
    managerEmail: row.manager_email,
    directAssessmentCount: Number(row.direct_assessment_count),
    pendingReviewCount: Number(row.pending_review_count),
  }));
}

export async function markSelfAssessmentReminderSent(params: {
  assignmentId: number;
  appraisalId: number | null;
}): Promise<void> {
  await getDbClient().query(
    `UPDATE employee_form_assignments
     SET last_self_assessment_reminder_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [params.assignmentId],
  );

  if (params.appraisalId != null) {
    await getDbClient().query(
      `UPDATE appraisals
       SET last_self_assessment_reminder_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [params.appraisalId],
    );
  }
}

export async function markManagerReminderSent(
  managerUserId: number,
): Promise<void> {
  await getDbClient().query(
    `UPDATE users
     SET last_manager_reminder_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [managerUserId],
  );
}

export interface SentSelfAssessmentReminderRow {
  assignmentId: number;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  formTitle: string;
  cycleFiscalYear: number | null;
  lastReminderAt: string;
}

export type ReminderAudienceRole = "EMPLOYEE" | "MANAGER";

export interface SentAssessmentReminderRow {
  /** Stable UI key: `employee:{assignmentId}` or `manager:{userId}` */
  id: string;
  role: ReminderAudienceRole;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  formTitle: string | null;
  cycleFiscalYear: number | null;
  lastReminderAt: string;
}

/**
 * Combined list of sent reminders for Super Admin UI:
 * - Employees: assignment-level self-assessment reminders
 * - Managers: digest reminders on users.last_manager_reminder_at
 */
export async function listSentAssessmentReminders(options?: {
  limit?: number;
  offset?: number;
  search?: string;
  roles?: ReminderAudienceRole[];
}): Promise<{ items: SentAssessmentReminderRow[]; total: number }> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const offset = Math.max(options?.offset ?? 0, 0);
  const search = options?.search?.trim() ?? "";
  const roles = options?.roles?.length
    ? options.roles
    : (["EMPLOYEE", "MANAGER"] as ReminderAudienceRole[]);

  const includeEmployee = roles.includes("EMPLOYEE");
  const includeManager = roles.includes("MANAGER");
  if (!includeEmployee && !includeManager) {
    return { items: [], total: 0 };
  }

  const params: unknown[] = [];
  let searchClauseEmployee = "";
  let searchClauseManager = "";
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    searchClauseEmployee = `AND (
      u.employee_id ILIKE $${idx}
      OR u.email ILIKE $${idx}
      OR CONCAT(u.first_name, ' ', u.last_name) ILIKE $${idx}
      OR ft.title ILIKE $${idx}
    )`;
    searchClauseManager = `AND (
      m.employee_id ILIKE $${idx}
      OR m.email ILIKE $${idx}
      OR CONCAT(m.first_name, ' ', m.last_name) ILIKE $${idx}
    )`;
  }

  const unions: string[] = [];

  if (includeEmployee) {
    unions.push(`
      SELECT
        'employee:' || efa.id::text AS id,
        'EMPLOYEE'::text AS role,
        u.employee_id,
        CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
        u.email AS employee_email,
        ft.title AS form_title,
        ac.fiscal_year,
        efa.last_self_assessment_reminder_at AS last_reminder_at
      FROM employee_form_assignments efa
      INNER JOIN users u ON u.id = efa.employee_id
      INNER JOIN form_templates ft ON ft.id = efa.template_id
      LEFT JOIN appraisal_cycles ac ON ac.id = ft.cycle_id
      WHERE efa.last_self_assessment_reminder_at IS NOT NULL
        ${searchClauseEmployee}
    `);
  }

  if (includeManager) {
    unions.push(`
      SELECT
        'manager:' || m.id::text AS id,
        'MANAGER'::text AS role,
        m.employee_id,
        CONCAT(m.first_name, ' ', m.last_name) AS employee_name,
        m.email AS employee_email,
        NULL::text AS form_title,
        NULL::int AS fiscal_year,
        m.last_manager_reminder_at AS last_reminder_at
      FROM users m
      WHERE m.last_manager_reminder_at IS NOT NULL
        ${searchClauseManager}
    `);
  }

  params.push(limit);
  const limitIndex = params.length;
  params.push(offset);
  const offsetIndex = params.length;

  const result = await getDbClient().query<{
    id: string;
    role: ReminderAudienceRole;
    employee_id: string;
    employee_name: string;
    employee_email: string;
    form_title: string | null;
    fiscal_year: number | null;
    last_reminder_at: string;
    total_count: string;
  }>(
    `WITH combined AS (
       ${unions.join("\nUNION ALL\n")}
     )
     SELECT
       id,
       role,
       employee_id,
       employee_name,
       employee_email,
       form_title,
       fiscal_year,
       last_reminder_at::text AS last_reminder_at,
       COUNT(*) OVER()::text AS total_count
     FROM combined
     ORDER BY last_reminder_at DESC, employee_id ASC
     LIMIT $${limitIndex}
     OFFSET $${offsetIndex}`,
    params,
  );

  const total =
    result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;

  return {
    total,
    items: result.rows.map((row) => ({
      id: row.id,
      role: row.role,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      employeeEmail: row.employee_email,
      formTitle: row.form_title,
      cycleFiscalYear:
        row.fiscal_year != null ? Number(row.fiscal_year) : null,
      lastReminderAt: row.last_reminder_at,
    })),
  };
}

/**
 * @deprecated Prefer listSentAssessmentReminders (includes managers + role).
 */
export async function listSentSelfAssessmentReminders(options?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<{ items: SentSelfAssessmentReminderRow[]; total: number }> {
  const result = await listSentAssessmentReminders({
    ...options,
    roles: ["EMPLOYEE"],
  });
  return {
    total: result.total,
    items: result.items.map((row) => ({
      assignmentId: Number(row.id.replace(/^employee:/, "")),
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      employeeEmail: row.employeeEmail,
      formTitle: row.formTitle ?? "",
      cycleFiscalYear: row.cycleFiscalYear,
      lastReminderAt: row.lastReminderAt,
    })),
  };
}

export interface AssessmentReminderTodayStats {
  total: number;
  employee: number;
  manager: number;
}

/** Counts of reminders whose last send timestamp falls on the DB server's current date. */
export async function getAssessmentReminderTodayStats(): Promise<AssessmentReminderTodayStats> {
  const result = await getDbClient().query<{
    employee_today: string;
    manager_today: string;
  }>(
    `SELECT
       (
         SELECT COUNT(*)::text
         FROM employee_form_assignments
         WHERE last_self_assessment_reminder_at IS NOT NULL
           AND last_self_assessment_reminder_at >= CURRENT_DATE
           AND last_self_assessment_reminder_at < (CURRENT_DATE + INTERVAL '1 day')
       ) AS employee_today,
       (
         SELECT COUNT(*)::text
         FROM users
         WHERE last_manager_reminder_at IS NOT NULL
           AND last_manager_reminder_at >= CURRENT_DATE
           AND last_manager_reminder_at < (CURRENT_DATE + INTERVAL '1 day')
       ) AS manager_today`,
  );

  const employee = Number(result.rows[0]?.employee_today ?? 0);
  const manager = Number(result.rows[0]?.manager_today ?? 0);
  return {
    employee,
    manager,
    total: employee + manager,
  };
}
