import { db } from "../db";

async function runMigration() {
  const sql = `
    ALTER TABLE user_column_preferences
      DROP COLUMN IF EXISTS column_widths,
      ADD COLUMN IF NOT EXISTS column_config JSONB NOT NULL DEFAULT '{}'::jsonb;
  `;
  await db.query(sql);
  console.log("Migration 004 applied successfully");
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
