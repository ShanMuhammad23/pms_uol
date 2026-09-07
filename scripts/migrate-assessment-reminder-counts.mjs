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
    console.log("Assessment reminder count columns migration");
    console.log(
      `Database: ${loadDatabaseUrl().replace(/:[^:@/]+@/, ":***@")}`,
    );

    if (
      (await columnExists(
        client,
        "employee_form_assignments",
        "self_assessment_reminder_count",
      )) &&
      (await columnExists(client, "users", "manager_reminder_count"))
    ) {
      warn("Columns already exist", "will re-run idempotently");
    }

    const sql = readFileSync(
      join(rootDir, "scripts/sql/add-assessment-reminder-counts.sql"),
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

    const efaOk = await columnExists(
      client,
      "employee_form_assignments",
      "self_assessment_reminder_count",
    );
    const usersOk = await columnExists(
      client,
      "users",
      "manager_reminder_count",
    );

    if (efaOk) {
      pass(
        'Column "employee_form_assignments.self_assessment_reminder_count" exists',
      );
    } else {
      fail("employee_form_assignments.self_assessment_reminder_count missing");
      process.exitCode = 1;
    }

    if (usersOk) {
      pass('Column "users.manager_reminder_count" exists');
    } else {
      fail("users.manager_reminder_count missing");
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
