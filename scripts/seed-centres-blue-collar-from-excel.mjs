/**
 * Seed Centres + Blue Collar staff from the Final Performance Portal Excel.
 *
 * Only processes sheets: "Centres" and "Blue Collar"
 * Skips: "Acad. Staff" and "Non-Acad. Staff"
 *
 * Maps:
 *   SAP Code              → users.employee_id
 *   Name                  → first_name / last_name
 *   DOJ                   → date_of_joining
 *   Organizational Unit   → entities (match existing, else create C2 under C1 "Non-Academic")
 *   Position              → designation
 *   Job                   → role_category (Blue Collar; Centres often omit Job)
 *   email                 → {sap}@uol.edu.pk (no email column on these sheets)
 *
 * Does NOT assign staff_category_id / staff_sub_category_id.
 * Legacy NOT NULL enums on insert only:
 *   Centres     → SUPPORT_STAFF / PROFESSIONAL
 *   Blue Collar → BLUE_COLLAR / BLUE_COLLAR_GENERAL
 *
 * Usage:
 *   node scripts/seed-centres-blue-collar-from-excel.mjs
 *   node scripts/seed-centres-blue-collar-from-excel.mjs --dry-run
 *   node scripts/seed-centres-blue-collar-from-excel.mjs --file "path/to/file.xlsx"
 */

import { existsSync, readFileSync } from "fs";
import { dirname, isAbsolute, join, resolve } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import pg from "pg";
import XLSX from "xlsx";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const DEFAULT_EXCEL_FILE = join(
  rootDir,
  "public",
  "Final File - Performance Portal as of 01.07.26.xlsx",
);
const DEFAULT_PASSWORD = "Employee@123";
const NON_ACADEMIC_C1_NAME = "Non-Academic";
const TARGET_SHEETS = [
  {
    name: "Centres",
    empCategory: "SUPPORT_STAFF",
    empSubCategory: "PROFESSIONAL",
  },
  {
    name: "Blue Collar",
    empCategory: "BLUE_COLLAR",
    empSubCategory: "BLUE_COLLAR_GENERAL",
  },
];

function loadEnvFile() {
  const envPath = join(rootDir, ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env or the environment.",
    );
  }
  return new Pool({ connectionString });
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    excelPath: process.env.EXCEL_FILE
      ? String(process.env.EXCEL_FILE)
      : DEFAULT_EXCEL_FILE,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--file" && argv[index + 1]) {
      args.excelPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }

  return args;
}

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function stripOrgPrefixes(name) {
  return normalizeText(name).replace(
    /^(faculty of|department of|deparment of|academy of|school of|institute of)\s+/i,
    "",
  );
}

function splitName(fullName) {
  const normalized = normalizeText(fullName);
  if (!normalized) return { firstName: "Unknown", lastName: "Employee" };

  const parts = normalized.split(" ");
  return {
    firstName: parts[0].slice(0, 50),
    lastName: (parts.length > 1 ? parts.slice(1).join(" ") : "").slice(0, 50),
  };
}

function formatDateOfJoining(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const text = normalizeText(value);
  if (!text) return null;

  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    let year = Number(slash[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const month = String(Number(slash[1])).padStart(2, "0");
    const day = String(Number(slash[2])).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function resolveExcelPath(pathValue) {
  if (!pathValue) return null;
  return isAbsolute(pathValue) ? pathValue : resolve(rootDir, pathValue);
}

function pickBestEntityMatch(matches) {
  if (!matches || matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const ranked = [...matches].sort((left, right) => {
    const rank = (row) => {
      if (row.category === "C3") return 3;
      if (row.category === "C2") return 2;
      return 1;
    };
    return rank(right) - rank(left) || Number(left.id) - Number(right.id);
  });

  return ranked[0];
}

function readTargetSheets(excelPath) {
  if (!existsSync(excelPath)) {
    throw new Error(`Excel file not found: ${excelPath}`);
  }

  const workbook = XLSX.readFile(excelPath, { cellDates: true });
  const available = workbook.SheetNames;
  const missing = TARGET_SHEETS.map((s) => s.name).filter(
    (name) => !available.includes(name),
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing sheet(s): ${missing.join(", ")}. Available: ${available.join(", ")}`,
    );
  }

  console.log(
    `Skipping sheets: ${available
      .filter((name) => !TARGET_SHEETS.some((s) => s.name === name))
      .join(", ") || "(none)"}`,
  );

  const entries = [];
  const seenSap = new Map();

  for (const sheetConfig of TARGET_SHEETS) {
    const sheet = workbook.Sheets[sheetConfig.name];
    const rawRows = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
    });

    for (let index = 0; index < rawRows.length; index += 1) {
      const row = rawRows[index];
      const excelRow = index + 2;
      const sapCode = normalizeText(row["SAP Code"]);
      const name = normalizeText(row.Name);
      const organizationalUnit = normalizeText(row["Organizational Unit"]);
      const job = normalizeText(row.Job) || null;
      const position =
        normalizeText(row.Position) || normalizeText(row.Designation) || null;
      const dateOfJoining = formatDateOfJoining(row.DOJ);

      if (!sapCode && !name && !organizationalUnit) continue;

      if (!sapCode) {
        entries.push({
          sheetName: sheetConfig.name,
          excelRow,
          error: "Missing SAP Code",
        });
        continue;
      }

      if (!name) {
        entries.push({
          sheetName: sheetConfig.name,
          excelRow,
          sapCode,
          error: "Missing Name",
        });
        continue;
      }

      if (!organizationalUnit) {
        entries.push({
          sheetName: sheetConfig.name,
          excelRow,
          sapCode,
          error: "Missing Organizational Unit",
        });
        continue;
      }

      if (seenSap.has(sapCode)) {
        const prior = seenSap.get(sapCode);
        entries.push({
          sheetName: sheetConfig.name,
          excelRow,
          sapCode,
          error: `Duplicate SAP Code (also on ${prior.sheetName} row ${prior.excelRow})`,
        });
        continue;
      }

      seenSap.set(sapCode, {
        sheetName: sheetConfig.name,
        excelRow,
      });

      const { firstName, lastName } = splitName(name);
      entries.push({
        sheetName: sheetConfig.name,
        excelRow,
        sapCode,
        name,
        firstName,
        lastName,
        organizationalUnit,
        job,
        position,
        email: `${sapCode}@uol.edu.pk`.toLowerCase(),
        dateOfJoining,
        empCategory: sheetConfig.empCategory,
        empSubCategory: sheetConfig.empSubCategory,
        error: null,
      });
    }
  }

  return { availableSheets: available, entries };
}

async function columnExists(client, tableName, columnName) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [tableName, columnName],
  );
  return Boolean(result.rows[0]?.exists);
}

async function getCategoryIds(client) {
  const result = await client.query(
    `SELECT id, code FROM entity_categories WHERE code IN ('C1', 'C2')`,
  );
  const byCode = new Map(result.rows.map((row) => [row.code, row.id]));
  if (!byCode.has("C1") || !byCode.has("C2")) {
    throw new Error("Entity categories C1 and C2 must exist before seeding.");
  }
  return {
    c1CategoryId: byCode.get("C1"),
    c2CategoryId: byCode.get("C2"),
  };
}

async function loadEntities(client) {
  const result = await client.query(
    `
      SELECT e.id, e.name, ec.code AS category, e.parent_entity_id, p.name AS parent_name
      FROM entities e
      JOIN entity_categories ec ON ec.id = e.entity_category_id
      LEFT JOIN entities p ON p.id = e.parent_entity_id
      ORDER BY e.id
    `,
  );
  return result.rows;
}

function buildEntityIndexes(entities) {
  const byExact = new Map();
  const byStripped = new Map();

  for (const entity of entities) {
    const exactKey = normalizeKey(entity.name);
    if (!byExact.has(exactKey)) byExact.set(exactKey, []);
    byExact.get(exactKey).push(entity);

    const strippedKey = normalizeKey(stripOrgPrefixes(entity.name));
    if (!byStripped.has(strippedKey)) byStripped.set(strippedKey, []);
    byStripped.get(strippedKey).push(entity);
  }

  return { byExact, byStripped };
}

function findExistingEntity(organizationalUnit, indexes) {
  const exactKey = normalizeKey(organizationalUnit);
  const strippedKey = normalizeKey(stripOrgPrefixes(organizationalUnit));

  const candidates = [
    ...(indexes.byExact.get(exactKey) ?? []),
    ...(indexes.byExact.get(strippedKey) ?? []),
    ...(indexes.byStripped.get(exactKey) ?? []),
    ...(indexes.byStripped.get(strippedKey) ?? []),
  ];

  const unique = [
    ...new Map(candidates.map((row) => [String(row.id), row])).values(),
  ];
  return pickBestEntityMatch(unique);
}

async function ensureNonAcademicC1(client, c1CategoryId) {
  const existing = await client.query(
    `
      SELECT id
      FROM entities
      WHERE entity_category_id = $1
        AND lower(name) = lower($2)
      ORDER BY id
      LIMIT 1
    `,
    [c1CategoryId, NON_ACADEMIC_C1_NAME],
  );

  if (existing.rows[0]) {
    return { id: existing.rows[0].id, created: false };
  }

  const inserted = await client.query(
    `
      INSERT INTO entities (name, entity_category_id, parent_entity_id)
      VALUES ($1, $2, NULL)
      RETURNING id
    `,
    [NON_ACADEMIC_C1_NAME, c1CategoryId],
  );

  return { id: inserted.rows[0].id, created: true };
}

async function createC2UnderParent(client, name, c2CategoryId, parentEntityId) {
  const existing = await client.query(
    `
      SELECT id
      FROM entities
      WHERE entity_category_id = $1
        AND parent_entity_id = $2
        AND lower(name) = lower($3)
      LIMIT 1
    `,
    [c2CategoryId, parentEntityId, name],
  );

  if (existing.rows[0]) {
    return { id: existing.rows[0].id, created: false };
  }

  const inserted = await client.query(
    `
      INSERT INTO entities (name, entity_category_id, parent_entity_id)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [name, c2CategoryId, parentEntityId],
  );

  return { id: inserted.rows[0].id, created: true };
}

async function resolveEntityMap(client, organizationalUnits, categoryIds, dryRun) {
  const entities = await loadEntities(client);
  const indexes = buildEntityIndexes(entities);
  const resolved = new Map();
  const summary = {
    matchedExisting: 0,
    createdC1: 0,
    createdC2: 0,
    unmatchedWouldCreate: 0,
  };

  const needsCreate = [];

  for (const orgUnit of organizationalUnits) {
    const existing = findExistingEntity(orgUnit, indexes);
    if (existing) {
      resolved.set(orgUnit, {
        entityId: existing.id,
        source: "existing",
        matchedName: existing.name,
        category: existing.category,
        parentName: existing.parent_name,
      });
      summary.matchedExisting += 1;
      continue;
    }
    needsCreate.push(orgUnit);
  }

  if (needsCreate.length === 0) {
    return { resolved, summary };
  }

  if (dryRun) {
    summary.unmatchedWouldCreate = needsCreate.length;
    for (const orgUnit of needsCreate) {
      resolved.set(orgUnit, {
        entityId: null,
        source: "would-create-c2",
        matchedName: orgUnit,
        category: "C2",
        parentName: NON_ACADEMIC_C1_NAME,
      });
    }
    return { resolved, summary };
  }

  const c1 = await ensureNonAcademicC1(client, categoryIds.c1CategoryId);
  if (c1.created) summary.createdC1 += 1;

  for (const orgUnit of needsCreate) {
    const created = await createC2UnderParent(
      client,
      orgUnit,
      categoryIds.c2CategoryId,
      c1.id,
    );
    if (created.created) summary.createdC2 += 1;
    resolved.set(orgUnit, {
      entityId: created.id,
      source: "created-c2",
      matchedName: orgUnit,
      category: "C2",
      parentName: NON_ACADEMIC_C1_NAME,
    });
  }

  return { resolved, summary };
}

async function upsertUser(client, payload, hasRoleCategory) {
  const columns = [
    "employee_id",
    "email",
    "password_hash",
    "first_name",
    "last_name",
    "designation",
    "date_of_joining",
    "system_role",
    "emp_category",
    "emp_sub_category",
    "entity_id",
    "is_active",
  ];
  const values = [
    payload.employeeId,
    payload.email,
    payload.passwordHash,
    payload.firstName,
    payload.lastName,
    payload.designation,
    payload.dateOfJoining,
    payload.systemRole,
    payload.empCategory,
    payload.empSubCategory,
    payload.entityId,
    true,
  ];

  if (hasRoleCategory) {
    columns.push("role_category");
    values.push(payload.roleCategory);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const updateColumns = [
    "email",
    "first_name",
    "last_name",
    "designation",
    "date_of_joining",
    "system_role",
    "entity_id",
    "is_active",
  ];
  if (hasRoleCategory) updateColumns.push("role_category");

  // Never touch staff_category_id / staff_sub_category_id.
  // Also preserve existing emp_category / emp_sub_category on update.
  const result = await client.query(
    `
      INSERT INTO users (${columns.join(", ")})
      VALUES (${placeholders})
      ON CONFLICT (employee_id) DO UPDATE
      SET ${updateColumns.map((column) => `${column} = EXCLUDED.${column}`).join(", ")}
      RETURNING id, employee_id, (xmax = 0) AS inserted
    `,
    values,
  );

  return {
    id: result.rows[0].id,
    employeeId: result.rows[0].employee_id,
    inserted: result.rows[0].inserted,
  };
}

async function main() {
  loadEnvFile();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`Seed Centres + Blue Collar employees from Final File Excel.

Usage:
  node scripts/seed-centres-blue-collar-from-excel.mjs
  node scripts/seed-centres-blue-collar-from-excel.mjs --dry-run
  node scripts/seed-centres-blue-collar-from-excel.mjs --file "path/to/file.xlsx"

Processes only: Centres, Blue Collar
Skips: Acad. Staff, Non-Acad. Staff
`);
    return;
  }

  const excelPath = resolveExcelPath(args.excelPath);
  if (!excelPath) {
    throw new Error("Provide an Excel path with --file <path> or EXCEL_FILE.");
  }

  const { entries } = readTargetSheets(excelPath);
  const validEntries = entries.filter((entry) => entry.error == null);
  const invalidEntries = entries.filter((entry) => entry.error != null);
  const organizationalUnits = [
    ...new Set(validEntries.map((entry) => entry.organizationalUnit)),
  ].sort();

  const bySheet = {};
  for (const entry of validEntries) {
    bySheet[entry.sheetName] = (bySheet[entry.sheetName] || 0) + 1;
  }

  console.log(`File: ${excelPath}`);
  console.log(`Target sheets: ${TARGET_SHEETS.map((s) => s.name).join(", ")}`);
  console.log(`Rows parsed: ${entries.length}`);
  console.log(`Valid rows: ${validEntries.length}`);
  for (const [sheet, count] of Object.entries(bySheet)) {
    console.log(`  ${sheet}: ${count}`);
  }
  console.log(`Invalid/skipped rows: ${invalidEntries.length}`);
  console.log(`Unique organizational units: ${organizationalUnits.length}`);
  if (args.dryRun) console.log("Mode: dry-run (no database writes)");
  console.log("");

  for (const entry of invalidEntries) {
    console.warn(
      `  skip ${entry.sheetName} row ${entry.excelRow}: SAP=${entry.sapCode ?? "—"} (${entry.error})`,
    );
  }

  const pool = createPool();
  const client = await pool.connect();

  const summary = {
    inserted: 0,
    updated: 0,
    errors: 0,
  };

  try {
    const hasEntityColumn = await columnExists(client, "users", "entity_id");
    if (!hasEntityColumn) {
      throw new Error("users.entity_id is missing. Run entity migrations first.");
    }

    const hasRoleCategory = await columnExists(client, "users", "role_category");
    const categoryIds = await getCategoryIds(client);

    if (!args.dryRun) {
      await client.query("BEGIN");
    }

    const entityResolution = await resolveEntityMap(
      client,
      organizationalUnits,
      categoryIds,
      args.dryRun,
    );

    console.log("Entity resolution");
    console.log(`  matched existing: ${entityResolution.summary.matchedExisting}`);
    console.log(`  C1 created:       ${entityResolution.summary.createdC1}`);
    console.log(
      `  C2 created:       ${
        args.dryRun
          ? `would create ${entityResolution.summary.unmatchedWouldCreate}`
          : entityResolution.summary.createdC2
      }`,
    );
    console.log("");

    for (const [orgUnit, info] of entityResolution.resolved) {
      if (info.source === "existing") {
        console.log(
          `  match: "${orgUnit}" → ${info.category} "${info.matchedName}"` +
            (info.parentName ? ` (parent: ${info.parentName})` : ""),
        );
      } else if (info.source === "would-create-c2") {
        console.log(
          `  would create C2: "${orgUnit}" under "${NON_ACADEMIC_C1_NAME}"`,
        );
      } else {
        console.log(
          `  created C2: "${orgUnit}" under "${NON_ACADEMIC_C1_NAME}"`,
        );
      }
    }
    console.log("");

    if (args.dryRun) {
      console.log(`Would upsert ${validEntries.length} users.`);
      console.log(
        "Staff category/subcategory will remain unassigned (staff_* null).",
      );
      console.log(
        "Centres → SUPPORT_STAFF/PROFESSIONAL; Blue Collar → BLUE_COLLAR/BLUE_COLLAR_GENERAL (insert only).",
      );
      return;
    }

    const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

    for (const entry of validEntries) {
      try {
        const entityInfo = entityResolution.resolved.get(
          entry.organizationalUnit,
        );
        if (!entityInfo?.entityId) {
          throw new Error(
            `No entity resolved for "${entry.organizationalUnit}".`,
          );
        }

        const emailOwner = await client.query(
          `
            SELECT employee_id
            FROM users
            WHERE lower(email) = lower($1)
              AND employee_id <> $2
            LIMIT 1
          `,
          [entry.email, entry.sapCode],
        );
        if (emailOwner.rows[0]) {
          summary.errors += 1;
          console.warn(
            `  conflict: SAP ${entry.sapCode} email ${entry.email} already used by SAP ${emailOwner.rows[0].employee_id}`,
          );
          continue;
        }

        const result = await upsertUser(
          client,
          {
            employeeId: entry.sapCode,
            email: entry.email,
            passwordHash,
            firstName: entry.firstName,
            lastName: entry.lastName,
            designation: entry.position,
            roleCategory: entry.job,
            dateOfJoining: entry.dateOfJoining,
            systemRole: "EMPLOYEE",
            empCategory: entry.empCategory,
            empSubCategory: entry.empSubCategory,
            entityId: entityInfo.entityId,
          },
          hasRoleCategory,
        );

        if (result.inserted) {
          summary.inserted += 1;
          console.log(
            `  inserted [${entry.sheetName}]: SAP ${entry.sapCode} → ${entityInfo.matchedName}`,
          );
        } else {
          summary.updated += 1;
          console.log(
            `  updated [${entry.sheetName}]: SAP ${entry.sapCode} → ${entityInfo.matchedName}`,
          );
        }
      } catch (error) {
        summary.errors += 1;
        console.error(
          `  error: SAP ${entry.sapCode} (${entry.sheetName} row ${entry.excelRow}):`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    await client.query("COMMIT");

    console.log("");
    console.log("Summary");
    console.log(`  inserted: ${summary.inserted}`);
    console.log(`  updated:  ${summary.updated}`);
    console.log(`  errors:   ${summary.errors}`);
    console.log(`  skipped:  ${invalidEntries.length}`);
    console.log(`  default password (new users): ${DEFAULT_PASSWORD}`);
    console.log(
      "  staff_category_id / staff_sub_category_id: left NULL (not assigned)",
    );
  } catch (error) {
    if (!args.dryRun) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
