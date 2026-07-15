import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import {
  computeAppraisalEligibility,
  resolveReferenceEndDate,
} from "../lib/appraisal-eligibility.js";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  const envPath = join(__dirname, "..", ".env");

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const index = line.indexOf("=");

    if (index > 0 && !line.trim().startsWith("#")) {
      process.env[line.slice(0, index).trim()] = line
        .slice(index + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createPool() {
  return new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:uzair1321@127.0.0.1:5432/pms_uol",
  });
}

async function getActiveCycle(client) {
  const result = await client.query(
    `SELECT id, fiscal_year, end_date::text
     FROM appraisal_cycles
     ORDER BY is_active DESC, fiscal_year DESC
     LIMIT 1`,
  );

  return result.rows[0] ?? null;
}

async function getActiveFinancialYear(client) {
  const result = await client.query(
    `SELECT year
     FROM financial_years
     WHERE is_active = TRUE
     ORDER BY year DESC
     LIMIT 1`,
  );

  return result.rows[0]?.year ?? null;
}

async function resolveTemplateId(client, user) {
  if (!user.staff_category_id) {
    return null;
  }

  const exact = await client.query(
    `SELECT id
     FROM form_templates
     WHERE staff_category_id = $1
       AND staff_sub_category_id = $2
     ORDER BY id
     LIMIT 1`,
    [user.staff_category_id, user.staff_sub_category_id],
  );

  if (exact.rows[0]) {
    return exact.rows[0].id;
  }

  if (user.staff_sub_category_id === 4 || user.staff_sub_category_id === 5) {
    const facultyTemplate = await client.query(
      `SELECT id
       FROM form_templates
       WHERE staff_category_id = $1
         AND staff_sub_category_id = 3
       ORDER BY id
       LIMIT 1`,
      [user.staff_category_id],
    );

    if (facultyTemplate.rows[0]) {
      return facultyTemplate.rows[0].id;
    }
  }

  return null;
}

async function upsertAppraisal(client, user, cycleId, templateId, eligibility) {
  const byCycle = await client.query(
    `SELECT id
     FROM appraisals
     WHERE employee_id = $1
       AND cycle_id = $2
     LIMIT 1`,
    [user.id, cycleId],
  );

  if (byCycle.rows[0]) {
    await client.query(
      `UPDATE appraisals
       SET template_id = COALESCE($2, template_id),
           uol_experience_years = $3,
           is_eligible = $4,
           applicable_duration = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [
        byCycle.rows[0].id,
        templateId,
        eligibility.uolExperienceYears,
        eligibility.isEligible,
        eligibility.applicableDuration,
      ],
    );

    return { id: byCycle.rows[0].id, created: false };
  }

  if (templateId) {
    const byTemplate = await client.query(
      `SELECT id
       FROM appraisals
       WHERE employee_id = $1
         AND template_id = $2
       LIMIT 1`,
      [user.id, templateId],
    );

    if (byTemplate.rows[0]) {
      await client.query(
        `UPDATE appraisals
         SET cycle_id = $2,
             uol_experience_years = $3,
             is_eligible = $4,
             applicable_duration = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [
          byTemplate.rows[0].id,
          cycleId,
          eligibility.uolExperienceYears,
          eligibility.isEligible,
          eligibility.applicableDuration,
        ],
      );

      return { id: byTemplate.rows[0].id, created: false };
    }
  }

  const existingAny = await client.query(
    `SELECT id
     FROM appraisals
     WHERE employee_id = $1
     ORDER BY updated_at DESC NULLS LAST, id DESC
     LIMIT 1`,
    [user.id],
  );

  if (existingAny.rows[0]) {
    await client.query(
      `UPDATE appraisals
       SET cycle_id = $2,
           template_id = COALESCE($3, template_id),
           uol_experience_years = $4,
           is_eligible = $5,
           applicable_duration = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [
        existingAny.rows[0].id,
        cycleId,
        templateId,
        eligibility.uolExperienceYears,
        eligibility.isEligible,
        eligibility.applicableDuration,
      ],
    );

    return { id: existingAny.rows[0].id, created: false };
  }

  const inserted = await client.query(
    `INSERT INTO appraisals (
       employee_id,
       cycle_id,
       template_id,
       status,
       uol_experience_years,
       is_eligible,
       applicable_duration
     )
     VALUES ($1, $2, $3, 'PENDING_SELF_ASSESSMENT', $4, $5, $6)
     RETURNING id`,
    [
      user.id,
      cycleId,
      templateId,
      eligibility.uolExperienceYears,
      eligibility.isEligible,
      eligibility.applicableDuration,
    ],
  );

  return { id: inserted.rows[0].id, created: true };
}

async function main() {
  loadEnvFile();
  const pool = createPool();
  const client = await pool.connect();

  try {
    const cycle = await getActiveCycle(client);

    if (!cycle) {
      throw new Error("No appraisal cycle found. Create an active cycle first.");
    }

    const financialYear = await getActiveFinancialYear(client);
    const referenceEndDate = resolveReferenceEndDate({
      financialYear,
      cycleEndDate: cycle.end_date,
    });

    const users = await client.query(
      `SELECT
         id,
         employee_id,
         date_of_joining::text,
         staff_category_id,
         staff_sub_category_id
       FROM users
       WHERE is_active = TRUE
         AND employee_id <> 'EMP-0001'
       ORDER BY id`,
    );

    let created = 0;
    let updated = 0;
    let skippedNoDoj = 0;
    const statusCounts = {
      "Fully Eligible": 0,
      "Partially Eligible": 0,
      "Not Eligible": 0,
    };

    await client.query("BEGIN");

    for (const user of users.rows) {
      if (!user.date_of_joining) {
        skippedNoDoj += 1;
      }

      const eligibility = computeAppraisalEligibility(user.date_of_joining, {
        financialYear,
        cycleEndDate: formatLocalDate(referenceEndDate),
      });

      statusCounts[eligibility.status] += 1;

      const templateId = await resolveTemplateId(client, user);
      const result = await upsertAppraisal(
        client,
        user,
        cycle.id,
        templateId,
        eligibility,
      );

      if (result.created) {
        created += 1;
      } else {
        updated += 1;
      }
    }

    await client.query("COMMIT");

    console.log("Appraisal eligibility recompute completed.");
    console.log(`Cycle id: ${cycle.id}`);
    console.log(`Reference end date: ${formatLocalDate(referenceEndDate)}`);
    console.log(`Employees scanned: ${users.rows.length}`);
    console.log(`Appraisals created: ${created}`);
    console.log(`Appraisals updated: ${updated}`);
    console.log(`Employees without DOJ: ${skippedNoDoj}`);
    console.log("Eligibility breakdown:", statusCounts);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Eligibility recompute failed:", error.message);
  process.exit(1);
});
