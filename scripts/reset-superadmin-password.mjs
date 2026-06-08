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
const passwordHash = bcrypt.hashSync(password, 10);

await pool.query(
  "UPDATE users SET password_hash = $1 WHERE lower(email) = lower($2)",
  [passwordHash, email],
);

const valid = await bcrypt.compare(
  password,
  (
    await pool.query(
      "SELECT password_hash FROM users WHERE lower(email) = lower($1)",
      [email],
    )
  ).rows[0].password_hash,
);

console.log("Password reset for:", email);
console.log("New password:", password);
console.log("Verification:", valid ? "OK" : "FAILED");

await pool.end();
