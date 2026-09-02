import "server-only";

import { getDbClient } from "@/lib/db-context";

export interface DirectAssessmentStaffByEntity {
  entityId: number;
  count: number;
}

/**
 * Distinct employees assigned to at least one self-assessment-disabled form,
 * grouped by the employee's own entity. Callers roll these up to ORG Level 1/2
 * using the entity ancestor tree.
 */
export async function listDirectAssessmentStaffByEntity(): Promise<
  DirectAssessmentStaffByEntity[]
> {
  const result = await getDbClient().query<{
    entity_id: string;
    staff_count: string;
  }>(
    `SELECT
       u.entity_id::text AS entity_id,
       COUNT(DISTINCT u.id)::text AS staff_count
     FROM employee_form_assignments efa
     INNER JOIN users u ON u.id = efa.employee_id
     WHERE efa.self_assessment_disabled = true
       AND u.is_active = TRUE
       AND u.employee_id <> 'EMP-0001'
       AND COALESCE(u.assessment_eligibility, true) = true
       AND u.entity_id IS NOT NULL
     GROUP BY u.entity_id`,
  );

  return result.rows.map((row) => ({
    entityId: Number(row.entity_id),
    count: Number(row.staff_count),
  }));
}
