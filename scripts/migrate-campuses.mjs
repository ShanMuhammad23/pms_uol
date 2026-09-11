/**
 * Migration: Add campuses table and campus_id column to entities.
 *
 * Creates a `campuses` table, inserts "Lahore" as the default campus (id=1),
 * inserts "Sargodha" as campus id=2, and adds `campus_id` to the `entities`
 * table with DEFAULT 1. Campus is assigned at the C0 (top) level — all
 * users under a C0 entity inherit the campus through the hierarchy.
 *
 * Usage: node scripts/migrate-campuses.mjs
 *
 * This migration is idempotent — safe to run multiple times.
 */
import { db } from "../lib/db.ts";

async function migrate() {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // 1. Create campuses table (if not exists)
    await client.query(`
      CREATE TABLE IF NOT EXISTS campuses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        code VARCHAR(10) NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Insert default campuses
    await client.query(`
      INSERT INTO campuses (id, name, code)
      VALUES (1, 'Lahore', 'LHR')
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO campuses (id, name, code)
      VALUES (2, 'Sargodha', 'SGD')
      ON CONFLICT (id) DO NOTHING
    `);

    // 3. Add campus_id column to entities (if not exists)
    const entityCampusExists = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'entities'
          AND column_name = 'campus_id'
      ) AS exists
    `);

    if (!entityCampusExists.rows[0].exists) {
      await client.query(`
        ALTER TABLE entities
        ADD COLUMN campus_id INT REFERENCES campuses(id) ON DELETE SET NULL DEFAULT 1
      `);
      await client.query(`
        UPDATE entities SET campus_id = 1 WHERE campus_id IS NULL
      `);
      console.log("Added campus_id column to entities table (default: 1 = Lahore)");
    } else {
      console.log("campus_id column already exists on entities table");
    }

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_entities_campus ON entities(campus_id)
    `);

    await client.query("COMMIT");
    console.log("Migration completed successfully.");
    console.log("  - campuses table created");
    console.log("  - Lahore (id=1) and Sargodha (id=2) inserted");
    console.log("  - entities.campus_id added with DEFAULT 1");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end();
  }
}

migrate();
