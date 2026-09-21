import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Appraisals where Manager 1's question-level remarks are byte-identical to
// the employee's self remarks on the same question (auto-fill residue).
const dupes = await pool.query(
  `SELECT a.id::text AS appraisal_id,
          emp.first_name || ' ' || emp.last_name AS employee,
          mgr.first_name || ' ' || mgr.last_name AS manager1,
          a.status::text,
          a.manager_level::text,
          LEFT(COALESCE(q.question_text,'(open:'||e.open_section_id||')'), 45) AS question,
          LEFT(e.remarks, 60) AS shared_remarks,
          e.updated_at::text AS self_updated,
          m.updated_at::text AS m1_updated
   FROM appraisals a
   JOIN users emp ON emp.id = a.employee_id
   LEFT JOIN users mgr ON mgr.id = emp.head_id
   JOIN appraisal_answers e
     ON e.appraisal_id = a.id
    AND e.filled_by_id = a.employee_id
    AND NULLIF(BTRIM(e.remarks), '') IS NOT NULL
   JOIN appraisal_answers m
     ON m.appraisal_id = a.id
    AND m.filled_by_id = emp.head_id
    AND m.question_id IS NOT DISTINCT FROM e.question_id
    AND m.open_section_id IS NOT DISTINCT FROM e.open_section_id
    AND m.remarks = e.remarks
   LEFT JOIN form_questions q ON q.id = e.question_id
   ORDER BY a.id, e.question_id NULLS LAST, e.id`,
);

console.log(`=== M1 REMARKS IDENTICAL TO SELF REMARKS: ${dupes.rows.length} rows ===`);
console.table(dupes.rows);

const summary = await pool.query(
  `SELECT COUNT(DISTINCT a.id)::text AS affected_appraisals,
          COUNT(*)::text AS identical_answer_rows
   FROM appraisals a
   JOIN appraisal_answers e
     ON e.appraisal_id = a.id
    AND e.filled_by_id = a.employee_id
    AND NULLIF(BTRIM(e.remarks), '') IS NOT NULL
   JOIN appraisal_answers m
     ON m.appraisal_id = a.id
    AND m.filled_by_id = (SELECT head_id FROM users WHERE id = a.employee_id)
    AND m.question_id IS NOT DISTINCT FROM e.question_id
    AND m.open_section_id IS NOT DISTINCT FROM e.open_section_id
    AND m.remarks = e.remarks`,
);
console.log("=== SUMMARY ===");
console.table(summary.rows);

await pool.end();
