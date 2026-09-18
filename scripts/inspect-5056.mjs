import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const res = await pool.query(
  `SELECT aa.id::text, aa.filled_by_id::text,
          LEFT(COALESCE(aa.authored_question_text,''),50) AS text,
          aa.authored_total_marks::text AS marks,
          aa.points_earned::text AS pts, aa.rating_value::text AS rating
   FROM appraisal_answers aa
   WHERE aa.appraisal_id = 5056 AND aa.open_section_id IS NOT NULL`,
);
console.log("=== authored rows for 5056 RIGHT NOW ===");
console.table(res.rows);

await pool.end();
