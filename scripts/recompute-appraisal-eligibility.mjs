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
const BATCH_SIZE = 200;

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
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env or the environment.",
    );
  }

  return new Pool({
    connectionString,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 120_000,
  });
}

async function ensureEligibilityColumns(client) {
  console.log("Ensuring eligibility columns exist...");
  await client.query(
    `ALTER TABLE appraisals
     ADD COLUMN IF NOT EXISTS eligibility_status VARCHAR(30),
     ADD COLUMN IF NOT EXISTS applicable_duration_factor NUMERIC(3, 1)`,
  );
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

/**
 * Map staff_category_id + staff_sub_category_id → template id (in memory).
 * Faculty sub-categories 4/5 fall back to sub-category 3.
 */
async function loadTemplateMap(client) {
  const result = await client.query(
    `SELECT DISTINCT ON (staff_category_id, staff_sub_category_id)
       staff_category_id,
       staff_sub_category_id,
       id
     FROM form_templates
     WHERE staff_category_id IS NOT NULL
     ORDER BY staff_category_id, staff_sub_category_id, id`,
  );

  const map = new Map();

  for (const row of result.rows) {
    map.set(`${row.staff_category_id}:${row.staff_sub_category_id}`, row.id);
  }

  return map;
}

function resolveTemplateId(user, templateMap) {
  if (!user.staff_category_id) {
    return null;
  }

  const exact = templateMap.get(
    `${user.staff_category_id}:${user.staff_sub_category_id}`,
  );

  if (exact) {
    return exact;
  }

  if (user.staff_sub_category_id === 4 || user.staff_sub_category_id === 5) {
    return templateMap.get(`${user.staff_category_id}:3`) ?? null;
  }

  return null;
}

async function updateExistingAppraisals(client, rows) {
  if (rows.length === 0) {
    return 0;
  }

  await client.query(
    `UPDATE appraisals AS a
     SET template_id = COALESCE(v.template_id, a.template_id),
         uol_experience_years = v.uol_experience_years,
         is_eligible = v.is_eligible,
         eligibility_status = v.eligibility_status,
         applicable_duration = v.applicable_duration,
         applicable_duration_factor = v.applicable_duration_factor,
         updated_at = CURRENT_TIMESTAMP
     FROM UNNEST(
       $1::bigint[],
       $2::bigint[],
       $3::numeric[],
       $4::boolean[],
       $5::text[],
       $6::text[],
       $7::numeric[]
     ) AS v(
       appraisal_id,
       template_id,
       uol_experience_years,
       is_eligible,
       eligibility_status,
       applicable_duration,
       applicable_duration_factor
     )
     WHERE a.id = v.appraisal_id`,
    [
      rows.map((r) => r.appraisalId),
      rows.map((r) => r.templateId),
      rows.map((r) => r.uolExperienceYears),
      rows.map((r) => r.isEligible),
      rows.map((r) => r.eligibilityStatus),
      rows.map((r) => r.applicableDuration),
      rows.map((r) => r.applicableDurationFactor),
    ],
  );

  return rows.length;
}

async function insertMissingAppraisals(client, cycleId, rows) {
  if (rows.length === 0) {
    return 0;
  }

  await client.query(
    `INSERT INTO appraisals (
       employee_id,
       cycle_id,
       template_id,
       status,
       uol_experience_years,
       is_eligible,
       eligibility_status,
       applicable_duration,
       applicable_duration_factor
     )
     SELECT
       v.employee_id,
       v.cycle_id,
       v.template_id,
       v.status::appraisal_status,
       v.uol_experience_years,
       v.is_eligible,
       v.eligibility_status,
       v.applicable_duration,
       v.applicable_duration_factor
     FROM UNNEST(
       $1::bigint[],
       $2::int[],
       $3::bigint[],
       $4::text[],
       $5::numeric[],
       $6::boolean[],
       $7::text[],
       $8::text[],
       $9::numeric[]
     ) AS v(
       employee_id,
       cycle_id,
       template_id,
       status,
       uol_experience_years,
       is_eligible,
       eligibility_status,
       applicable_duration,
       applicable_duration_factor
     )
     ON CONFLICT (employee_id, cycle_id) WHERE cycle_id IS NOT NULL DO UPDATE
       SET template_id = COALESCE(EXCLUDED.template_id, appraisals.template_id),
           uol_experience_years = EXCLUDED.uol_experience_years,
           is_eligible = EXCLUDED.is_eligible,
           eligibility_status = EXCLUDED.eligibility_status,
           applicable_duration = EXCLUDED.applicable_duration,
           applicable_duration_factor = EXCLUDED.applicable_duration_factor,
           updated_at = CURRENT_TIMESTAMP`,
    [
      rows.map((r) => r.userId),
      rows.map(() => cycleId),
      rows.map((r) => r.templateId),
      rows.map(() => "PENDING_SELF_ASSESSMENT"),
      rows.map((r) => r.uolExperienceYears),
      rows.map((r) => r.isEligible),
      rows.map((r) => r.eligibilityStatus),
      rows.map((r) => r.applicableDuration),
      rows.map((r) => r.applicableDurationFactor),
    ],
  );

  return rows.length;
}

async function main() {
  loadEnvFile();
  console.log("Starting appraisal eligibility recompute...");

  const pool = createPool();
  console.log("Connecting to database...");

  const client = await pool.connect();
  console.log("Connected.");

  try {
    await ensureEligibilityColumns(client);

    console.log("Loading active cycle and financial year...");
    const cycle = await getActiveCycle(client);

    if (!cycle) {
      throw new Error("No appraisal cycle found. Create an active cycle first.");
    }

    const financialYear =
      (await getActiveFinancialYear(client)) ?? cycle.fiscal_year ?? null;
    const referenceEndDate = resolveReferenceEndDate({ financialYear });

    console.log(`Cycle id: ${cycle.id}`);
    console.log(`Financial year: ${financialYear}`);
    console.log(`Reference end date: ${formatLocalDate(referenceEndDate)}`);

    console.log("Loading form templates...");
    const templateMap = await loadTemplateMap(client);
    console.log(`Template mappings: ${templateMap.size}`);

    console.log("Loading active employees...");
    const usersResult = await client.query(
      `SELECT
         u.id,
         u.employee_id,
         u.date_of_joining::text,
         u.staff_category_id,
         u.staff_sub_category_id,
         ap.id AS appraisal_id
       FROM users u
       LEFT JOIN appraisals ap
         ON ap.employee_id = u.id
        AND ap.cycle_id = $1
       WHERE u.is_active = TRUE
         AND u.employee_id <> 'EMP-0001'
       ORDER BY u.id`,
      [cycle.id],
    );

    const users = usersResult.rows;
    console.log(`Employees to process: ${users.length}`);

    const statusCounts = {
      "Fully Eligible": 0,
      "Partially Eligible": 0,
      "Not Eligible": 0,
    };
    let skippedNoDoj = 0;
    let updated = 0;
    let created = 0;

    const toUpdate = [];
    const toInsert = [];

    for (const user of users) {
      if (!user.date_of_joining) {
        skippedNoDoj += 1;
      }

      const eligibility = computeAppraisalEligibility(user.date_of_joining, {
        financialYear,
      });
      statusCounts[eligibility.status] += 1;

      const row = {
        userId: user.id,
        appraisalId: user.appraisal_id ? Number(user.appraisal_id) : null,
        templateId: resolveTemplateId(user, templateMap),
        uolExperienceYears: eligibility.uolExperienceYears,
        isEligible: eligibility.isEligible,
        eligibilityStatus: eligibility.status,
        applicableDuration: eligibility.applicableDuration,
        applicableDurationFactor: eligibility.applicableDurationFactor,
      };

      if (row.appraisalId) {
        toUpdate.push(row);
      } else {
        toInsert.push(row);
      }
    }

    console.log(
      `Prepared ${toUpdate.length} updates and ${toInsert.length} inserts. Writing in batches of ${BATCH_SIZE}...`,
    );

    await client.query("BEGIN");

    try {
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + BATCH_SIZE);
        updated += await updateExistingAppraisals(client, batch);
        console.log(
          `  Updated ${Math.min(i + BATCH_SIZE, toUpdate.length)} / ${toUpdate.length}`,
        );
      }

      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        created += await insertMissingAppraisals(client, cycle.id, batch);
        console.log(
          `  Inserted ${Math.min(i + BATCH_SIZE, toInsert.length)} / ${toInsert.length}`,
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    console.log("");
    console.log("Appraisal eligibility recompute completed.");
    console.log(`Employees scanned: ${users.length}`);
    console.log(`Appraisals updated: ${updated}`);
    console.log(`Appraisals created: ${created}`);
    console.log(`Employees without DOJ: ${skippedNoDoj}`);
    console.log("Eligibility breakdown:", statusCounts);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Eligibility recompute failed:", error.message);
  process.exit(1);
});
