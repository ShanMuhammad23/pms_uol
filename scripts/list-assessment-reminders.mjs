/**
 * Dry-run: list who would receive assessment reminder emails RIGHT NOW.
 * Does NOT send any email and does NOT update last-reminder timestamps.
 *
 * Usage:
 *   node --env-file=.env scripts/list-assessment-reminders.mjs
 *   node --env-file=.env scripts/list-assessment-reminders.mjs --include-cooldown
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const includeCooldown = process.argv.includes("--include-cooldown");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  try {
    const envText = readFileSync(join(rootDir, ".env"), "utf8");
    const match = envText.match(/^DATABASE_URL=(.+)$/m);
    if (match?.[1]) {
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // fall through
  }
  throw new Error("DATABASE_URL is not set.");
}

function printTable(title, rows, columns) {
  console.log(`\n=== ${title} (${rows.length}) ===`);
  if (rows.length === 0) {
    console.log("(none)");
    return;
  }
  const widths = columns.map((col) =>
    Math.max(
      col.label.length,
      ...rows.map((r) => String(r[col.key] ?? "").length),
    ),
  );
  const header = columns
    .map((col, i) => col.label.padEnd(widths[i]))
    .join("  ");
  console.log(header);
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows) {
    console.log(
      columns
        .map((col, i) => String(row[col.key] ?? "").padEnd(widths[i]))
        .join("  "),
    );
  }
}

async function main() {
  const pool = new Pool({ connectionString: loadDatabaseUrl() });
  const client = await pool.connect();

  try {
    const cycleResult = await client.query(
      `SELECT id, fiscal_year, is_active
       FROM appraisal_cycles
       ORDER BY is_active DESC, fiscal_year DESC
       LIMIT 1`,
    );

    if (cycleResult.rows.length === 0) {
      console.error("No appraisal cycle found.");
      process.exitCode = 1;
      return;
    }

    const cycle = cycleResult.rows[0];
    console.log("Assessment reminder dry-run (no emails sent)");
    console.log(
      `Cycle: id=${cycle.id} FY=${cycle.fiscal_year} active=${cycle.is_active}`,
    );
    console.log(`Include cooldown-blocked: ${includeCooldown}`);

    const employeeDue = await client.query(
      `SELECT
         efa.id AS assignment_id,
         ap.id AS appraisal_id,
         u.employee_id AS sap_code,
         CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
         u.email AS employee_email,
         ft.title AS form_title,
         CASE WHEN ap.id IS NULL THEN 'assigned (no appraisal yet)' ELSE 'PENDING_SELF_ASSESSMENT' END AS workflow,
         efa.last_self_assessment_reminder_at AS last_reminder_at,
         CASE
           WHEN efa.last_self_assessment_reminder_at IS NULL THEN 'due (never sent)'
           ELSE 'due (cooldown elapsed)'
         END AS reminder_status
       FROM employee_form_assignments efa
       INNER JOIN form_templates ft ON ft.id = efa.template_id
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
                <= (CURRENT_TIMESTAMP - INTERVAL '48 hours')
         )
       ORDER BY u.email, efa.id`,
      [cycle.id],
    );

    printTable("Employees — would receive reminder NOW", employeeDue.rows, [
      { key: "assignment_id", label: "assignment" },
      { key: "appraisal_id", label: "appraisal" },
      { key: "sap_code", label: "SAP" },
      { key: "employee_name", label: "name" },
      { key: "employee_email", label: "email" },
      { key: "form_title", label: "form" },
      { key: "workflow", label: "workflow" },
      { key: "last_reminder_at", label: "last_reminder" },
      { key: "reminder_status", label: "status" },
    ]);

    if (includeCooldown) {
      const employeeBlocked = await client.query(
        `SELECT
           efa.id AS assignment_id,
           u.employee_id AS sap_code,
           CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
           u.email AS employee_email,
           efa.last_self_assessment_reminder_at AS last_reminder_at,
           (efa.last_self_assessment_reminder_at + INTERVAL '48 hours')
             AS next_eligible_at
         FROM employee_form_assignments efa
         INNER JOIN form_templates ft ON ft.id = efa.template_id
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
           AND efa.last_self_assessment_reminder_at
                 > (CURRENT_TIMESTAMP - INTERVAL '48 hours')
         ORDER BY efa.last_self_assessment_reminder_at DESC`,
        [cycle.id],
      );

      printTable(
        "Employees — pending but on 48h cooldown (skipped)",
        employeeBlocked.rows,
        [
          { key: "assignment_id", label: "assignment" },
          { key: "sap_code", label: "SAP" },
          { key: "employee_name", label: "name" },
          { key: "employee_email", label: "email" },
          { key: "last_reminder_at", label: "last_reminder" },
          { key: "next_eligible_at", label: "next_eligible" },
        ],
      );
    }

    const managerDue = await client.query(
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
         m.id AS manager_user_id,
         m.employee_id AS sap_code,
         CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
         m.email AS manager_email,
         c.direct_assessment_count,
         c.pending_review_count,
         (c.direct_assessment_count + c.pending_review_count) AS total_pending,
         m.last_manager_reminder_at AS last_reminder_at,
         CASE
           WHEN m.last_manager_reminder_at IS NULL THEN 'due (never sent)'
           ELSE 'due (cooldown elapsed)'
         END AS reminder_status
       FROM counts c
       INNER JOIN users m ON m.id = c.manager_id
       WHERE m.is_active = TRUE
         AND m.email IS NOT NULL
         AND BTRIM(m.email) <> ''
         AND (c.direct_assessment_count + c.pending_review_count) > 0
         AND (
           m.last_manager_reminder_at IS NULL
           OR m.last_manager_reminder_at
                <= (CURRENT_TIMESTAMP - INTERVAL '3 days')
         )
       ORDER BY total_pending DESC, m.email`,
      [cycle.id],
    );

    printTable("Managers — would receive digest NOW", managerDue.rows, [
      { key: "manager_user_id", label: "user_id" },
      { key: "sap_code", label: "SAP" },
      { key: "manager_name", label: "name" },
      { key: "manager_email", label: "email" },
      { key: "direct_assessment_count", label: "direct" },
      { key: "pending_review_count", label: "reviews" },
      { key: "total_pending", label: "total" },
      { key: "last_reminder_at", label: "last_reminder" },
      { key: "reminder_status", label: "status" },
    ]);

    console.log("\n=== Summary ===");
    console.log(`Employees due now: ${employeeDue.rows.length}`);
    console.log(`Managers due now:  ${managerDue.rows.length}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[FATAL]", error.message);
  process.exitCode = 1;
});
