import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Appraisals where Manager 2's question-level remarks are byte-identical to
// Manager 1's remarks on the same question (auto-fill / copy residue).
const dupes = await pool.query(
  `SELECT a.id::text AS appraisal_id,
          emp.first_name || ' ' || emp.last_name AS employee,
          m1u.first_name || ' ' || m1u.last_name AS manager1,
          m2u.first_name || ' ' || m2u.last_name AS manager2,
          a.status::text,
          a.manager_level::text,
          LEFT(COALESCE(q.question_text,'(open:'||m1.open_section_id||')'), 45) AS question,
          LEFT(m1.remarks, 60) AS shared_remarks,
          m1.updated_at::text AS m1_updated,
          m2.updated_at::text AS m2_updated
   FROM appraisals a
   JOIN users emp ON emp.id = a.employee_id
   LEFT JOIN users m1u ON m1u.id = emp.head_id
   LEFT JOIN users m2u ON m2u.id = emp.manager_2_id
   JOIN appraisal_answers m1
     ON m1.appraisal_id = a.id
    AND m1.filled_by_id = emp.head_id
    AND NULLIF(BTRIM(m1.remarks), '') IS NOT NULL
   JOIN appraisal_answers m2
     ON m2.appraisal_id = a.id
    AND m2.filled_by_id = emp.manager_2_id
    AND m2.question_id IS NOT DISTINCT FROM m1.question_id
    AND m2.open_section_id IS NOT DISTINCT FROM m1.open_section_id
    AND m2.remarks = m1.remarks
   LEFT JOIN form_questions q ON q.id = m1.question_id
   ORDER BY a.id, m1.question_id NULLS LAST, m1.id`,
);

console.log(`=== M2 REMARKS IDENTICAL TO M1 REMARKS: ${dupes.rows.length} rows ===`);
console.table(dupes.rows);

const summary = await pool.query(
  `SELECT COUNT(DISTINCT a.id)::text AS affected_appraisals,
          COUNT(*)::text AS identical_answer_rows
   FROM appraisals a
   JOIN appraisal_answers m1
     ON m1.appraisal_id = a.id
    AND m1.filled_by_id = (SELECT head_id FROM users WHERE id = a.employee_id)
    AND NULLIF(BTRIM(m1.remarks), '') IS NOT NULL
   JOIN appraisal_answers m2
     ON m2.appraisal_id = a.id
    AND m2.filled_by_id = (SELECT manager_2_id FROM users WHERE id = a.employee_id)
    AND m2.question_id IS NOT DISTINCT FROM m1.question_id
    AND m2.open_section_id IS NOT DISTINCT FROM m1.open_section_id
    AND m2.remarks = m1.remarks`,
);
console.log("=== SUMMARY ===");
console.table(summary.rows);

await pool.end();
