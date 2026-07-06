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

async function runPreChecks(client) {
  console.log("\n=== Pre-migration sanity checks ===");

  const requiredTables = ["form_templates", "form_questions"];
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
      "Prerequisites missing. Run full setup first: node scripts/setup-db.mjs",
    );
  }

  const templateCount = await client.query(
    "SELECT COUNT(*)::int AS count FROM form_templates",
  );
  const questionCount = await client.query(
    "SELECT COUNT(*)::int AS count FROM form_questions",
  );

  pass("Baseline counts", `${templateCount.rows[0].count} templates, ${questionCount.rows[0].count} questions`);

  const sectionsAlready = await tableExists(client, "form_sections");
  const sectionIdAlready = await columnExists(client, "form_questions", "section_id");

  if (sectionsAlready && sectionIdAlready) {
    warn("Migration appears already applied", "will re-run idempotently");
  }

  return {
    templateCount: templateCount.rows[0].count,
    questionCount: questionCount.rows[0].count,
  };
}

async function applyMigration(client) {
  console.log("\n=== Applying migration ===");

  const sql = readFileSync(
    join(rootDir, "scripts/sql/migrate-form-sections.sql"),
    "utf8",
  );

  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
    pass("SQL migration applied", "scripts/sql/migrate-form-sections.sql");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function runPostChecks(client) {
  console.log("\n=== Post-migration sanity checks ===");

  let ok = true;

  if (await tableExists(client, "form_sections")) {
    pass('Table "form_sections" exists');
  } else {
    fail('Table "form_sections" missing');
    ok = false;
  }

  const sectionColumns = await client.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'form_sections'
     ORDER BY ordinal_position`,
  );

  const expectedSectionColumns = new Set([
    "id",
    "template_id",
    "parent_section_id",
    "title",
    "sort_order",
    "created_at",
  ]);

  for (const column of sectionColumns.rows) {
    expectedSectionColumns.delete(column.column_name);
  }

  if (expectedSectionColumns.size === 0) {
    pass("form_sections columns", sectionColumns.rows.map((row) => row.column_name).join(", "));
  } else {
    fail("form_sections missing columns", [...expectedSectionColumns].join(", "));
    ok = false;
  }

  if (await columnExists(client, "form_questions", "section_id")) {
    pass('Column "form_questions.section_id" exists');
  } else {
    fail('Column "form_questions.section_id" missing');
    ok = false;
  }

  const indexResult = await client.query(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'form_sections'
       AND indexname = 'idx_form_sections_template'`,
  );

  if (indexResult.rows.length > 0) {
    pass("Index idx_form_sections_template exists");
  } else {
    fail("Index idx_form_sections_template missing");
    ok = false;
  }

  const fkResult = await client.query(
    `SELECT conname
     FROM pg_constraint
     WHERE conrelid = 'form_questions'::regclass
       AND contype = 'f'
       AND pg_get_constraintdef(oid) LIKE '%form_sections%'`,
  );

  if (fkResult.rows.length > 0) {
    pass("Foreign key form_questions.section_id → form_sections", fkResult.rows[0].conname);
  } else {
    fail("Foreign key from form_questions.section_id to form_sections not found");
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
    pass("No orphan question.section_id values");
  } else {
    fail("Orphan question.section_id values found", `${orphanQuestions.rows[0].count} row(s)`);
    ok = false;
  }

  const deepNesting = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM form_sections child
     INNER JOIN form_sections parent ON parent.id = child.parent_section_id
     WHERE parent.parent_section_id IS NOT NULL`,
  );

  if (deepNesting.rows[0].count === 0) {
    pass("No subsection-under-subsection rows");
  } else {
    fail("Invalid nesting detected", `${deepNesting.rows[0].count} subsection-under-subsection row(s)`);
    ok = false;
  }

  const templateMismatch = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM form_questions fq
     INNER JOIN form_sections fs ON fs.id = fq.section_id
     WHERE fq.template_id <> fs.template_id`,
  );

  if (templateMismatch.rows[0].count === 0) {
    pass("All sectioned questions match their section template_id");
  } else {
    fail("Template mismatch on sectioned questions", `${templateMismatch.rows[0].count} row(s)`);
    ok = false;
  }

  const counts = await client.query(
    `SELECT
       (SELECT COUNT(*)::int FROM form_templates) AS templates,
       (SELECT COUNT(*)::int FROM form_sections) AS sections,
       (SELECT COUNT(*)::int FROM form_sections WHERE parent_section_id IS NULL) AS top_level_sections,
       (SELECT COUNT(*)::int FROM form_sections WHERE parent_section_id IS NOT NULL) AS subsections,
       (SELECT COUNT(*)::int FROM form_questions WHERE section_id IS NULL) AS root_questions,
       (SELECT COUNT(*)::int FROM form_questions WHERE section_id IS NOT NULL) AS sectioned_questions`,
  );

  const summary = counts.rows[0];
  pass(
    "Final counts",
    `${summary.templates} templates, ${summary.sections} sections (${summary.top_level_sections} top-level, ${summary.subsections} subsections), ${summary.root_questions} root questions, ${summary.sectioned_questions} sectioned questions`,
  );

  if (summary.root_questions + summary.sectioned_questions > 0) {
    pass("Existing questions preserved after migration");
  }

  return ok;
}

async function main() {
  const client = await pool.connect();
  const startedAt = new Date().toISOString();

  try {
    console.log("Form Sections migration");
    console.log(`Started: ${startedAt}`);
    console.log(
      `Database: ${(process.env.DATABASE_URL ?? "postgresql://postgres:***@127.0.0.1:5432/pms_uol").replace(/:[^:@/]+@/, ":***@")}`,
    );

    await runPreChecks(client);
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
