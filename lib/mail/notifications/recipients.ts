import "server-only";

import { db } from "@/lib/db";
import type { AppraisalStatus } from "@/types/forms";

/**
 * Recipient info for workflow notifications.
 *
 * Resolved from the existing PMS data relationships:
 * - Employee: `appraisals.employee_id` → `users`
 * - Manager 1: `users.head_id` → `users`
 * - Manager 2: `users.manager_2_id` → `users`
 *
 * No duplicate relationship data is introduced — this reads the same
 * `head_id` / `manager_2_id` columns the workflow already uses.
 */
export interface NotificationRecipient {
  userId: number;
  email: string;
  name: string;
}

export interface SubmissionRecipients {
  employee: NotificationRecipient | null;
  manager1: NotificationRecipient | null;
  manager2: NotificationRecipient | null;
  /** Current appraisal workflow status (after the workflow action committed). */
  appraisalStatus: AppraisalStatus;
  /** Current manager review level (1 or 2). */
  managerLevel: number | null;
}

interface RecipientRow {
  status: AppraisalStatus;
  manager_level: number | null;
  employee_user_id: string;
  employee_email: string | null;
  employee_first_name: string | null;
  employee_last_name: string | null;
  manager1_user_id: string | null;
  manager1_email: string | null;
  manager1_first_name: string | null;
  manager1_last_name: string | null;
  manager2_user_id: string | null;
  manager2_email: string | null;
  manager2_first_name: string | null;
  manager2_last_name: string | null;
}

function buildRecipient(
  userId: string | null,
  email: string | null,
  firstName: string | null,
  lastName: string | null,
): NotificationRecipient | null {
  if (!userId || !email || !email.trim()) {
    return null;
  }
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return {
    userId: Number(userId),
    email: email.trim(),
    name: name || email.trim(),
  };
}

/**
 * Fetch all notification recipients for a submission in a single query.
 *
 * This avoids N+1 lookups — employee, Manager 1, and Manager 2 are resolved
 * via LEFT JOINs on the existing `users.head_id` and `users.manager_2_id`
 * columns. Also returns the current appraisal status and manager level.
 *
 * @param appraisalId The submission/appraisal ID.
 */
export async function getSubmissionRecipients(
  appraisalId: number,
): Promise<SubmissionRecipients | null> {
  const result = await db.query<RecipientRow>(
    `SELECT
       ap.status,
       ap.manager_level,
       emp.id::text AS employee_user_id,
       emp.email AS employee_email,
       emp.first_name AS employee_first_name,
       emp.last_name AS employee_last_name,
       m1.id::text AS manager1_user_id,
       m1.email AS manager1_email,
       m1.first_name AS manager1_first_name,
       m1.last_name AS manager1_last_name,
       m2.id::text AS manager2_user_id,
       m2.email AS manager2_email,
       m2.first_name AS manager2_first_name,
       m2.last_name AS manager2_last_name
     FROM appraisals ap
     INNER JOIN users emp ON emp.id = ap.employee_id
     LEFT JOIN users m1 ON m1.id = emp.head_id
     LEFT JOIN users m2 ON m2.id = emp.manager_2_id
     WHERE ap.id = $1
     LIMIT 1`,
    [appraisalId],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    employee: buildRecipient(
      row.employee_user_id,
      row.employee_email,
      row.employee_first_name,
      row.employee_last_name,
    ),
    manager1: buildRecipient(
      row.manager1_user_id,
      row.manager1_email,
      row.manager1_first_name,
      row.manager1_last_name,
    ),
    manager2: buildRecipient(
      row.manager2_user_id,
      row.manager2_email,
      row.manager2_first_name,
      row.manager2_last_name,
    ),
    appraisalStatus: row.status,
    managerLevel: row.manager_level != null ? Number(row.manager_level) : null,
  };
}
