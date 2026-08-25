/**
 * Backfill appraisals with cycle_id = NULL by setting cycle_id from the
 * associated form template's cycle_id.
 *
 * Bug: getOrCreateAppraisal (employee self-assessment flow) created appraisals
 * without cycle_id. The dashboard query filters by cycle_id, so these
 * appraisals were invisible and their status defaulted to PENDING_SELF_ASSESSMENT
 * even after the employee submitted.
 *
 * This script fixes existing data by joining appraisals to form_templates
 * on template_id and copying the template's cycle_id.
 *
 * For appraisals with template_id = NULL (direct score entry), we use the
 * default appraisal cycle.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/backfill-appraisal-cycle-id.mjs
 *
 * Add --dry-run to preview without making changes.
 */
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const dryRun = process.argv.includes("--dry-run");

console.log(dryRun ? "=== DRY RUN ===" : "=== BACKFILL ===");

// 1. Count appraisals with cycle_id = NULL
const statsBefore = await pool.query(
  "SELECT COUNT(*) as cnt FROM appraisals WHERE cycle_id IS NULL",
);
console.log(`Appraisals with cycle_id = NULL: ${statsBefore.rows[0].cnt}`);

// 2. Get the default appraisal cycle (for template_id = NULL appraisals)
const defaultCycle = await pool.query(
  "SELECT id, fiscal_year FROM appraisal_cycles ORDER BY is_active DESC, fiscal_year DESC LIMIT 1",
);
const defaultCycleId = defaultCycle.rows[0]?.id ?? null;
console.log(`Default appraisal cycle: ${defaultCycleId ? `#${defaultCycleId} (FY ${defaultCycle.rows[0].fiscal_year})` : "NONE"}`);

if (!defaultCycleId) {
  console.error("No appraisal cycle found. Create one before running this script.");
  await pool.end();
  process.exit(1);
}

// 3. Backfill from form_templates for appraisals with template_id
const templateBackfill = await pool.query(
  `SELECT ap.id, ap.employee_id, ap.template_id, ft.cycle_id AS template_cycle_id,
          ap.status, ap.submitted_at
   FROM appraisals ap
   INNER JOIN form_templates ft ON ft.id = ap.template_id
   WHERE ap.cycle_id IS NULL
   ORDER BY ap.id`,
);
console.log(`\nAppraisals with template_id (can backfill from template): ${templateBackfill.rows.length}`);

if (dryRun) {
  for (const row of templateBackfill.rows.slice(0, 20)) {
    console.log(`  Appraisal #${row.id}: employee=${row.employee_id}, template=${row.template_id}, cycle_id -> ${row.template_cycle_id}, status=${row.status}, submitted=${row.submitted_at ?? "no"}`);
  }
  if (templateBackfill.rows.length > 20) {
    console.log(`  ... and ${templateBackfill.rows.length - 20} more`);
  }
} else {
  // Update appraisals with template_id — set cycle_id from the template
  const updateResult = await pool.query(
    `UPDATE appraisals ap
     SET cycle_id = ft.cycle_id, updated_at = CURRENT_TIMESTAMP
     FROM form_templates ft
     WHERE ft.id = ap.template_id
       AND ap.cycle_id IS NULL`,
  );
  console.log(`  Updated ${updateResult.rowCount} appraisals with cycle_id from template`);
}

// 4. Backfill appraisals with template_id = NULL (direct score entry)
const nullTemplateCount = await pool.query(
  "SELECT COUNT(*) as cnt FROM appraisals WHERE cycle_id IS NULL AND template_id IS NULL",
);
console.log(`\nAppraisals with template_id = NULL (direct score entry): ${nullTemplateCount.rows[0].cnt}`);

if (!dryRun && nullTemplateCount.rows[0].cnt > 0) {
  const nullTemplateResult = await pool.query(
    `UPDATE appraisals
     SET cycle_id = $1, updated_at = CURRENT_TIMESTAMP
     WHERE cycle_id IS NULL AND template_id IS NULL`,
    [defaultCycleId],
  );
  console.log(`  Updated ${nullTemplateResult.rowCount} appraisals with default cycle_id`);
}

// 5. Verify
const statsAfter = await pool.query(
  "SELECT COUNT(*) as cnt FROM appraisals WHERE cycle_id IS NULL",
);
console.log(`\nAppraisals with cycle_id = NULL after: ${statsAfter.rows[0].cnt}`);

if (statsAfter.rows[0].cnt > 0 && !dryRun) {
  console.log("WARNING: Some appraisals still have cycle_id = NULL — investigate manually.");
} else if (statsAfter.rows[0].cnt === 0 && !dryRun) {
  console.log("SUCCESS: All appraisals now have cycle_id set.");
}

await pool.end();
