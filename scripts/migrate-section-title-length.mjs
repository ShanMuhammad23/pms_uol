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

async function columnLength(client, tableName, columnName) {
  const result = await client.query(
    `SELECT data_type, character_maximum_length
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2`,
    [tableName, columnName],
  );
  if (result.rows.length === 0) {
    return null;
  }
  // TEXT columns have character_maximum_length = NULL → treat as unlimited.
  if (result.rows[0].data_type === "text") {
    return Number.POSITIVE_INFINITY;
  }
  return Number(result.rows[0].character_maximum_length);
}

async function runPreChecks(client) {
  console.log("\n=== Pre-migration sanity checks ===");

  const requiredTables = ["form_sections", "form_templates"];
  let ok = true;

  for (const table of requiredTables) {
    const result = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    if (result.rows.length > 0) {
      pass(`Table "${table}" exists`);
    } else {
      fail(`Table "${table}" missing`);
      ok = false;
    }
  }

  if (!ok) {
    throw new Error(
      "Prerequisites missing. Run full setup first: node scripts/setup-db.mjs",
    );
  }

  const sectionLen = await columnLength(client, "form_sections", "title");
  if (sectionLen != null && (sectionLen === Number.POSITIVE_INFINITY || sectionLen >= 500)) {
    pass(
      `form_sections.title is already unlimited/TEXT (current: ${sectionLen === Number.POSITIVE_INFINITY ? "TEXT" : `VARCHAR(${sectionLen})`})`,
      "will re-run idempotently",
    );
  }
}

async function applyMigration(client) {
  console.log("\n=== Applying migration ===");

  const sql = readFileSync(
    join(rootDir, "scripts/sql/increase-section-title-length.sql"),
    "utf8",
  );

  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
    pass("SQL migration applied", "scripts/sql/increase-section-title-length.sql");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function runPostChecks(client) {
  console.log("\n=== Post-migration sanity checks ===");

  const sectionLen = await columnLength(client, "form_sections", "title");
  if (sectionLen === Number.POSITIVE_INFINITY) {
    pass("form_sections.title is TEXT (unlimited)");
  } else {
    fail(`form_sections.title is VARCHAR(${sectionLen}) — expected TEXT`);
  }

  const templateLen = await columnLength(client, "form_templates", "title");
  if (templateLen === Number.POSITIVE_INFINITY) {
    pass("form_templates.title is TEXT (unlimited)");
  } else {
    fail(`form_templates.title is VARCHAR(${templateLen}) — expected TEXT`);
  }
}

async function main() {
  console.log("Section/Form Title Length migration");
  console.log("====================================");

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
