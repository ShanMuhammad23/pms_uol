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

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return result.rows.length > 0;
}

async function main() {
  const client = await pool.connect();

  try {
    const sql = readFileSync(
      join(__dirname, "sql", "add-sub-category-increment-matrices.sql"),
      "utf8",
    );

    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");

    const exists = await tableExists(client, "sub_category_increment_matrices");
    if (!exists) {
      throw new Error("sub_category_increment_matrices table was not created.");
    }

    console.log("Migration completed: sub_category_increment_matrices ready.");
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
