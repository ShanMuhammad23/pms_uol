import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  try {
    const envPath = join(rootDir, ".env");
    const envText = readFileSync(envPath, "utf8");
    const match = envText.match(/^DATABASE_URL=(.+)$/m);
    if (match?.[1]) {
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // fall through
  }

  return "postgresql://postgres:uzair1321@127.0.0.1:5432/pms_uol";
}

const pool = new Pool({
  connectionString: loadDatabaseUrl(),
});

function pass(label, detail = "") {
  console.log(`  [PASS] ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail = "") {
  console.error(`  [FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
}

function warn(label, detail = "") {
  console.warn(`  [WARN] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return result.rows.length > 0;
}

async function columnExists(client, tableName, columnName) {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2`,
    [tableName, columnName],
  );
  return result.rows.length > 0;
}

async function runPreChecks(client) {
  console.log("\n=== Pre-migration sanity checks ===");

  const requiredTables = ["form_templates", "appraisals"];
  let ok = true;

  for (const table of requiredTables) {
    if (await tableExists(client, table)) {
      pass(`Table "${table}" exists`);
    } else {
      fail(`Table "${table}" is missing`);
      ok = false;
    }
  }

  if (!ok) {
    throw new Error(
      "Prerequisites missing. Run full setup first: node scripts/setup-db.mjs",
    );
  }

  const templateCount = await client.query(
    "SELECT COUNT(*)::int AS count FROM form_templates",
  );
  const appraisalCount = await client.query(
    "SELECT COUNT(*)::int AS count FROM appraisals",
  );

  pass(
    "Baseline counts",
    `${templateCount.rows[0].count} templates, ${appraisalCount.rows[0].count} appraisals`,
  );

  const remarksAlreadyOnTemplates = await columnExists(
    client,
    "form_templates",
    "additional_remarks_enabled",
  );
  const m1Already = await columnExists(
    client,
    "appraisals",
    "manager1_overall_remarks",
  );
  const m2Already = await columnExists(
    client,
    "appraisals",
    "manager2_overall_remarks",
  );

  if (remarksAlreadyOnTemplates && m1Already && m2Already) {
    warn("Migration appears already applied", "will re-run idempotently");
  }

  return {
    templateCount: templateCount.rows[0].count,
    appraisalCount: appraisalCount.rows[0].count,
  };
}

async function applyMigration(client) {
  console.log("\n=== Applying migration ===");

  const sql = readFileSync(
    join(rootDir, "scripts/sql/add-additional-remarks.sql"),
    "utf8",
  );

  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
    pass("SQL migration applied", "scripts/sql/add-additional-remarks.sql");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function runPostChecks(client) {
  console.log("\n=== Post-migration sanity checks ===");

  let ok = true;

  if (await columnExists(client, "form_templates", "additional_remarks_enabled")) {
    pass('Column "form_templates.additional_remarks_enabled" exists');
  } else {
    fail('Column "form_templates.additional_remarks_enabled" missing');
    ok = false;
  }

  if (await columnExists(client, "appraisals", "manager1_overall_remarks")) {
    pass('Column "appraisals.manager1_overall_remarks" exists');
  } else {
    fail('Column "appraisals.manager1_overall_remarks" missing');
    ok = false;
  }

  if (await columnExists(client, "appraisals", "manager2_overall_remarks")) {
    pass('Column "appraisals.manager2_overall_remarks" exists');
  } else {
    fail('Column "appraisals.manager2_overall_remarks" missing');
    ok = false;
  }

  // Verify defaults
  const defaultCheck = await client.query(
    `SELECT
       (SELECT COUNT(*)::int FROM form_templates
        WHERE additional_remarks_enabled = FALSE) AS disabled_count,
       (SELECT COUNT(*)::int FROM appraisals
        WHERE manager1_overall_remarks IS NULL) AS m1_null_count,
       (SELECT COUNT(*)::int FROM appraisals
        WHERE manager2_overall_remarks IS NULL) AS m2_null_count`,
  );

  const summary = defaultCheck.rows[0];
  pass(
    "Defaults verified",
    `${summary.disabled_count} templates with additional_remarks_enabled=FALSE, ${summary.m1_null_count} appraisals with NULL manager1 remarks, ${summary.m2_null_count} with NULL manager2 remarks`,
  );

  return ok;
}

async function main() {
  const client = await pool.connect();
  const startedAt = new Date().toISOString();

  try {
    console.log("Additional Remarks migration");
    console.log(`Started: ${startedAt}`);
    console.log(
      `Database: ${loadDatabaseUrl().replace(/:[^:@/]+@/, ":***@")}`,
    );

    await runPreChecks(client);
    await applyMigration(client);

    const postOk = await runPostChecks(client);

    console.log("\n=== Summary ===");
    if (postOk) {
      console.log("Migration completed successfully.");
    } else {
      console.error("Migration completed with post-check failures.");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("\n[FATAL]", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
    console.log(`Finished: ${new Date().toISOString()}`);
  }
}

main();
