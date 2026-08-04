import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:uzair1321@127.0.0.1:5432/pms_uol",
});

function pass(label, detail = "") {
  console.log(`  [PASS] ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail = "") {
  console.error(`  [FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
}

function warn(label, detail = "") {
  console.warn(`  [WARN] ${label}${detail ? ` — ${detail}` : ""}`);
}

function maskDatabaseUrl(connectionString) {
  return connectionString.replace(/:[^:@/]+@/, ":***@");
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return result.rows.length > 0;
}

async function columnExists(client, tableName, columnName) {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2`,
    [tableName, columnName],
  );
  return result.rows.length > 0;
}

async function constraintExists(client, tableName, constraintName) {
  const result = await client.query(
    `SELECT 1
     FROM pg_constraint
     WHERE conrelid = $1::regclass
       AND conname = $2`,
    [tableName, constraintName],
  );
  return result.rows.length > 0;
}

async function runPreChecks(client) {
  console.log("\n=== Pre-migration sanity checks ===");

  const requiredTables = [
    "appraisal_cycles",
    "form_templates",
    "form_questions",
    "question_options",
  ];

  let ok = true;

  for (const table of requiredTables) {
    if (await tableExists(client, table)) {
      pass(`Table "${table}" exists`);
    } else {
      fail(`Table "${table}" is missing`);
      ok = false;
    }
  }

  if (!ok) {
    throw new Error(
      "Core form tables are missing. Run full setup first: node scripts/setup-db.mjs",
    );
  }

  const counts = await client.query(
    `SELECT
       (SELECT COUNT(*)::int FROM appraisal_cycles) AS cycles,
       (SELECT COUNT(*)::int FROM form_templates) AS templates,
       (SELECT COUNT(*)::int FROM form_questions) AS questions,
       (SELECT COUNT(*)::int FROM question_options) AS options`,
  );

  const baseline = counts.rows[0];
  pass(
    "Baseline counts",
    `${baseline.cycles} cycle(s), ${baseline.templates} template(s), ${baseline.questions} question(s), ${baseline.options} option(s)`,
  );

  if (Number(baseline.cycles) === 0) {
    warn("No appraisal cycles found", "a default cycle will be seeded");
  }

  const orphanTemplates = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM form_templates ft
     LEFT JOIN appraisal_cycles ac ON ac.id = ft.cycle_id
     WHERE ac.id IS NULL`,
  );

  if (orphanTemplates.rows[0].count === 0) {
    pass("All form templates reference a valid appraisal cycle");
  } else {
    warn(
      "Form templates with missing cycle references",
      `${orphanTemplates.rows[0].count} row(s) — will attempt repair after seeding`,
    );
  }

  const negativeMarks = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM form_questions
     WHERE total_marks < 0`,
  );

  if (negativeMarks.rows[0].count === 0) {
    pass("No negative total_marks values");
  } else {
    fail("Negative total_marks found", `${negativeMarks.rows[0].count} row(s)`);
    ok = false;
  }

  return { ok, baseline };
}

async function applyMigration(client) {
  console.log("\n=== Applying migration ===");

  const sql = readFileSync(
    join(rootDir, "scripts/sql/migrate-form-engine.sql"),
    "utf8",
  );

  await client.query("BEGIN");
  try {
    await client.query(sql);
    pass("SQL migration applied", "scripts/sql/migrate-form-engine.sql");

    const currentYear = new Date().getFullYear();
    await client.query(
      `INSERT INTO appraisal_cycles (fiscal_year, start_date, end_date, is_active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (fiscal_year) DO NOTHING`,
      [currentYear, `${currentYear}-01-01`, `${currentYear}-12-31`],
    );
    pass("Default appraisal cycle ensured", `FY ${currentYear}`);

    const defaultCycle = await client.query(
      `SELECT id
       FROM appraisal_cycles
       ORDER BY is_active DESC, fiscal_year DESC
       LIMIT 1`,
    );

    if (defaultCycle.rows.length === 0) {
      throw new Error("Failed to seed or locate a default appraisal cycle.");
    }

    const cycleId = defaultCycle.rows[0].id;

    const repairedTemplates = await client.query(
      `UPDATE form_templates ft
       SET cycle_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE NOT EXISTS (
         SELECT 1 FROM appraisal_cycles ac WHERE ac.id = ft.cycle_id
       )
       RETURNING ft.id`,
      [cycleId],
    );

    if (repairedTemplates.rowCount > 0) {
      warn(
        "Repaired form_templates with invalid cycle_id",
        `${repairedTemplates.rowCount} row(s) assigned to cycle ${cycleId}`,
      );
    } else {
      pass("No form_templates required cycle repair");
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function runPostChecks(client) {
  console.log("\n=== Post-migration sanity checks ===");

  let ok = true;

  const requiredQuestionColumns = [
    "section_id",
    "self_assessment_enabled",
    "hod_assessment_enabled",
    "total_marks",
  ];

  for (const column of requiredQuestionColumns) {
    if (await columnExists(client, "form_questions", column)) {
      pass(`Column "form_questions.${column}" exists`);
    } else {
      fail(`Column "form_questions.${column}" missing`);
      ok = false;
    }
  }

  if (await tableExists(client, "form_sections")) {
    pass('Table "form_sections" exists');
  } else {
    fail('Table "form_sections" missing');
    ok = false;
  }

  if (await columnExists(client, "appraisals", "template_id")) {
    pass('Column "appraisals.template_id" exists');
  } else {
    fail('Column "appraisals.template_id" missing');
    ok = false;
  }

  if (await constraintExists(client, "form_questions", "form_questions_total_marks_check")) {
    pass("Constraint form_questions_total_marks_check exists");
  } else {
    fail("Constraint form_questions_total_marks_check missing");
    ok = false;
  }

  const cycleCount = await client.query(
    "SELECT COUNT(*)::int AS count FROM appraisal_cycles",
  );

  if (cycleCount.rows[0].count > 0) {
    pass("Appraisal cycle available", `${cycleCount.rows[0].count} cycle(s)`);
  } else {
    fail("No appraisal cycles exist after migration");
    ok = false;
  }

  const orphanTemplates = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM form_templates ft
     LEFT JOIN appraisal_cycles ac ON ac.id = ft.cycle_id
     WHERE ac.id IS NULL`,
  );

  if (orphanTemplates.rows[0].count === 0) {
    pass("All form templates reference a valid appraisal cycle");
  } else {
    fail(
      "Form templates still missing valid cycle_id",
      `${orphanTemplates.rows[0].count} row(s)`,
    );
    ok = false;
  }

  const orphanQuestions = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM form_questions fq
     LEFT JOIN form_sections fs ON fs.id = fq.section_id
     WHERE fq.section_id IS NOT NULL
       AND fs.id IS NULL`,
  );

  if (orphanQuestions.rows[0].count === 0) {
    pass("No orphan form_questions.section_id values");
  } else {
    fail("Orphan section_id values on questions", `${orphanQuestions.rows[0].count} row(s)`);
    ok = false;
  }

  const templateMismatch = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM form_questions fq
     INNER JOIN form_sections fs ON fs.id = fq.section_id
     WHERE fq.template_id <> fs.template_id`,
  );

  if (templateMismatch.rows[0].count === 0) {
    pass("Sectioned questions match their section template_id");
  } else {
    fail("Template mismatch on sectioned questions", `${templateMismatch.rows[0].count} row(s)`);
    ok = false;
  }

  const negativeMarks = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM form_questions
     WHERE total_marks < 0`,
  );

  if (negativeMarks.rows[0].count === 0) {
    pass("No negative total_marks values");
  } else {
    fail("Negative total_marks remain", `${negativeMarks.rows[0].count} row(s)`);
    ok = false;
  }

  const duplicateTargets = await client.query(
    `SELECT cycle_id, target_category, target_sub_category, COUNT(*)::int AS count
     FROM form_templates
     GROUP BY cycle_id, target_category, target_sub_category
     HAVING COUNT(*) > 1`,
  );

  if (duplicateTargets.rows.length === 0) {
    pass("No duplicate form target assignments per cycle");
  } else {
    fail(
      "Duplicate cycle/category/sub-category form assignments",
      `${duplicateTargets.rows.length} conflict group(s)`,
    );
    ok = false;
  }

  const indexChecks = [
    ["form_sections", "idx_form_sections_template"],
    ["form_questions", "idx_questions_lookup"],
    ["question_options", "idx_options_lookup"],
  ];

  for (const [tableName, indexName] of indexChecks) {
    const indexResult = await client.query(
      `SELECT 1
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = $1
         AND indexname = $2`,
      [tableName, indexName],
    );

    if (indexResult.rows.length > 0) {
      pass(`Index ${indexName} exists`);
    } else {
      fail(`Index ${indexName} missing on ${tableName}`);
      ok = false;
    }
  }

  const summary = await client.query(
    `SELECT
       (SELECT COUNT(*)::int FROM appraisal_cycles) AS cycles,
       (SELECT COUNT(*)::int FROM form_templates) AS templates,
       (SELECT COUNT(*)::int FROM form_sections) AS sections,
       (SELECT COUNT(*)::int FROM form_questions) AS questions,
       (SELECT COUNT(*)::int FROM form_questions WHERE section_id IS NULL) AS root_questions,
       (SELECT COUNT(*)::int FROM form_questions WHERE section_id IS NOT NULL) AS sectioned_questions,
       (SELECT COUNT(*)::int FROM question_options) AS options`,
  );

  const row = summary.rows[0];
  pass(
    "Final counts",
    `${row.cycles} cycle(s), ${row.templates} template(s), ${row.sections} section(s), ${row.questions} question(s) (${row.root_questions} root, ${row.sectioned_questions} sectioned), ${row.options} option(s)`,
  );

  const activeCycle = await client.query(
    `SELECT id, fiscal_year, is_active
     FROM appraisal_cycles
     ORDER BY is_active DESC, fiscal_year DESC
     LIMIT 1`,
  );

  if (activeCycle.rows.length > 0) {
    const cycle = activeCycle.rows[0];
    pass(
      "Default cycle ready for form publishing",
      `cycle_id=${cycle.id}, FY ${cycle.fiscal_year}, active=${cycle.is_active}`,
    );
  }

  return ok;
}

async function main() {
  const client = await pool.connect();
  const startedAt = new Date().toISOString();

  try {
    console.log("Form Engine migration");
    console.log(`Started: ${startedAt}`);
    console.log(
      `Database: ${maskDatabaseUrl(process.env.DATABASE_URL ?? "postgresql://postgres:uzair1321@127.0.0.1:5432/pms_uol")}`,
    );

    const pre = await runPreChecks(client);
    if (!pre.ok) {
      throw new Error("Pre-migration sanity checks failed. Fix data issues before migrating.");
    }

    await applyMigration(client);

    const postOk = await runPostChecks(client);

    console.log("\n=== Result ===");
    if (postOk) {
      console.log("Migration completed successfully. All sanity checks passed.");
    } else {
      console.error("Migration ran but sanity checks failed. Review output above.");
      process.exitCode = 1;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("\nERROR:", error.message);
  process.exit(1);
});
