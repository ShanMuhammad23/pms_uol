/**
 * Merge duplicate entities:
 * 1) Move staff (users.entity_id) from duplicates → keeper
 * 2) Reparent child entities from duplicates → keeper
 * 3) Delete duplicate entity rows
 *
 * Duplicate key: same category + same parent + same name (case/trim-insensitive).
 * Keeper: most staff, then most children, then oldest id.
 *
 * Usage:
 *   node scripts/merge-duplicate-entities.mjs           # dry-run (default)
 *   node scripts/merge-duplicate-entities.mjs --apply   # write changes
 *   node scripts/merge-duplicate-entities.mjs --apply --with-unique-index
 */
import pg from "pg";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  loadDatabaseUrl,
  loadDuplicateEntityGroups,
} from "./lib/duplicate-entities.mjs";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
    withUniqueIndex: argv.includes("--with-unique-index"),
  };
}

async function mergeGroup(client, group, { dryRun }) {
  const keeperId = group.keeper.id;
  const duplicateIds = group.duplicates.map((d) => d.id);

  let staffMoved = 0;
  let childrenReparented = 0;
  let deleted = 0;

  if (duplicateIds.length === 0) {
    return { staffMoved, childrenReparented, deleted };
  }

  if (dryRun) {
    const staff = await client.query(
      `SELECT COUNT(*)::int AS n FROM users WHERE entity_id = ANY($1::bigint[])`,
      [duplicateIds],
    );
    const children = await client.query(
      `SELECT COUNT(*)::int AS n FROM entities WHERE parent_entity_id = ANY($1::bigint[])`,
      [duplicateIds],
    );
    return {
      staffMoved: staff.rows[0].n,
      childrenReparented: children.rows[0].n,
      deleted: duplicateIds.length,
    };
  }

  const staffResult = await client.query(
    `UPDATE users
     SET entity_id = $1
     WHERE entity_id = ANY($2::bigint[])`,
    [keeperId, duplicateIds],
  );
  staffMoved = staffResult.rowCount ?? 0;

  const childResult = await client.query(
    `UPDATE entities
     SET parent_entity_id = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE parent_entity_id = ANY($2::bigint[])
       AND id <> $1`,
    [keeperId, duplicateIds],
  );
  childrenReparented = childResult.rowCount ?? 0;

  // Clear any self-parent edge cases (should not happen).
  await client.query(
    `UPDATE entities
     SET parent_entity_id = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       AND parent_entity_id = $1`,
    [keeperId],
  );

  const deleteResult = await client.query(
    `DELETE FROM entities WHERE id = ANY($1::bigint[])`,
    [duplicateIds],
  );
  deleted = deleteResult.rowCount ?? 0;

  return { staffMoved, childrenReparented, deleted };
}

async function main() {
  const { apply, withUniqueIndex } = parseArgs(process.argv.slice(2));
  const dryRun = !apply;

  const pool = new Pool({
    connectionString: loadDatabaseUrl(),
    connectionTimeoutMillis: 15000,
  });
  const client = await pool.connect();

  try {
    const groups = await loadDuplicateEntityGroups(client);

    console.log(
      dryRun
        ? "Duplicate entity merge (DRY RUN — no writes)"
        : "Duplicate entity merge (APPLYING)",
    );
    console.log("========================================");
    console.log(`Duplicate groups: ${groups.length}`);

    if (groups.length === 0) {
      console.log("Nothing to merge.");
      return;
    }

    const totals = {
      staffMoved: 0,
      childrenReparented: 0,
      deleted: 0,
    };

    if (!dryRun) {
      await client.query("BEGIN");
    }

    try {
      for (const group of groups) {
        const result = await mergeGroup(client, group, { dryRun });
        totals.staffMoved += result.staffMoved;
        totals.childrenReparented += result.childrenReparented;
        totals.deleted += result.deleted;

        console.log(
          `\n[${group.categoryCode}] "${group.name}" (parent: ${group.parentName})`,
        );
        console.log(
          `  KEEP id=${group.keeper.id} (staff=${group.keeper.staffTotal}, children=${group.keeper.childCount})`,
        );
        console.log(
          `  MERGE ids=${group.duplicates.map((d) => d.id).join(", ")}`,
        );
        console.log(
          `  → staff moved: ${result.staffMoved}, children reparented: ${result.childrenReparented}, entities deleted: ${result.deleted}`,
        );
      }

      if (!dryRun && withUniqueIndex) {
        const sqlPath = join(__dirname, "sql", "add-unique-entity-name.sql");
        const sql = readFileSync(sqlPath, "utf8");
        await client.query(sql);
        console.log("\nApplied unique index: uniq_entities_category_parent_name");
      }

      if (!dryRun) {
        await client.query("COMMIT");
        console.log("\nMerge committed.");
      } else {
        console.log("\nDry run only. Re-run with --apply to write changes.");
        console.log(
          "Optional: --apply --with-unique-index to add uniqueness constraint after merge.",
        );
      }

      console.log("\nTotals:");
      console.log(`  Staff reassigned: ${totals.staffMoved}`);
      console.log(`  Children reparented: ${totals.childrenReparented}`);
      console.log(`  Entities deleted: ${totals.deleted}`);
    } catch (error) {
      if (!dryRun) {
        await client.query("ROLLBACK");
        console.error("\nMerge rolled back.");
      }
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Merge failed:", error.message);
  process.exit(1);
});
