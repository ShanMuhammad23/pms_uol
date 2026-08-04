import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:uzair1321@127.0.0.1:5432/pms_uol",
});

async function main() {
  const client = await pool.connect();

  try {
    const sql = readFileSync(
      join(__dirname, "sql", "add-excel-sheet-columns.sql"),
      "utf8",
    );

    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");

    console.log("Migration completed: Excel sheet columns ready.");
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
