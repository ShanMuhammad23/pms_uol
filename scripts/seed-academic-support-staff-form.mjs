import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:shan237426@localhost:5433/pms_uol",
});

const FORM_TITLE = "Academic Support Staff Performance Evaluation";
const FORM_DESCRIPTION =
  "Performance evaluation form for Academic Support Staff (CSO). Section A: Core Competencies rated on a 5-point scale by HOD.";

const SECTION_TITLE = "A) Core Competencies";

const QUESTIONS = [
  {
    text: "Job Knowledge — Demonstrates clear understanding of job responsibilities, domain expertise, and effectively applies the knowledge to achieve organizational goals",
    marks: 15,
  },
  {
    text: "Work Quality — Consistently produces accurate work while demonstrating a strong commitment to quality and adhering to high standards",
    marks: 15,
  },
  {
    text: "Technical Proficiency — Proficient in the tools, systems, or technologies required for the role",
    marks: 10,
  },
  {
    text: "Stakeholder Interaction — Interacts with professionalism, effectively address employees'/students' needs, and incorporates feedback to improve service quality",
    marks: 7,
  },
  {
    text: "Ownership and Independence — Takes ownership of responsibilities, proactively completes tasks on time without direct supervision",
    marks: 7,
  },
  {
    text: "Ethical Conduct — Adheres to organizational policies, upholds workplace values, maintains confidentiality, and demonstrates fairness and respect in all interactions",
    marks: 6,
  },
  {
    text: "Adaptability and Resilience — Effectively adjusts to evolving situations, maintains composure under pressure, and addresses challenges with a proactive approach",
    marks: 6,
  },
  {
    text: "Continuous Professional Development — Actively participates in self-development activities such as training, certifications, workshops, and stays informed about emerging trends and best practices relevant to the field",
    marks: 7,
  },
  {
    text: "Punctuality and Time Management — Complies with official working hours, demonstrates discipline, and effectively manages time by prioritizing tasks to meet deadlines",
    marks: 7,
  },
  {
    text: "Decision Making — Analyze situations effectively to make sound and well-informed decisions, in alignment with the requirement of the role in a timely manner",
    marks: 6,
  },
  {
    text: "Team Work and Collaboration — Collaborates effectively within department and across departments, in alignment with the requirement of the role",
    marks: 7,
  },
  {
    text: "Workplace Demeanor — Demonstrates respectful and courteous attitude, upholds positive behavior, resolves conflicts professionally, and actively contributes to a positive and respectful work environment",
    marks: 7,
  },
];

async function getDefaultCycleId(client) {
  const result = await client.query(
    `SELECT id, fiscal_year FROM appraisal_cycles ORDER BY id DESC LIMIT 1`,
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

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const cycle = await getDefaultCycleId(client);

    const existing = await client.query(
      `SELECT id FROM form_templates WHERE title = $1 AND cycle_id = $2`,
      [FORM_TITLE, cycle.id],
    );

    if (existing.rows.length > 0) {
      console.log(
        `Form already exists (id=${existing.rows[0].id}) with title "${FORM_TITLE}" for cycle ${cycle.id}. Skipping seed.`,
      );
      await client.query("ROLLBACK");
      return;
    }

    const templateResult = await client.query(
      `INSERT INTO form_templates (title, description, cycle_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [FORM_TITLE, FORM_DESCRIPTION, cycle.id],
    );

    const templateId = Number(templateResult.rows[0].id);

    const sectionResult = await client.query(
      `INSERT INTO form_sections (template_id, parent_section_id, title, sort_order)
       VALUES ($1, NULL, $2, 0)
       RETURNING id`,
      [templateId, SECTION_TITLE],
    );

    const sectionId = Number(sectionResult.rows[0].id);

    let totalMarks = 0;

    for (let i = 0; i < QUESTIONS.length; i++) {
      const q = QUESTIONS[i];
      await client.query(
        `INSERT INTO form_questions (
           template_id, section_id, question_text, input_type,
           is_required, sort_order, self_assessment_enabled,
           hod_assessment_enabled, total_marks
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          templateId,
          sectionId,
          q.text,
          "NUMBER",
          true,
          i,
          false,
          true,
          q.marks,
        ],
      );
      totalMarks += q.marks;
    }

    await client.query("COMMIT");

    console.log(`Created form template id=${templateId}`);
    console.log(`Title: ${FORM_TITLE}`);
    console.log(`Cycle: ${cycle.id} (FY ${cycle.fiscalYear})`);
    console.log(`Section: ${SECTION_TITLE}`);
    console.log(`Questions: ${QUESTIONS.length} (${totalMarks} total marks)`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Failed to seed Academic Support Staff form:", error);
  process.exit(1);
});
