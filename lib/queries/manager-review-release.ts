import "server-only";

import { getDbClient } from "@/lib/db-context";

/**
 * Second-manager review is optional — a submission only waits at level 2
 * while a Manager 2 is assigned. When an employee's Manager 2 is removed,
 * any of their submissions parked at level-2 Manager Review loses its only
 * eligible reviewer. Advance those submissions to HR Alignment instead of
 * leaving them stuck as "Awaiting Manager" forever.
 *
 * Level-1 rows are intentionally untouched: Manager 1 review is mandatory,
 * so a missing Manager 1 correctly stays "Awaiting Manager" until HR
 * assigns one.
 *
 * Returns the number of submissions advanced.
 */
export async function releaseAwaitingManager2Reviews(
  userIds: readonly number[],
): Promise<number> {
  const ids = [
    ...new Set(userIds.map((id) => Number(id)).filter(Number.isFinite)),
  ];
  if (ids.length === 0) {
    return 0;
  }

  const result = await getDbClient().query(
    `UPDATE appraisals ap
     SET status = 'PENDING_HR_CALIBRATION',
         updated_at = CURRENT_TIMESTAMP
     FROM users u
     WHERE ap.employee_id = u.id
       AND u.id = ANY($1::bigint[])
       AND u.manager_2_id IS NULL
       AND ap.status = 'PENDING_HEAD_REVIEW'
       AND ap.manager_level = 2`,
    [ids],
  );

  return result.rowCount ?? 0;
}
