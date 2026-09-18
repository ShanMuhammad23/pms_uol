import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// --- 1. Appraisal metadata ---
const meta = await pool.query(
  `SELECT a.id::text, a.employee_id::text, a.template_id::text, a.cycle_id::text,
          a.status::text, a.manager_level::text, a.submitted_at::text,
          a.is_returned::text, a.return_reason,
          a.manager1_overall_remarks, a.manager2_overall_remarks,
          a.calibration_factor::text, a.updated_at::text,
          e.first_name || ' ' || e.last_name AS employee,
          t.title AS template_title, t.rating_based::text
   FROM appraisals a
   LEFT JOIN users e ON e.id = a.employee_id
   LEFT JOIN form_templates t ON t.id = a.template_id
   WHERE a.id = 5056`,
);
console.log("=== APPRAISAL ===");
console.log(JSON.stringify(meta.rows[0], null, 2));

// --- 2. All answers grouped by filled_by ---
const answers = await pool.query(
  `SELECT aa.filled_by_id::text AS filled_by,
          u.first_name || ' ' || u.last_name AS who,
          COALESCE(aa.question_id::text, '—') AS q_id,
          q.question_text IS NOT NULL AS has_question,
          LEFT(COALESCE(q.question_text, aa.authored_question_text, ''), 55) AS question,
          q.section_id::text AS q_section,
          aa.open_section_id::text AS open_sec,
          aa.authored_total_marks::text AS marks,
          aa.points_earned::text AS pts,
          aa.rating_value::text AS rating,
          LEFT(COALESCE(aa.remarks,''), 50) AS remarks,
          LEFT(COALESCE(aa.text_response,''), 40) AS text_resp,
          aa.updated_at::text
   FROM appraisal_answers aa
   LEFT JOIN users u ON u.id = aa.filled_by_id
   LEFT JOIN form_questions q ON q.id = aa.question_id
   WHERE aa.appraisal_id = 5056
   ORDER BY aa.filled_by_id, q.section_id NULLS LAST, aa.question_id NULLS LAST, aa.id`,
);
console.log("\n=== ALL ANSWERS (grouped by filled_by) ===");
console.table(answers.rows.map(({ has_question, ...r }) => r));

// --- 3. Sections + question count for the template ---
const secs = await pool.query(
  `SELECT s.id::text, LEFT(s.title,50) AS title, s.sort_order::text,
          s.is_open_assessment::text, s.open_assessment_total_marks::text,
          s.hod_assessment_enabled::text, s.self_assessment_enabled::text,
          COUNT(q.id)::text AS questions
   FROM form_sections s
   LEFT JOIN form_questions q ON q.section_id = s.id
   WHERE s.template_id = 30
   GROUP BY s.id
   ORDER BY s.sort_order`,
);
console.log("\n=== TEMPLATE 30 SECTIONS ===");
console.table(secs.rows);

await pool.end();
