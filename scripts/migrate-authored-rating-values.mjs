import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  try {
    const envPath = join(rootDir, ".env");
    const envText = readFileSync(envPath, "utf8");
    const match = envText.match(/^DATABASE_URL=(.+)$/m);
    if (match?.[1]) {
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // fall through
  }

  return "postgresql://postgres:uzair1321@127.0.0.1:5432/pms_uol";
}

const pool = new Pool({
  connectionString: loadDatabaseUrl(),
});

// Usage:
//   node --env-file=.env scripts/migrate-authored-rating-values.mjs           (dry run)
//   node --env-file=.env scripts/migrate-authored-rating-values.mjs --apply   (write)
const APPLY = process.argv.includes("--apply");

function roundScore(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Backfill rating_value for open-assessment (authored) answers on
 * rating-based templates. Rows authored before the form was switched to
 * rating mode have absolute points_earned and rating_value = NULL, so the
 * rating-based UI renders them as unrated ("Select rating").
 *
 * rating = round(points / weight * scaleMax), clamped to [1, scaleMax].
 * points_earned is rewritten to the rating-derived value
 * (rating / scaleMax * weight) so stored points stay consistent with the
 * rating model.
 */
async function main() {
  const rows = await pool.query(
    `SELECT aa.id::text,
            aa.appraisal_id::text,
            aa.open_section_id::text,
            aa.authored_question_text,
            aa.authored_total_marks::text AS weight,
            aa.points_earned::text AS points,
            ft.id::text AS template_id,
            ft.title AS template_title
     FROM appraisal_answers aa
     JOIN appraisals a ON a.id = aa.appraisal_id
     JOIN form_templates ft ON ft.id = a.template_id
     WHERE aa.open_section_id IS NOT NULL
       AND aa.rating_value IS NULL
       AND ft.rating_based = true
     ORDER BY aa.appraisal_id, aa.id`,
  );

  // Max rating per template: the first/default scale's max value.
  const scaleResult = await pool.query(
    `SELECT s.template_id::text, s.max_value::text
     FROM form_rating_scales s
     WHERE s.sort_order = 0 OR s.sort_order IS NULL`,
  );
  const maxByTemplate = new Map(
    scaleResult.rows.map((r) => [
      Number(r.template_id),
      Number(r.max_value) || 5,
    ]),
  );

  const plan = [];
  const skipped = [];

  for (const row of rows.rows) {
    const weight = Number(row.weight);
    const points = Number(row.points);
    const maxRating = maxByTemplate.get(Number(row.template_id)) ?? 5;

    if (!Number.isFinite(weight) || weight <= 0) {
      skipped.push({ ...row, reason: "no authored weight" });
      continue;
    }

    const raw = (points / weight) * maxRating;
    const rating = Math.min(maxRating, Math.max(1, Math.round(raw)));
    const derivedPoints = roundScore((rating / maxRating) * weight);

    plan.push({
      id: Number(row.id),
      appraisalId: Number(row.appraisal_id),
      questionText: row.authored_question_text,
      weight,
      oldPoints: points,
      rating,
      newPoints: derivedPoints,
    });
  }

  console.log(
    `\n${APPLY ? "APPLYING" : "DRY RUN"} — ${plan.length} authored answers to backfill, ${skipped.length} skipped\n`,
  );

  console.table(
    plan.map((p) => ({
      appraisal: p.appraisalId,
      id: p.id,
      text: (p.questionText ?? "").slice(0, 45),
      weight: p.weight,
      oldPoints: p.oldPoints,
      rating: p.rating,
      newPoints: p.newPoints,
    })),
  );

  if (skipped.length > 0) {
    console.log("Skipped rows:");
    console.table(skipped.map((s) => ({
      appraisal: s.appraisal_id,
      id: s.id,
      reason: s.reason,
    })));
  }

  if (!APPLY) {
    console.log("\nDry run only — re-run with --apply to write changes.");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let updated = 0;
    for (const p of plan) {
      await client.query(
        `UPDATE appraisal_answers
         SET rating_value = $2,
             points_earned = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [p.id, p.rating, p.newPoints],
      );
      updated += 1;
    }
    await client.query("COMMIT");
    console.log(`\nBackfilled rating_value on ${updated} authored answers.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
