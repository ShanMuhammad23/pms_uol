import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:uzair1321@127.0.0.1:5432/pms_uol",
});

async function main() {
  const client = await pool.connect();

  try {
    const tables = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    console.log(
      "Existing tables:",
      tables.rows.map((row) => row.tablename).join(", ") || "(none)",
    );

    if (!tables.rows.some((row) => row.tablename === "users")) {
      const schema = readFileSync(join(rootDir, "schema.sql"), "utf8");
      await client.query(schema);
      console.log("Schema applied successfully.");
    } else {
      console.log("users table already exists, skipping schema.");
      await client.query(`
        ALTER TABLE appraisals
        ADD COLUMN IF NOT EXISTS template_id BIGINT
        REFERENCES form_templates(id) ON DELETE SET NULL
      `);
      console.log("Ensured appraisals.template_id column exists.");

      await client.query(`
        ALTER TABLE form_questions
        ADD COLUMN IF NOT EXISTS self_assessment_enabled BOOLEAN NOT NULL DEFAULT FALSE
      `);
      await client.query(`
        ALTER TABLE form_questions
        ADD COLUMN IF NOT EXISTS hod_assessment_enabled BOOLEAN NOT NULL DEFAULT FALSE
      `);
      await client.query(`
        ALTER TABLE form_questions
        ADD COLUMN IF NOT EXISTS total_marks INT NOT NULL DEFAULT 0
      `);
      console.log("Ensured form_questions assessment columns exist.");
    }

    await client.query(
      "INSERT INTO departments (name) VALUES ('Head Office') ON CONFLICT (name) DO NOTHING",
    );

    const deptResult = await client.query(
      "SELECT id FROM departments WHERE name = 'Head Office' LIMIT 1",
    );
    const deptId = deptResult.rows[0]?.id;

    const passwordHash = bcrypt.hashSync("Admin@123", 10);
    const existing = await client.query(
      "SELECT id, email FROM users WHERE email = 'superadmin@uol.edu.pk'",
    );

    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO users (
          employee_id,
          email,
          password_hash,
          first_name,
          last_name,
          system_role,
          emp_category,
          emp_sub_category,
          department_id,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)`,
        [
          "EMP-0001",
          "superadmin@uol.edu.pk",
          passwordHash,
          "Super",
          "Admin",
          "SUPER_ADMIN",
          "ADMINISTRATION",
          "SYSTEM_ADMIN",
          deptId,
        ],
      );
      console.log("Super admin created.");
      console.log("Email: superadmin@uol.edu.pk");
      console.log("Password: Admin@123");
    } else {
      console.log("Super admin already exists:", existing.rows[0].email);
    }

    const currentYear = new Date().getFullYear();
    await client.query(
      `INSERT INTO appraisal_cycles (fiscal_year, start_date, end_date, is_active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (fiscal_year) DO NOTHING`,
      [
        currentYear,
        `${currentYear}-01-01`,
        `${currentYear}-12-31`,
      ],
    );
    console.log(`Default appraisal cycle seeded for fiscal year ${currentYear}.`);

    const users = await client.query(
      "SELECT id, email, system_role, is_active FROM users",
    );
    console.log("Users:", JSON.stringify(users.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("ERROR:", error.message);
  process.exit(1);
});
