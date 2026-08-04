import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const STAFF_CATEGORY_ID = 1;
const STAFF_SUB_CATEGORY_ID = 1;
const FORM_TITLE = "Deans KPI - 2026";
const FORM_DESCRIPTION =
  "Key Performance Indicators (KPIs) for Academic Deans of Faculties";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function buildQuestions() {
  const raw = readFileSync(
    join(__dirname, "data/deans-kpi-2026-questions.json"),
    "utf8",
  );
  const parsed = JSON.parse(raw);

  return parsed.map((item, index) => {
    const isNarrative = item.type === "narrative";

    return {
      questionText: item.text,
      inputType: isNarrative ? "TEXTAREA" : "NUMBER",
      isRequired: true,
      sortOrder: index,
      selfAssessmentEnabled: false,
      hodAssessmentEnabled: false,
      totalMarks: isNarrative ? 0 : Number(item.marks),
      options: [],
    };
  });
}

async function main() {
  const client = await pool.connect();
  const questions = buildQuestions();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id FROM form_templates
       WHERE staff_category_id = $1 AND staff_sub_category_id = $2`,
      [STAFF_CATEGORY_ID, STAFF_SUB_CATEGORY_ID],
    );

    if (existing.rows.length > 0) {
      console.log(
        `Form already exists (id=${existing.rows[0].id}). Skipping seed.`,
      );
      await client.query("ROLLBACK");
      return;
    }

    const subCheck = await client.query(
      `SELECT id FROM staff_sub_categories
       WHERE id = $1 AND staff_category_id = $2`,
      [STAFF_SUB_CATEGORY_ID, STAFF_CATEGORY_ID],
    );

    if (subCheck.rows.length === 0) {
      throw new Error(
        "Staff sub-category 1 does not belong to staff category 1.",
      );
    }

    const templateResult = await client.query(
      `INSERT INTO form_templates (
         title,
         description,
         staff_category_id,
         staff_sub_category_id
       ) VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [FORM_TITLE, FORM_DESCRIPTION, STAFF_CATEGORY_ID, STAFF_SUB_CATEGORY_ID],
    );

    const templateId = Number(templateResult.rows[0].id);

    for (const question of questions) {
      const questionResult = await client.query(
        `INSERT INTO form_questions (
           template_id,
           question_text,
           input_type,
           is_required,
           sort_order,
           self_assessment_enabled,
           hod_assessment_enabled,
           total_marks
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          templateId,
          question.questionText,
          question.inputType,
          question.isRequired,
          question.sortOrder,
          question.selfAssessmentEnabled,
          question.hodAssessmentEnabled,
          question.totalMarks,
        ],
      );

      const questionId = Number(questionResult.rows[0].id);

      for (const option of question.options) {
        await client.query(
          `INSERT INTO question_options (question_id, option_label, points_assigned, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [questionId, option.optionLabel, option.pointsAssigned, option.sortOrder],
        );
      }
    }

    await client.query("COMMIT");

    const scoredMarks = questions
      .filter((question) => question.totalMarks > 0)
      .reduce((sum, question) => sum + question.totalMarks, 0);

    console.log(`Created form template id=${templateId}`);
    console.log(`Title: ${FORM_TITLE}`);
    console.log(
      `Staff category: ${STAFF_CATEGORY_ID}, sub-category: ${STAFF_SUB_CATEGORY_ID}`,
    );
    console.log(`Questions: ${questions.length} (${scoredMarks} total marks)`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Failed to seed Deans KPI form:", error);
  process.exit(1);
});
