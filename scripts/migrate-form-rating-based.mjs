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

  const requiredTables = ["form_templates", "form_questions", "appraisal_answers"];
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

  if (
    (await columnExists(client, "form_templates", "rating_based")) &&
    (await tableExists(client, "form_rating_scales"))
  ) {
    warn("Migration appears already applied", "will re-run idempotently");
  }
}

async function applyMigration(client) {
  console.log("\n=== Applying migration ===");

  const sql = readFileSync(
    join(rootDir, "scripts/sql/add-form-rating-based.sql"),
    "utf8",
  );

  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
    pass("SQL migration applied", "scripts/sql/add-form-rating-based.sql");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function runPostChecks(client) {
  console.log("\n=== Post-migration sanity checks ===");

  let ok = true;

  if (await columnExists(client, "form_templates", "rating_based")) {
    pass('Column "form_templates.rating_based" exists');
  } else {
    fail('Column "form_templates.rating_based" missing');
    ok = false;
  }

  if (await tableExists(client, "form_rating_scales")) {
    pass('Table "form_rating_scales" exists');
  } else {
    fail('Table "form_rating_scales" missing');
    ok = false;
  }

  if (await tableExists(client, "form_rating_scale_options")) {
    pass('Table "form_rating_scale_options" exists');
  } else {
    fail('Table "form_rating_scale_options" missing');
    ok = false;
  }

  if (await columnExists(client, "form_questions", "rating_scale_id")) {
    pass('Column "form_questions.rating_scale_id" exists');
  } else {
    fail('Column "form_questions.rating_scale_id" missing');
    ok = false;
  }

  if (await columnExists(client, "appraisal_answers", "rating_value")) {
    pass('Column "appraisal_answers.rating_value" exists');
  } else {
    fail('Column "appraisal_answers.rating_value" missing');
    ok = false;
  }

  return ok;
}

async function main() {
  const client = await pool.connect();
  const startedAt = new Date().toISOString();

  try {
    console.log("Rating-based forms migration");
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
