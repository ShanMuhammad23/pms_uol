import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:uzair1321@127.0.0.1:5432/pms_uol",
});

const email = "superadmin@uol.edu.pk";
const password = "Admin@123";

const result = await pool.query(
  `
    SELECT id, email, password_hash, first_name, last_name, system_role, is_active
    FROM users
    WHERE lower(email) = lower($1)
    LIMIT 1
  `,
  [email],
);

const user = result.rows[0];
if (!user) {
  console.log("User not found for:", email);
  process.exit(1);
}

const valid = await bcrypt.compare(password, user.password_hash);
console.log("User:", user.email, user.system_role, "active:", user.is_active);
console.log("Password valid:", valid);

await pool.end();
