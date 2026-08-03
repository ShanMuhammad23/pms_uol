import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  try {
    const envPath = join(__dirname, "..", ".env");
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

async function main() {
  const client = await pool.connect();

  try {
    const sql = readFileSync(
      join(__dirname, "sql", "add-user-additional-access.sql"),
      "utf8",
    );

    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");

    const result = await client.query(
      `SELECT COUNT(*)::text AS total FROM user_additional_access`,
    );

    console.log("Migration complete: user_additional_access table created.");
    console.log(`  Existing rows: ${result.rows[0]?.total ?? 0}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
