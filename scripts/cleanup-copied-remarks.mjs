/**
 * Cleanup: Remove remarks that were incorrectly copied from the previous
 * stage into the next reviewer's answers.
 *
 * - Submissions in Manager 1 review: clear Manager 1's question-level remarks.
 * - Submissions in Manager 2 review: clear Manager 2's question-level remarks.
 *
 * Scores, ratings, self-assessment remarks, and overall remarks are NOT touched.
 */
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

async function main() {
  const client = await pool.connect();
  try {
    // 1. Clear Manager 1's remarks for submissions in Manager 1 review.
    const m1Result = await client.query(`
      UPDATE appraisal_answers
      SET remarks = NULL,
          updated_at = CURRENT_TIMESTAMP
      FROM appraisals ap
      JOIN users u ON u.id = ap.employee_id
      WHERE appraisal_answers.appraisal_id = ap.id
        AND ap.status = 'PENDING_HEAD_REVIEW'
        AND ap.manager_level = 1
        AND appraisal_answers.filled_by_id = u.head_id
        AND appraisal_answers.remarks IS NOT NULL
        AND appraisal_answers.remarks != ''
      RETURNING appraisal_answers.id
    `);
    console.log(`[Manager 1 review] Cleared remarks on ${m1Result.rowCount} answer row(s).`);

    // 2. Clear Manager 2's remarks for submissions in Manager 2 review.
    const m2Result = await client.query(`
      UPDATE appraisal_answers
      SET remarks = NULL,
          updated_at = CURRENT_TIMESTAMP
      FROM appraisals ap
      JOIN users u ON u.id = ap.employee_id
      WHERE appraisal_answers.appraisal_id = ap.id
        AND ap.status = 'PENDING_HEAD_REVIEW'
        AND ap.manager_level >= 2
        AND appraisal_answers.filled_by_id = u.manager_2_id
        AND appraisal_answers.remarks IS NOT NULL
        AND appraisal_answers.remarks != ''
      RETURNING appraisal_answers.id
    `);
    console.log(`[Manager 2 review] Cleared remarks on ${m2Result.rowCount} answer row(s).`);

    console.log("Done.");
  } finally {
    client.release();
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error("Cleanup failed:", err);
    pool.end();
    process.exit(1);
  });
