/**
 * Export Q1 manager-assessed scores to Excel.
 *
 * Scope:
 *   - Faculty of Information Technology (C1 entity + descendants)
 *   - Submissions currently in HR Alignment (PENDING_HR_CALIBRATION)
 *   - Forms with code L0-L1 or L2-ABOVE
 *   - Questions #9, #10, #11, #14 (display order: parent section ->
 *     subsection -> question sort_order -> id)
 *   - Score = Manager 2's points_earned; falls back to Manager 1 when M2
 *     hasn't assessed that question.
 *
 * Run: node --env-file=.env scripts/export-q1-hr-scores.mjs
 * Out: exports/q1-hr-alignment-scores.xlsx
 */
import pg from "pg";
import * as XLSX from "xlsx";
import { mkdirSync, readFileSync } from "fs";

// .env loader (matches other scripts' pattern)
for (const l of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ---- 1. Resolve the faculty entity -----------------------------------------
const entRes = await pool.query(
  `SELECT e.id::text AS id, e.name, ec.code AS category
   FROM entities e JOIN entity_categories ec ON ec.id = e.entity_category_id
   WHERE e.name ILIKE '%law%'`,
);
console.log("=== matching entities ===");
console.table(entRes.rows);
const entity =
  entRes.rows.find((r) => r.name === "Law") ??
  entRes.rows.find((r) => r.category === "C1") ??
  entRes.rows[0];
if (!entity) throw new Error("Law entity not found");
console.log(`Using entity: ${entity.name} (id ${entity.id}, ${entity.category})`);

// ---- 2. Sanity-check the target form codes ---------------------------------
const codesRes = await pool.query(
  `SELECT id, code, title FROM form_templates
   WHERE UPPER(REPLACE(code, ' ', '')) IN ('L0-L1', 'L2-ABOVE')`,
);
console.log("=== matching templates ===");
console.table(codesRes.rows);

// ---- 3. Main query ----------------------------------------------------------
const { rows } = await pool.query(
  `WITH RECURSIVE subtree AS (
     SELECT $1::bigint AS id
     UNION ALL
     SELECT e.id FROM entities e JOIN subtree s ON e.parent_entity_id = s.id
   ),
   numbered AS (
     -- Question numbers follow display order: parent section sort_order ->
     -- subsection sort_order -> question sort_order -> id.
     SELECT q.id AS question_id, q.template_id, q.question_text, q.total_marks,
            ROW_NUMBER() OVER (
              PARTITION BY q.template_id
              ORDER BY
                COALESCE(p.sort_order, s.sort_order, -1),
                COALESCE(p.id, s.id),
                CASE WHEN s.parent_section_id IS NOT NULL THEN s.sort_order ELSE 0 END,
                s.id NULLS LAST,
                q.sort_order,
                q.id
            ) AS qno
     FROM form_questions q
     LEFT JOIN form_sections s ON s.id = q.section_id
     LEFT JOIN form_sections p ON p.id = s.parent_section_id
   ),
   q1 AS (
     SELECT * FROM numbered WHERE qno IN (9, 10, 11, 14)
   )
   SELECT
     u.employee_id                              AS sap_id,
     CONCAT(u.first_name, ' ', u.last_name)     AS employee_name,
     ft.code                                    AS form_code,
     ft.title                                   AS form_title,
     ap.id::text                                AS appraisal_id,
     ap.status,
     q1.qno                                     AS question_no,
     q1.question_text,
     q1.total_marks                             AS question_marks,
     CONCAT(m2.first_name, ' ', m2.last_name)   AS manager2_name,
     a2.points_earned::text                     AS manager2_score,
     a2.rating_value::text                      AS manager2_rating,
     CONCAT(m1.first_name, ' ', m1.last_name)   AS manager1_name,
     a1.points_earned::text                     AS manager1_score,
     a1.rating_value::text                      AS manager1_rating,
     COALESCE(a2.points_earned, a1.points_earned)::text AS final_score,
     CASE WHEN a2.id IS NOT NULL THEN 'Manager 2'
          WHEN a1.id IS NOT NULL THEN 'Manager 1'
          ELSE 'Not assessed' END               AS score_source
   FROM appraisals ap
   JOIN users u            ON u.id = ap.employee_id
   JOIN form_templates ft  ON ft.id = ap.template_id
   JOIN q1                 ON q1.template_id = ft.id
   LEFT JOIN users m2      ON m2.id = u.manager_2_id
   LEFT JOIN users m1      ON m1.id = u.head_id
   LEFT JOIN appraisal_answers a2
          ON a2.appraisal_id = ap.id AND a2.question_id = q1.question_id
         AND a2.filled_by_id = u.manager_2_id
   LEFT JOIN appraisal_answers a1
          ON a1.appraisal_id = ap.id AND a1.question_id = q1.question_id
         AND a1.filled_by_id = u.head_id
   WHERE ap.status = 'PENDING_HR_CALIBRATION'
     AND UPPER(REPLACE(ft.code, ' ', '')) IN ('L0-L1', 'L2-ABOVE')
     AND u.entity_id IN (SELECT id FROM subtree)
     AND u.is_active = TRUE
   ORDER BY ft.code, q1.qno, u.first_name, u.last_name`,
  [entity.id],
);

console.log(`\n=== ${rows.length} records ===`);
console.table(
  rows.map((r) => ({
    qno: r.question_no, sap: r.sap_id, name: r.employee_name, form: r.form_code,
    q_marks: r.question_marks, m2: r.manager2_score, m1: r.manager1_score,
    final: r.final_score, src: r.score_source,
  })),
);

// ---- 4. Write Excel ----------------------------------------------------------
const sheetRows = rows.map((r) => ({
  "Q No": Number(r.question_no),
  "SAP ID": r.sap_id,
  "Employee": r.employee_name,
  "Form Code": r.form_code,
  "Form Title": r.form_title,
  "Appraisal ID": r.appraisal_id,
  "Status": r.status,
  "Question Text": r.question_text,
  "Q1 Marks": Number(r.question_marks),
  "Manager 2": r.manager2_name ?? "",
  "M2 Score": r.manager2_score != null ? Number(r.manager2_score) : "",
  "M2 Rating": r.manager2_rating != null ? Number(r.manager2_rating) : "",
  "Manager 1": r.manager1_name ?? "",
  "M1 Score": r.manager1_score != null ? Number(r.manager1_score) : "",
  "M1 Rating": r.manager1_rating != null ? Number(r.manager1_rating) : "",
  "Final Score": r.final_score != null ? Number(r.final_score) : "",
  "Score Source": r.score_source,
}));

const ws = XLSX.utils.json_to_sheet(sheetRows);
ws["!cols"] = [
  { wch: 10 }, { wch: 26 }, { wch: 10 }, { wch: 34 }, { wch: 11 },
  { wch: 22 }, { wch: 40 }, { wch: 9 }, { wch: 24 }, { wch: 9 },
  { wch: 9 }, { wch: 24 }, { wch: 9 }, { wch: 9 }, { wch: 11 }, { wch: 12 },
];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "QEC HR Alignment Scores");

mkdirSync("exports", { recursive: true });
const file = "exports/law-q9-14-hr-alignment-scores.xlsx";
XLSX.writeFile(wb, file);
console.log(`\nWrote ${rows.length} records -> ${file}`);

await pool.end();
