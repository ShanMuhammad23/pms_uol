/**
 * Migration: Link form templates to a site (campus).
 *
 * Adds `campus_id` to `form_templates` so each form can be tagged with the
 * site it was created for. Display-only metadata — it does not affect
 * assignments, submissions, or any workflow logic.
 *
 * Usage: node --env-file=.env scripts/migrate-form-template-campus.mjs
 *
 * This migration is idempotent — safe to run multiple times.
 */
import { db } from "../lib/db.ts";

async function migrate() {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE form_templates
        ADD COLUMN IF NOT EXISTS campus_id INT REFERENCES campuses(id)
          ON DELETE SET NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_form_templates_campus
        ON form_templates(campus_id)
    `);

    await client.query("COMMIT");
    console.log("form_templates.campus_id added successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
