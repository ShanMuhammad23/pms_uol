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

  const appraisalCount = await client.query(
    "SELECT COUNT(*)::int AS count FROM appraisals",
  );
  const userCount = await client.query(
    "SELECT COUNT(*)::int AS count FROM users",
  );

  pass(
    "Baseline counts",
    `${appraisalCount.rows[0].count} appraisals, ${userCount.rows[0].count} users`,
  );

  const appraisalCol = await columnExists(
    client,
    "appraisals",
    "last_self_assessment_reminder_at",
  );
  const userCol = await columnExists(
    client,
    "users",
    "last_manager_reminder_at",
  );

  if (appraisalCol && userCol) {
    warn("Migration appears already applied", "will re-run idempotently");
  }
}

async function applyMigration(client) {
  console.log("\n=== Applying migration ===");

  const sql = readFileSync(
    join(rootDir, "scripts/sql/add-assessment-reminders.sql"),
    "utf8",
  );

  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
    pass("SQL migration applied", "scripts/sql/add-assessment-reminders.sql");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function runPostChecks(client) {
  console.log("\n=== Post-migration sanity checks ===");

  let ok = true;

  if (await columnExists(client, "appraisals", "last_self_assessment_reminder_at")) {
    pass('Column "appraisals.last_self_assessment_reminder_at" exists');
  } else {
    fail('Column "appraisals.last_self_assessment_reminder_at" missing');
    ok = false;
  }

  if (await columnExists(client, "users", "last_manager_reminder_at")) {
    pass('Column "users.last_manager_reminder_at" exists');
  } else {
    fail('Column "users.last_manager_reminder_at" missing');
    ok = false;
  }

  return ok;
}

async function main() {
  const client = await pool.connect();
  const startedAt = new Date().toISOString();

  try {
    console.log("Assessment Reminders migration");
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
