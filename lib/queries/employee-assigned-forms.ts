import "server-only";

import { db } from "@/lib/db";
import { getDefaultAppraisalCycle } from "@/lib/queries/appraisal-cycles";

export type EmployeeAssignedForm = {
  templateId: number;
  title: string;
};

export async function listAssignedFormsForEmployeeSap(
  employeeId: string,
): Promise<EmployeeAssignedForm[]> {
  const sapCode = employeeId.trim();
  if (!sapCode) {
    return [];
  }

  const cycle = await getDefaultAppraisalCycle();
  const cycleId = cycle?.id ?? null;

  const result = await db.query<{
    template_id: string;
    title: string;
  }>(
    `SELECT
       ft.id AS template_id,
       ft.title
     FROM users u
     INNER JOIN employee_form_assignments efa ON efa.employee_id = u.id
     INNER JOIN form_templates ft ON ft.id = efa.template_id
     WHERE u.employee_id = $1
       AND u.is_active = TRUE
       AND (
         $2::int IS NULL
         OR ft.cycle_id = $2
       )
     ORDER BY ft.title ASC, ft.id ASC`,
    [sapCode, cycleId],
  );

  return result.rows.map((row) => ({
    templateId: Number(row.template_id),
    title: row.title,
  }));
}
