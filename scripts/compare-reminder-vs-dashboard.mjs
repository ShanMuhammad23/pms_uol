/**
 * Compare dashboard "Self Assessment + form assigned" count vs reminder recipients.
 */
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function count(label, sql, params) {
  const r = await pool.query(sql, params);
  console.log(`${label}: ${r.rows[0].count}`);
}

async function main() {
  const cycle = (
    await pool.query(
      `SELECT id FROM appraisal_cycles
       ORDER BY is_active DESC, fiscal_year DESC LIMIT 1`,
    )
  ).rows[0].id;
  console.log(`Cycle id=${cycle}\n`);

  await count(
    "1) Dashboard-like: Form State=Self Assessment + form assigned (COALESCE status, any eligibility)",
    `SELECT COUNT(*)::int AS count
     FROM users u
     LEFT JOIN LATERAL (
       SELECT ap_inner.*
       FROM appraisals ap_inner
       WHERE ap_inner.employee_id = u.id AND ap_inner.cycle_id = $1
       ORDER BY ap_inner.updated_at DESC NULLS LAST, ap_inner.id DESC
       LIMIT 1
     ) ap ON TRUE
     LEFT JOIN LATERAL (
       SELECT efa.template_id, efa.self_assessment_disabled
       FROM employee_form_assignments efa
       INNER JOIN form_templates ft ON ft.id = efa.template_id
       WHERE efa.employee_id = u.id AND ft.cycle_id = $1
       ORDER BY
         CASE WHEN ap.template_id IS NOT NULL AND efa.template_id = ap.template_id THEN 0 ELSE 1 END,
         efa.template_id DESC
       LIMIT 1
     ) assigned ON TRUE
     WHERE u.is_active = TRUE
       AND u.employee_id <> 'EMP-0001'
       AND assigned.template_id IS NOT NULL
       AND COALESCE(ap.status, 'PENDING_SELF_ASSESSMENT') = 'PENDING_SELF_ASSESSMENT'`,
    [cycle],
  );

  await count(
    "2) Same as (1) but self-assessment ENABLED on assignment (not MA/direct)",
    `SELECT COUNT(*)::int AS count
     FROM users u
     LEFT JOIN LATERAL (
       SELECT ap_inner.*
       FROM appraisals ap_inner
       WHERE ap_inner.employee_id = u.id AND ap_inner.cycle_id = $1
       ORDER BY ap_inner.updated_at DESC NULLS LAST, ap_inner.id DESC
       LIMIT 1
     ) ap ON TRUE
     LEFT JOIN LATERAL (
       SELECT efa.template_id, efa.self_assessment_disabled
       FROM employee_form_assignments efa
       INNER JOIN form_templates ft ON ft.id = efa.template_id
       WHERE efa.employee_id = u.id AND ft.cycle_id = $1
       ORDER BY
         CASE WHEN ap.template_id IS NOT NULL AND efa.template_id = ap.template_id THEN 0 ELSE 1 END,
         efa.template_id DESC
       LIMIT 1
     ) assigned ON TRUE
     WHERE u.is_active = TRUE
       AND u.employee_id <> 'EMP-0001'
       AND assigned.template_id IS NOT NULL
       AND assigned.self_assessment_disabled = FALSE
       AND COALESCE(ap.status, 'PENDING_SELF_ASSESSMENT') = 'PENDING_SELF_ASSESSMENT'`,
    [cycle],
  );

  await count(
    "3) Of (2): missing appraisal row (dashboard COALESCE phantom Self Assessment)",
    `SELECT COUNT(*)::int AS count
     FROM users u
     LEFT JOIN appraisals ap ON ap.employee_id = u.id AND ap.cycle_id = $1
     INNER JOIN employee_form_assignments efa ON efa.employee_id = u.id
     INNER JOIN form_templates ft ON ft.id = efa.template_id AND ft.cycle_id = $1
     WHERE u.is_active = TRUE
       AND u.employee_id <> 'EMP-0001'
       AND efa.self_assessment_disabled = FALSE
       AND ap.id IS NULL`,
    [cycle],
  );

  await count(
    "4) Real appraisal PENDING_SELF_ASSESSMENT + SA enabled (dashboard closer match)",
    `SELECT COUNT(*)::int AS count
     FROM appraisals ap
     INNER JOIN users u ON u.id = ap.employee_id
     INNER JOIN employee_form_assignments efa
       ON efa.employee_id = u.id AND efa.template_id = ap.template_id
     WHERE ap.cycle_id = $1
       AND ap.status = 'PENDING_SELF_ASSESSMENT'
       AND efa.self_assessment_disabled = FALSE
       AND u.is_active = TRUE
       AND u.employee_id <> 'EMP-0001'`,
    [cycle],
  );

  await count(
    "5) Of (4): assessment_eligibility = false (excluded by reminders)",
    `SELECT COUNT(*)::int AS count
     FROM appraisals ap
     INNER JOIN users u ON u.id = ap.employee_id
     INNER JOIN employee_form_assignments efa
       ON efa.employee_id = u.id AND efa.template_id = ap.template_id
     WHERE ap.cycle_id = $1
       AND ap.status = 'PENDING_SELF_ASSESSMENT'
       AND efa.self_assessment_disabled = FALSE
       AND u.is_active = TRUE
       AND u.employee_id <> 'EMP-0001'
       AND COALESCE(u.assessment_eligibility, TRUE) = FALSE`,
    [cycle],
  );

  await count(
    "6) Of (4): missing/blank email (excluded by reminders)",
    `SELECT COUNT(*)::int AS count
     FROM appraisals ap
     INNER JOIN users u ON u.id = ap.employee_id
     INNER JOIN employee_form_assignments efa
       ON efa.employee_id = u.id AND efa.template_id = ap.template_id
     WHERE ap.cycle_id = $1
       AND ap.status = 'PENDING_SELF_ASSESSMENT'
       AND efa.self_assessment_disabled = FALSE
       AND u.is_active = TRUE
       AND u.employee_id <> 'EMP-0001'
       AND (u.email IS NULL OR BTRIM(u.email) = '')`,
    [cycle],
  );

  await count(
    "7) Reminder recipients (current cron query)",
    `SELECT COUNT(*)::int AS count
     FROM appraisals ap
     INNER JOIN users u ON u.id = ap.employee_id
     INNER JOIN employee_form_assignments efa
       ON efa.employee_id = u.id AND efa.template_id = ap.template_id
     WHERE ap.cycle_id = $1
       AND ap.status = 'PENDING_SELF_ASSESSMENT'
       AND ap.submitted_at IS NULL
       AND efa.self_assessment_disabled = FALSE
       AND u.is_active = TRUE
       AND COALESCE(u.assessment_eligibility, TRUE) = TRUE
       AND u.employee_id <> 'EMP-0001'
       AND u.email IS NOT NULL
       AND BTRIM(u.email) <> ''`,
    [cycle],
  );

  // Break down (2) vs (7)
  await count(
    "8) Of (2): ineligible",
    `SELECT COUNT(*)::int AS count
     FROM users u
     LEFT JOIN LATERAL (
       SELECT ap_inner.*
       FROM appraisals ap_inner
       WHERE ap_inner.employee_id = u.id AND ap_inner.cycle_id = $1
       ORDER BY ap_inner.updated_at DESC NULLS LAST, ap_inner.id DESC
       LIMIT 1
     ) ap ON TRUE
     LEFT JOIN LATERAL (
       SELECT efa.template_id, efa.self_assessment_disabled
       FROM employee_form_assignments efa
       INNER JOIN form_templates ft ON ft.id = efa.template_id
       WHERE efa.employee_id = u.id AND ft.cycle_id = $1
       ORDER BY
         CASE WHEN ap.template_id IS NOT NULL AND efa.template_id = ap.template_id THEN 0 ELSE 1 END,
         efa.template_id DESC
       LIMIT 1
     ) assigned ON TRUE
     WHERE u.is_active = TRUE
       AND u.employee_id <> 'EMP-0001'
       AND assigned.template_id IS NOT NULL
       AND assigned.self_assessment_disabled = FALSE
       AND COALESCE(ap.status, 'PENDING_SELF_ASSESSMENT') = 'PENDING_SELF_ASSESSMENT'
       AND COALESCE(u.assessment_eligibility, TRUE) = FALSE`,
    [cycle],
  );

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
