import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..", "..");

export function loadDatabaseUrl() {
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

/** Prefer keeper with most staff, then most children, then oldest id. */
export function pickKeeper(members) {
  return [...members].sort((a, b) => {
    if (b.staffTotal !== a.staffTotal) return b.staffTotal - a.staffTotal;
    if (b.staffActive !== a.staffActive) return b.staffActive - a.staffActive;
    if (b.childCount !== a.childCount) return b.childCount - a.childCount;
    return a.id - b.id;
  })[0];
}

export async function assertUsersEntityColumn(client) {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'users'
         AND column_name = 'entity_id'
     ) AS exists`,
  );

  if (!result.rows[0]?.exists) {
    throw new Error("users.entity_id column not found.");
  }
}

export async function loadDuplicateEntityGroups(client) {
  await assertUsersEntityColumn(client);

  const groupsResult = await client.query(`
    WITH dup_keys AS (
      SELECT
        e.entity_category_id,
        e.parent_entity_id,
        LOWER(TRIM(e.name)) AS name_key,
        COUNT(*)::int AS dup_count
      FROM entities e
      GROUP BY e.entity_category_id, e.parent_entity_id, LOWER(TRIM(e.name))
      HAVING COUNT(*) > 1
    )
    SELECT
      e.id::int AS id,
      e.name,
      ec.code AS category_code,
      e.parent_entity_id::int AS parent_entity_id,
      COALESCE(p.name, '(none)') AS parent_name,
      LOWER(TRIM(e.name)) AS name_key,
      e.created_at::text AS created_at,
      e.updated_at::text AS updated_at,
      (
        SELECT COUNT(*)::int
        FROM users u
        WHERE u.entity_id = e.id
      ) AS staff_total,
      (
        SELECT COUNT(*)::int
        FROM users u
        WHERE u.entity_id = e.id
          AND u.is_active = TRUE
      ) AS staff_active,
      (
        SELECT COUNT(*)::int
        FROM entities ch
        WHERE ch.parent_entity_id = e.id
      ) AS child_count
    FROM entities e
    INNER JOIN entity_categories ec ON ec.id = e.entity_category_id
    LEFT JOIN entities p ON p.id = e.parent_entity_id
    INNER JOIN dup_keys dk
      ON dk.entity_category_id = e.entity_category_id
     AND dk.name_key = LOWER(TRIM(e.name))
     AND (
       (dk.parent_entity_id IS NULL AND e.parent_entity_id IS NULL)
       OR dk.parent_entity_id = e.parent_entity_id
     )
    ORDER BY ec.code, e.name, e.id
  `);

  const byGroup = new Map();

  for (const row of groupsResult.rows) {
    const key = [
      row.category_code,
      row.parent_entity_id ?? "root",
      row.name_key,
    ].join("::");

    if (!byGroup.has(key)) {
      byGroup.set(key, {
        key,
        name: row.name,
        categoryCode: row.category_code,
        parentEntityId: row.parent_entity_id,
        parentName: row.parent_name,
        members: [],
      });
    }

    byGroup.get(key).members.push({
      id: Number(row.id),
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      staffTotal: Number(row.staff_total),
      staffActive: Number(row.staff_active),
      childCount: Number(row.child_count),
    });
  }

  return [...byGroup.values()].map((group) => {
    const keeper = pickKeeper(group.members);
    const duplicates = group.members.filter((member) => member.id !== keeper.id);

    return {
      ...group,
      keeper,
      duplicates,
    };
  });
}
