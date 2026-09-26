import pg from "pg";
import { readFileSync } from "fs";
for (const l of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const r = await pool.query(
  `SELECT s.template_id, s.parent_section_id, s.id, s.sort_order,
          LEFT(s.title, 55) AS subsection,
          q.id AS first_qid, q.total_marks, LEFT(q.question_text, 55) AS first_q
   FROM form_sections s
   LEFT JOIN LATERAL (
     SELECT * FROM form_questions q2 WHERE q2.section_id = s.id
     ORDER BY q2.sort_order, q2.id LIMIT 1
   ) q ON TRUE
   WHERE s.parent_section_id IN (161, 179)
   ORDER BY s.template_id, s.sort_order, s.id`,
);
console.table(r.rows);
await pool.end();
