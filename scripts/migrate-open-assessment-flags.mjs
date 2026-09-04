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

  const result = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'form_sections'`,
  );
  if (result.rows.length > 0) {
    pass('Table "form_sections" exists');
  } else {
    fail('Table "form_sections" missing');
    throw new Error(
      "Prerequisites missing. Run full setup first: node scripts/setup-db.mjs",
    );
  }

  if (await columnExists(client, "form_sections", "self_assessment_enabled")) {
    pass('Column "self_assessment_enabled" already exists', "will re-run idempotently");
  }
  if (await columnExists(client, "form_sections", "hod_assessment_enabled")) {
    pass('Column "hod_assessment_enabled" already exists', "will re-run idempotently");
  }
}

async function applyMigration(client) {
  console.log("\n=== Applying migration ===");

  const sql = readFileSync(
    join(rootDir, "scripts/sql/add-open-assessment-flags.sql"),
    "utf8",
  );

  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
    pass("SQL migration applied", "scripts/sql/add-open-assessment-flags.sql");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function runPostChecks(client) {
  console.log("\n=== Post-migration sanity checks ===");

  if (await columnExists(client, "form_sections", "self_assessment_enabled")) {
    pass('Column "form_sections.self_assessment_enabled" exists');
  } else {
    fail('Column "form_sections.self_assessment_enabled" missing');
  }

  if (await columnExists(client, "form_sections", "hod_assessment_enabled")) {
    pass('Column "form_sections.hod_assessment_enabled" exists');
  } else {
    fail('Column "form_sections.hod_assessment_enabled" missing');
  }
}

async function main() {
  console.log("Open-Assessment Section Flags migration");
  console.log("========================================");

  const client = await pool.connect();
  try {
    await runPreChecks(client);
    await applyMigration(client);
    await runPostChecks(client);
    console.log("\nMigration complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("\n[FATAL]", error.message);
  process.exit(1);
});
