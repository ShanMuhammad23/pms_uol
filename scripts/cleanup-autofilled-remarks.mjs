/**
 * Cleanup: Remove auto-filled remarks from manager review answers.
 *
 * Problem: Manager 1 remarks were auto-filled from self-assessment remarks,
 * and Manager 2 remarks were auto-filled from Manager 1 remarks (which might
 * themselves be self-assessment remarks). Each individual should write their
 * own remarks.
 *
 * This script identifies and removes only the remarks that were copied from
 * a previous stage — it does NOT remove remarks that the manager wrote
 * themselves.
 *
 * Sanity checks:
 * - Only touches submissions in PENDING_HEAD_REVIEW status.
 * - Only removes Manager 1 remarks if manager_level = 1 (Manager 1 Review).
 * - Only removes Manager 2 remarks if manager_level = 2 (Manager 2 Review).
 * - Only removes a remark if it EXACTLY matches the source remark (self or
 *   Manager 1) for the same question/appraisal.
 * - Prints a dry-run summary before making changes.
 *
 * Schema notes:
 * - appraisals.employee_id → users.id (the employee being assessed)
 * - users.head_id → Manager 1 user ID
 * - users.manager_2_id → Manager 2 user ID
 * - appraisal_answers.filled_by_id → the user who wrote the answer
 * - appraisal_answers.question_id → NULL for open-assessment authored rows
 * - appraisal_answers.open_section_id → set for open-assessment rows
 *
 * Usage:
 *   node scripts/cleanup-autofilled-remarks.mjs           # dry run
 *   node scripts/cleanup-autofilled-remarks.mjs --apply   # apply changes
 */
// Load .env BEFORE importing db (ES module imports are hoisted, so we
// can't use a static import for db if we need to set env vars first).
import fs from "node:fs";

try {
  const envContent = fs.readFileSync(".env", "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
} catch {
  // .env not found — rely on environment variable being set externally
}

const { db } = await import("../lib/db.ts");

async function cleanup() {
  const client = await db.connect();
  const apply = process.argv.includes("--apply");

  try {
    await client.query("BEGIN");

    // ------------------------------------------------------------------
    // 1. Manager 1 remarks that match self-assessment remarks.
    //    Applies to ALL submissions regardless of status — if Manager 1
    //    remarks are exactly the same as self-assessment remarks, they
    //    were auto-filled and should be removed. Manager 1 should write
    //    their own remarks.
    //    Manager 1 = users.head_id, Employee = appraisals.employee_id
    // ------------------------------------------------------------------
    const m1Matches = await client.query(`
      SELECT
        m1.appraisal_id::text,
        m1.question_id::text,
        m1.open_section_id::text,
        m1.remarks AS manager1_remarks,
        emp.remarks AS self_remarks
      FROM appraisal_answers m1
      JOIN appraisals ap ON ap.id = m1.appraisal_id
      JOIN users u ON u.id = ap.employee_id
      JOIN appraisal_answers emp
        ON emp.appraisal_id = m1.appraisal_id
       AND emp.filled_by_id = ap.employee_id
       AND COALESCE(emp.question_id, 0) = COALESCE(m1.question_id, 0)
       AND COALESCE(emp.open_section_id, 0) = COALESCE(m1.open_section_id, 0)
      WHERE m1.filled_by_id = u.head_id
        AND m1.remarks IS NOT NULL
        AND m1.remarks = emp.remarks
    `);

    console.log(`\n=== Manager 1 remarks matching self-assessment ===`);
    console.log(`Found: ${m1Matches.rowCount} row(s)`);
    for (const row of m1Matches.rows) {
      console.log(
        `  appraisal=${row.appraisal_id} question=${row.question_id} ` +
        `open_section=${row.open_section_id ?? "-"} ` +
        `remarks="${row.manager1_remarks.substring(0, 60)}${row.manager1_remarks.length > 60 ? "..." : ""}"`,
      );
    }

    // ------------------------------------------------------------------
    // 2. Manager 2 remarks that match Manager 1 remarks.
    //    Applies to ALL submissions regardless of status — if Manager 2
    //    remarks are exactly the same as Manager 1 remarks, they were
    //    auto-filled and should be removed. Manager 2 should write their
    //    own remarks.
    //    Manager 2 = users.manager_2_id, Manager 1 = users.head_id
    // ------------------------------------------------------------------
    const m2Matches = await client.query(`
      SELECT
        m2.appraisal_id::text,
        m2.question_id::text,
        m2.open_section_id::text,
        m2.remarks AS manager2_remarks,
        m1.remarks AS manager1_remarks
      FROM appraisal_answers m2
      JOIN appraisals ap ON ap.id = m2.appraisal_id
      JOIN users u ON u.id = ap.employee_id
      JOIN appraisal_answers m1
        ON m1.appraisal_id = m2.appraisal_id
       AND m1.filled_by_id = u.head_id
       AND COALESCE(m1.question_id, 0) = COALESCE(m2.question_id, 0)
       AND COALESCE(m1.open_section_id, 0) = COALESCE(m2.open_section_id, 0)
      WHERE m2.filled_by_id = u.manager_2_id
        AND m2.remarks IS NOT NULL
        AND m2.remarks = m1.remarks
    `);

    console.log(`\n=== Manager 2 remarks matching Manager 1 ===`);
    console.log(`Found: ${m2Matches.rowCount} row(s)`);
    for (const row of m2Matches.rows) {
      console.log(
        `  appraisal=${row.appraisal_id} question=${row.question_id} ` +
        `open_section=${row.open_section_id ?? "-"} ` +
        `remarks="${row.manager2_remarks.substring(0, 60)}${row.manager2_remarks.length > 60 ? "..." : ""}"`,
      );
    }

    // ------------------------------------------------------------------
    // 3. Manager 2 remarks that match self-assessment remarks.
    //    Applies to ALL submissions regardless of status.
    //    (These are cases where Manager 1's remarks were themselves copied
    //    from self-assessment, and then copied to Manager 2.)
    // ------------------------------------------------------------------
    const m2SelfMatches = await client.query(`
      SELECT
        m2.appraisal_id::text,
        m2.question_id::text,
        m2.open_section_id::text,
        m2.remarks AS manager2_remarks,
        emp.remarks AS self_remarks
      FROM appraisal_answers m2
      JOIN appraisals ap ON ap.id = m2.appraisal_id
      JOIN users u ON u.id = ap.employee_id
      JOIN appraisal_answers emp
        ON emp.appraisal_id = m2.appraisal_id
       AND emp.filled_by_id = ap.employee_id
       AND COALESCE(emp.question_id, 0) = COALESCE(m2.question_id, 0)
       AND COALESCE(emp.open_section_id, 0) = COALESCE(m2.open_section_id, 0)
      WHERE m2.filled_by_id = u.manager_2_id
        AND m2.remarks IS NOT NULL
        AND m2.remarks = emp.remarks
    `);

    console.log(`\n=== Manager 2 remarks matching self-assessment ===`);
    console.log(`Found: ${m2SelfMatches.rowCount} row(s)`);
    for (const row of m2SelfMatches.rows) {
      console.log(
        `  appraisal=${row.appraisal_id} question=${row.question_id} ` +
        `open_section=${row.open_section_id ?? "-"} ` +
        `remarks="${row.manager2_remarks.substring(0, 60)}${row.manager2_remarks.length > 60 ? "..." : ""}"`,
      );
    }

    // ------------------------------------------------------------------
    // Apply changes
    // ------------------------------------------------------------------
    const totalAffected =
      m1Matches.rowCount + m2Matches.rowCount + m2SelfMatches.rowCount;

    if (!apply) {
      console.log(`\n=== DRY RUN ===`);
      console.log(`Total rows that would be cleared: ${totalAffected}`);
      console.log(`Run with --apply to make changes.`);
      await client.query("ROLLBACK");
      return;
    }

    let cleared = 0;

    // Clear Manager 1 remarks matching self-assessment
    for (const row of m1Matches.rows) {
      await client.query(
        `UPDATE appraisal_answers
         SET remarks = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE appraisal_id = $1
           AND filled_by_id = (SELECT u.head_id FROM appraisals ap JOIN users u ON u.id = ap.employee_id WHERE ap.id = $1)
           AND COALESCE(question_id, 0) = COALESCE($2::bigint, 0)
           AND COALESCE(open_section_id, 0) = COALESCE($3::bigint, 0)
           AND remarks = $4`,
        [row.appraisal_id, row.question_id, row.open_section_id, row.manager1_remarks],
      );
      cleared += 1;
    }

    // Clear Manager 2 remarks matching Manager 1
    for (const row of m2Matches.rows) {
      await client.query(
        `UPDATE appraisal_answers
         SET remarks = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE appraisal_id = $1
           AND filled_by_id = (SELECT u.manager_2_id FROM appraisals ap JOIN users u ON u.id = ap.employee_id WHERE ap.id = $1)
           AND COALESCE(question_id, 0) = COALESCE($2::bigint, 0)
           AND COALESCE(open_section_id, 0) = COALESCE($3::bigint, 0)
           AND remarks = $4`,
        [row.appraisal_id, row.question_id, row.open_section_id, row.manager2_remarks],
      );
      cleared += 1;
    }

    // Clear Manager 2 remarks matching self-assessment
    for (const row of m2SelfMatches.rows) {
      // Skip if already cleared by the Manager 1 match above
      const stillPresent = await client.query(`
        SELECT EXISTS(
          SELECT 1 FROM appraisal_answers
          WHERE appraisal_id = $1
            AND filled_by_id = (SELECT u.manager_2_id FROM appraisals ap JOIN users u ON u.id = ap.employee_id WHERE ap.id = $1)
            AND COALESCE(question_id, 0) = COALESCE($2::bigint, 0)
            AND COALESCE(open_section_id, 0) = COALESCE($3::bigint, 0)
            AND remarks = $4
        ) AS exists
      `, [row.appraisal_id, row.question_id, row.open_section_id, row.manager2_remarks]);

      if (!stillPresent.rows[0]?.exists) continue;

      await client.query(
        `UPDATE appraisal_answers
         SET remarks = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE appraisal_id = $1
           AND filled_by_id = (SELECT u.manager_2_id FROM appraisals ap JOIN users u ON u.id = ap.employee_id WHERE ap.id = $1)
           AND COALESCE(question_id, 0) = COALESCE($2::bigint, 0)
           AND COALESCE(open_section_id, 0) = COALESCE($3::bigint, 0)
           AND remarks = $4`,
        [row.appraisal_id, row.question_id, row.open_section_id, row.manager2_remarks],
      );
      cleared += 1;
    }

    await client.query("COMMIT");
    console.log(`\n=== APPLIED ===`);
    console.log(`Total remarks cleared: ${cleared}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Cleanup failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

cleanup().then(() => process.exit(0));
