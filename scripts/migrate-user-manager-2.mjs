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
      join(__dirname, "sql", "add-user-manager-2.sql"),
      "utf8",
    );

    const before = await client
      .query(
        `SELECT
           COUNT(*)::text AS total,
           COUNT(head_id)::text AS with_m1,
           COUNT(manager_2_id)::text AS with_m2
         FROM users`,
      )
      .catch(() => null);

    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");

    const after = await client.query(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(head_id)::text AS with_m1,
         COUNT(manager_2_id)::text AS with_m2,
         COUNT(*) FILTER (
           WHERE head_id IS NOT NULL
             AND manager_2_id IS NULL
         )::text AS fillable_missing_m2
       FROM users`,
    );

    const sample = await client.query(
      `SELECT
         u.employee_id,
         CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
         CONCAT(m1.first_name, ' ', m1.last_name) AS manager_1,
         CONCAT(m2.first_name, ' ', m2.last_name) AS manager_2
       FROM users u
       LEFT JOIN users m1 ON m1.id = u.head_id
       LEFT JOIN users m2 ON m2.id = u.manager_2_id
       WHERE u.manager_2_id IS NOT NULL
       ORDER BY u.first_name, u.last_name
       LIMIT 8`,
    );

    const stillMissing = await client.query(
      `SELECT
         u.employee_id,
         CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
         CONCAT(m1.first_name, ' ', m1.last_name) AS manager_1,
         CASE
           WHEN u.head_id IS NULL THEN 'no Manager 1'
           WHEN m1.entity_id IS NULL THEN 'Manager 1 has no entity'
           ELSE 'no eligible parent-entity head'
         END AS reason
       FROM users u
       LEFT JOIN users m1 ON m1.id = u.head_id
       WHERE u.is_active = TRUE
         AND u.manager_2_id IS NULL
         AND u.head_id IS NOT NULL
         AND u.employee_id <> 'EMP-0001'
       ORDER BY u.first_name, u.last_name
       LIMIT 12`,
    );

    console.log("Migration completed: users.manager_2_id ready.");
    if (before?.rows[0]) {
      console.log(
        `Before: total=${before.rows[0].total}, with_m1=${before.rows[0].with_m1}, with_m2=${before.rows[0].with_m2}`,
      );
    }
    console.log(
      `After:  total=${after.rows[0].total}, with_m1=${after.rows[0].with_m1}, with_m2=${after.rows[0].with_m2}`,
    );
    console.log(
      `Users with Manager 1 but still no Manager 2: ${after.rows[0].fillable_missing_m2}`,
    );

    if (sample.rows.length > 0) {
      console.log("\nSample filled Manager 2 assignments:");
      for (const row of sample.rows) {
        console.log(
          `  ${row.employee_id} ${row.employee_name} | M1: ${row.manager_1 ?? "—"} | M2: ${row.manager_2 ?? "—"}`,
        );
      }
    }

    if (stillMissing.rows.length > 0) {
      console.log("\nSample active users still without Manager 2:");
      for (const row of stillMissing.rows) {
        console.log(
          `  ${row.employee_id} ${row.employee_name} | M1: ${row.manager_1 ?? "—"} | ${row.reason}`,
        );
      }
      console.log(
        "\nThese can be set manually in Users → Edit (Manager 2 select).",
      );
    }
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
