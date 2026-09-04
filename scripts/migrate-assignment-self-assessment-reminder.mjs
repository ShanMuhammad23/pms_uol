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

async function main() {
  const client = await pool.connect();
  try {
    console.log("Assignment self-assessment reminder column migration");
    console.log(
      `Database: ${loadDatabaseUrl().replace(/:[^:@/]+@/, ":***@")}`,
    );

    if (
      await columnExists(
        client,
        "employee_form_assignments",
        "last_self_assessment_reminder_at",
      )
    ) {
      warn("Column already exists", "will re-run idempotently");
    }

    const sql = readFileSync(
      join(rootDir, "scripts/sql/add-assignment-self-assessment-reminder.sql"),
      "utf8",
    );

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("COMMIT");
      pass("SQL applied");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    if (
      await columnExists(
        client,
        "employee_form_assignments",
        "last_self_assessment_reminder_at",
      )
    ) {
      pass('Column "employee_form_assignments.last_self_assessment_reminder_at" exists');
    } else {
      fail("Column missing after migration");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("[FATAL]", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
