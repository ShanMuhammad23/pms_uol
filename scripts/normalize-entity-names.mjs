import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const PREFIX_PATTERNS_BY_CATEGORY = {
  C1: [/^Faculty of\s+/i],
  C2: [/^Department of\s+/i, /^Deparment of\s+/i],
  C3: [/^Faculty of\s+/i, /^Department of\s+/i, /^Deparment of\s+/i],
};

const FALLBACK_PREFIX_PATTERNS = [
  /^Faculty of\s+/i,
  /^Department of\s+/i,
  /^Deparment of\s+/i,
];

function loadEnvFile() {
  const envPath = join(rootDir, ".env");

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function createPool() {
  return new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:uzair1321@127.0.0.1:5432/pms_uol",
  });
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
  };
}

function normalizeEntityName(name, categoryCode) {
  let normalized = name.replace(/\s+/g, " ").trim();
  const patterns =
    PREFIX_PATTERNS_BY_CATEGORY[categoryCode] ?? FALLBACK_PREFIX_PATTERNS;

  for (const pattern of patterns) {
    normalized = normalized.replace(pattern, "");
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function buildConflictKey(entity) {
  return [
    entity.entity_category_id,
    entity.parent_entity_id ?? "root",
    entity.name.toLowerCase(),
  ].join("::");
}

async function main() {
  loadEnvFile();

  const { dryRun } = parseArgs(process.argv.slice(2));
  const pool = createPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT
         e.id,
         e.name,
         e.entity_category_id,
         ec.code AS category_code,
         e.parent_entity_id
       FROM entities e
       JOIN entity_categories ec ON ec.id = e.entity_category_id
       ORDER BY e.id`,
    );

    const plannedUpdates = [];

    for (const row of result.rows) {
      const nextName = normalizeEntityName(row.name, row.category_code);

      if (!nextName) {
        console.warn(
          `Skipping entity ${row.id}: name would be empty after normalization ("${row.name}")`,
        );
        continue;
      }

      if (nextName === row.name) {
        continue;
      }

      plannedUpdates.push({
        id: row.id,
        categoryCode: row.category_code,
        parentEntityId: row.parent_entity_id,
        entityCategoryId: row.entity_category_id,
        oldName: row.name,
        newName: nextName,
      });
    }

    const seenTargets = new Map();

    for (const update of plannedUpdates) {
      const key = buildConflictKey({
        entity_category_id: update.entityCategoryId,
        parent_entity_id: update.parentEntityId,
        name: update.newName,
      });

      const existing = seenTargets.get(key);

      if (existing) {
        throw new Error(
          `Name conflict after normalization: "${update.newName}" would be used by entities ${existing.id} ("${existing.oldName}") and ${update.id} ("${update.oldName}").`,
        );
      }

      seenTargets.set(key, update);
    }

    if (plannedUpdates.length === 0) {
      console.log("No entity names need updating.");
      return;
    }

    console.log(
      `${dryRun ? "Would update" : "Updating"} ${plannedUpdates.length} entities:`,
    );

    for (const update of plannedUpdates) {
      console.log(
        `  [${update.categoryCode}] ${update.id}: "${update.oldName}" -> "${update.newName}"`,
      );
    }

    if (dryRun) {
      return;
    }

    await client.query("BEGIN");

    for (const update of plannedUpdates) {
      await client.query(
        `UPDATE entities
         SET name = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [update.id, update.newName],
      );
    }

    await client.query("COMMIT");
    console.log("Entity name cleanup completed.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Entity name cleanup failed:", error.message);
  process.exit(1);
});
