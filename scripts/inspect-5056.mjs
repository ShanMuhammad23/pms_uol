import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const res = await pool.query(
  `SELECT aa.id::text, aa.filled_by_id::text,
          u.first_name || ' ' || u.last_name AS filled_by,
          aa.open_section_id::text,
          LEFT(COALESCE(aa.authored_question_text,''),45) AS text,
          aa.authored_total_marks::text AS marks,
          aa.points_earned::text AS pts, aa.rating_value::text AS rating,
          LEFT(COALESCE(aa.remarks,''),40) AS remarks
   FROM appraisal_answers aa
   LEFT JOIN users u ON u.id = aa.filled_by_id
   WHERE aa.appraisal_id = 5056 AND aa.open_section_id IS NOT NULL
   ORDER BY aa.id`,
);
console.table(res.rows);

await pool.end();
