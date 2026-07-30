import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const TARGET_CATEGORY = "ACADEMIC";
const TARGET_SUB_CATEGORY = "FACULTY_MEMBER";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:shan237426@localhost:5433/pms_uol",
});

async function getDefaultCycleId(client) {
  const result = await client.query(
    `SELECT id, fiscal_year FROM appraisal_cycles
     ORDER BY id DESC
     LIMIT 1`,
  );

  if (result.rows.length === 0) {
    const created = await client.query(
      `INSERT INTO appraisal_cycles (fiscal_year, start_date, end_date)
       VALUES (EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::int, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + interval '1 year')
       RETURNING id, fiscal_year`,
    );
    return { id: Number(created.rows[0].id), fiscalYear: created.rows[0].fiscal_year };
  }

  return {
    id: Number(result.rows[0].id),
    fiscalYear: result.rows[0].fiscal_year,
  };
}

async function insertQuestion(client, templateId, sectionId, question, sortOrder) {
  const isNarrative = question.type === "narrative";
  const isOptional = question.type === "Optional";

  const result = await client.query(
    `INSERT INTO form_questions (
       template_id,
       section_id,
       question_text,
       input_type,
       is_required,
       sort_order,
       self_assessment_enabled,
       hod_assessment_enabled,
       total_marks
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      templateId,
      sectionId,
      question.text,
      isNarrative ? "TEXTAREA" : "NUMBER",
      !isOptional,
      sortOrder,
      question.selfAssessment ?? false,
      question.hodAssessment ?? false,
      isNarrative ? 0 : Number(question.marks),
    ],
  );

  return Number(result.rows[0].id);
}

async function main() {
  const raw = readFileSync(
    join(__dirname, "data/faculty-annual-performance-form.json"),
    "utf8",
  );
  const formData = JSON.parse(raw);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const cycle = await getDefaultCycleId(client);

    const existing = await client.query(
      `SELECT id FROM form_templates
       WHERE cycle_id = $1 AND target_category = $2 AND target_sub_category = $3`,
      [cycle.id, TARGET_CATEGORY, TARGET_SUB_CATEGORY],
    );

    if (existing.rows.length > 0) {
      console.log(
        `Form already exists (id=${existing.rows[0].id}) for cycle ${cycle.id}. Skipping seed.`,
      );
      await client.query("ROLLBACK");
      return;
    }

    const templateResult = await client.query(
      `INSERT INTO form_templates (
         title,
         description,
         cycle_id,
         target_category,
         target_sub_category
       ) VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        formData.title,
        formData.description,
        cycle.id,
        TARGET_CATEGORY,
        TARGET_SUB_CATEGORY,
      ],
    );

    const templateId = Number(templateResult.rows[0].id);

    let totalQuestions = 0;
    let totalMarks = 0;
    let sectionSortOrder = 0;

    for (const section of formData.sections) {
      for (const question of section.questions) {
        await insertQuestion(
          client,
          templateId,
          null,
          question,
          totalQuestions,
        );
        totalQuestions++;
        totalMarks += Number(question.marks) || 0;
      }

      for (const subsection of section.subsections) {
        const subResult = await client.query(
          `INSERT INTO form_sections (template_id, parent_section_id, title, sort_order)
           VALUES ($1, NULL, $2, $3)
           RETURNING id`,
          [templateId, subsection.title, sectionSortOrder],
        );
        const subsectionId = Number(subResult.rows[0].id);
        sectionSortOrder++;

        for (const question of subsection.questions) {
          await insertQuestion(
            client,
            templateId,
            subsectionId,
            question,
            totalQuestions,
          );
          totalQuestions++;
          totalMarks += Number(question.marks) || 0;
        }
      }
    }

    for (const question of formData.questions) {
      await insertQuestion(client, templateId, null, question, totalQuestions);
      totalQuestions++;
    }

    await client.query("COMMIT");

    console.log(`Created form template id=${templateId}`);
    console.log(`Title: ${formData.title}`);
    console.log(`Cycle: ${cycle.id} (FY ${cycle.fiscalYear})`);
    console.log(`Target: ${TARGET_CATEGORY} / ${TARGET_SUB_CATEGORY}`);
    console.log(`Sections: ${formData.sections.length}`);
    console.log(`Questions: ${totalQuestions} (${totalMarks} total marks)`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Failed to seed Faculty KPI form:", error);
  process.exit(1);
});
