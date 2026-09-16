/**
 * Seed Sargodha blue-collar staff from Excel.
 *
 * Department resolution:
 *   1. Match existing entity by name (prefer under --parent, then campus --campus)
 *   2. If none, create C2 under C1 Support - Sargodha (default parent 225)
 *      which sits under C0 Non-Academic (SGD) (222), campus_id default 2
 *
 * Maps:
 *   SAP Code         → users.employee_id
 *   Employee Name    → first_name / last_name
 *   Joining Date     → date_of_joining
 *   Designation      → designation
 *   Department       → entity_id (matched or created)
 *   email            → {sap}@uol.edu.pk (no email column in this sheet)
 *
 * Legacy enums: BLUE_COLLAR / BLUE_COLLAR_GENERAL
 * Does NOT assign staff_category_id / staff_sub_category_id.
 *
 * Usage:
 *   node scripts/seed-sargodha-blue-collar-from-excel.mjs --dry-run
 *   node scripts/seed-sargodha-blue-collar-from-excel.mjs
 *   node scripts/seed-sargodha-blue-collar-from-excel.mjs --file "SRG - Blue Collar PMS Data 2025-26.xlsx"
 *   node scripts/seed-sargodha-blue-collar-from-excel.mjs --parent 225 --campus 2
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
  "SRG - Blue Collar PMS Data 2025-26.xlsx",
);
const DEFAULT_SHEET_NAME = "Blue Collar Staff";
const DEFAULT_PARENT_ENTITY_ID = 225; // Support - Sargodha (C1)
const DEFAULT_CAMPUS_ID = 2;
const DEFAULT_PASSWORD = "Employee@123";
const EMP_CATEGORY = "BLUE_COLLAR";
const EMP_SUB_CATEGORY = "BLUE_COLLAR_GENERAL";

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
    sheetName: DEFAULT_SHEET_NAME,
    parentEntityId: DEFAULT_PARENT_ENTITY_ID,
    campusId: DEFAULT_CAMPUS_ID,
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
    if (arg === "--sheet" && argv[index + 1]) {
      args.sheetName = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--parent" && argv[index + 1]) {
      args.parentEntityId = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--campus" && argv[index + 1]) {
      args.campusId = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }

  if (!Number.isInteger(args.parentEntityId) || args.parentEntityId <= 0) {
    throw new Error("--parent must be a positive integer entity id.");
  }
  if (!Number.isInteger(args.campusId) || args.campusId <= 0) {
    throw new Error("--campus must be a positive integer campus id.");
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

function resolveExcelPath(pathValue) {
  if (!pathValue) return null;
  return isAbsolute(pathValue) ? pathValue : resolve(rootDir, pathValue);
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

function excelSerialToDate(serial) {
  const ms = Math.round((Number(serial) - 25569) * 86400 * 1000);
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOfJoining(value) {
  if (!value && value !== 0) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const fromSerial = excelSerialToDate(value);
    if (fromSerial) return formatDateOfJoining(fromSerial);
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

function pickBestEntityMatch(matches) {
  if (!matches || matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const ranked = [...matches].sort((left, right) => {
    const rank = (row) => {
      if (row.category === "C3") return 3;
      if (row.category === "C2") return 2;
      return 1;
    };
    // Prefer under the intended parent, then more specific category, then older id.
    const parentBoost = (row) => (row.underPreferredParent ? 10 : 0);
    return (
      parentBoost(right) - parentBoost(left) ||
      rank(right) - rank(left) ||
      Number(left.id) - Number(right.id)
    );
  });

  return ranked[0];
}

function readRowsFromExcel(excelPath, sheetName) {
  if (!existsSync(excelPath)) {
    throw new Error(`Excel file not found: ${excelPath}`);
  }

  const workbook = XLSX.readFile(excelPath, { cellDates: true });
  const targetSheetName =
    sheetName && workbook.SheetNames.includes(sheetName)
      ? sheetName
      : workbook.SheetNames[0];

  if (!targetSheetName) {
    throw new Error("Excel workbook has no sheets.");
  }

  if (sheetName && targetSheetName !== sheetName) {
    throw new Error(
      `Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(", ")}`,
    );
  }

  const sheet = workbook.Sheets[targetSheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  if (rawRows.length === 0) {
    throw new Error(`Sheet "${targetSheetName}" has no data rows.`);
  }

  const entries = [];
  const seenSap = new Map();

  for (let index = 0; index < rawRows.length; index += 1) {
    const row = rawRows[index];
    const excelRow = index + 2;
    const sapCode = normalizeText(row["SAP Code"]);
    const name = normalizeText(row["Employee Name"] ?? row.Name);
    const department = normalizeText(
      row.Department ?? row["Organizational Unit"],
    );
    const designation =
      normalizeText(row.Designation) || normalizeText(row.Position) || null;
    const dateOfJoining = formatDateOfJoining(row["Joining Date"] ?? row.DOJ);

    if (!sapCode && !name && !department) continue;

    if (!sapCode) {
      entries.push({ excelRow, error: "Missing SAP Code" });
      continue;
    }
    if (!name) {
      entries.push({ excelRow, sapCode, error: "Missing Employee Name" });
      continue;
    }
    if (!department) {
      entries.push({ excelRow, sapCode, error: "Missing Department" });
      continue;
    }
    if (seenSap.has(sapCode)) {
      entries.push({
        excelRow,
        sapCode,
        error: `Duplicate SAP Code (also on row ${seenSap.get(sapCode)})`,
      });
      continue;
    }

    seenSap.set(sapCode, excelRow);
    const { firstName, lastName } = splitName(name);

    entries.push({
      excelRow,
      sapCode,
      name,
      firstName,
      lastName,
      department,
      designation,
      email: `${sapCode}@uol.edu.pk`.toLowerCase(),
      dateOfJoining,
      error: null,
    });
  }

  return { sheetName: targetSheetName, entries };
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

async function getC2CategoryId(client) {
  const result = await client.query(
    `SELECT id FROM entity_categories WHERE code = 'C2' LIMIT 1`,
  );
  if (!result.rows[0]) {
    throw new Error("Entity category C2 must exist before seeding.");
  }
  return result.rows[0].id;
}

async function loadParentEntity(client, parentEntityId, hasCampusColumn) {
  const campusSelect = hasCampusColumn
    ? ", e.campus_id"
    : ", NULL::int AS campus_id";
  const result = await client.query(
    `
      SELECT e.id, e.name, ec.code AS category, e.parent_entity_id${campusSelect}
      FROM entities e
      JOIN entity_categories ec ON ec.id = e.entity_category_id
      WHERE e.id = $1
      LIMIT 1
    `,
    [parentEntityId],
  );

  if (!result.rows[0]) {
    throw new Error(`Parent entity id ${parentEntityId} was not found.`);
  }

  return result.rows[0];
}

async function loadCampusEntities(client, campusId, hasCampusColumn) {
  if (hasCampusColumn) {
    const result = await client.query(
      `
        SELECT e.id, e.name, ec.code AS category, e.parent_entity_id,
               p.name AS parent_name, e.campus_id
        FROM entities e
        JOIN entity_categories ec ON ec.id = e.entity_category_id
        LEFT JOIN entities p ON p.id = e.parent_entity_id
        WHERE e.campus_id = $1
        ORDER BY e.id
      `,
      [campusId],
    );
    return result.rows;
  }

  const result = await client.query(
    `
      SELECT e.id, e.name, ec.code AS category, e.parent_entity_id,
             p.name AS parent_name, NULL::int AS campus_id
      FROM entities e
      JOIN entity_categories ec ON ec.id = e.entity_category_id
      LEFT JOIN entities p ON p.id = e.parent_entity_id
      ORDER BY e.id
    `,
  );
  return result.rows;
}

function findExistingDepartment(department, entities, preferredParentId) {
  const key = normalizeKey(department);
  const matches = entities
    .filter((entity) => normalizeKey(entity.name) === key)
    .map((entity) => ({
      ...entity,
      underPreferredParent:
        Number(entity.parent_entity_id) === Number(preferredParentId),
    }));

  return pickBestEntityMatch(matches);
}

async function createC2UnderParent(
  client,
  { name, c2CategoryId, parentEntityId, campusId, hasCampusColumn },
) {
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
    if (hasCampusColumn) {
      await client.query(
        `UPDATE entities SET campus_id = COALESCE(campus_id, $2) WHERE id = $1`,
        [existing.rows[0].id, campusId],
      );
    }
    return { id: existing.rows[0].id, created: false };
  }

  if (hasCampusColumn) {
    const inserted = await client.query(
      `
        INSERT INTO entities (name, entity_category_id, parent_entity_id, campus_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [name, c2CategoryId, parentEntityId, campusId],
    );
    return { id: inserted.rows[0].id, created: true };
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

async function resolveDepartmentEntities(
  client,
  departments,
  {
    c2CategoryId,
    parentEntityId,
    parentName,
    campusId,
    hasCampusColumn,
    dryRun,
  },
) {
  const campusEntities = await loadCampusEntities(
    client,
    campusId,
    hasCampusColumn,
  );
  const resolved = new Map();
  let matchedExisting = 0;
  let createdC2 = 0;
  let wouldCreate = 0;

  for (const department of departments) {
    const existing = findExistingDepartment(
      department,
      campusEntities,
      parentEntityId,
    );

    if (existing) {
      matchedExisting += 1;
      resolved.set(department, {
        entityId: existing.id,
        source: "existing",
        matchedName: existing.name,
        category: existing.category,
        parentName: existing.parent_name,
      });
      continue;
    }

    if (dryRun) {
      wouldCreate += 1;
      resolved.set(department, {
        entityId: null,
        source: "would-create-c2",
        matchedName: department,
        category: "C2",
        parentName,
      });
      continue;
    }

    const created = await createC2UnderParent(client, {
      name: department,
      c2CategoryId,
      parentEntityId,
      campusId,
      hasCampusColumn,
    });

    if (created.created) createdC2 += 1;

    // Keep in-memory index current for later departments in this run.
    campusEntities.push({
      id: created.id,
      name: department,
      category: "C2",
      parent_entity_id: parentEntityId,
      parent_name: parentName,
      campus_id: campusId,
    });

    resolved.set(department, {
      entityId: created.id,
      source: created.created ? "created-c2" : "existing",
      matchedName: department,
      category: "C2",
      parentName,
    });
  }

  return {
    resolved,
    summary: { matchedExisting, createdC2, wouldCreate },
  };
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
    "emp_category",
    "emp_sub_category",
    "entity_id",
    "is_active",
  ];
  if (hasRoleCategory) updateColumns.push("role_category");

  const updates = updateColumns
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(", ");

  const result = await client.query(
    `
      INSERT INTO users (${columns.join(", ")})
      VALUES (${placeholders})
      ON CONFLICT (employee_id) DO UPDATE
      SET ${updates}
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
    console.log(`Seed Sargodha blue-collar staff from Excel.

Usage:
  node scripts/seed-sargodha-blue-collar-from-excel.mjs --dry-run
  node scripts/seed-sargodha-blue-collar-from-excel.mjs
  node scripts/seed-sargodha-blue-collar-from-excel.mjs --file "SRG - Blue Collar PMS Data 2025-26.xlsx"
  node scripts/seed-sargodha-blue-collar-from-excel.mjs --parent 225 --campus 2

Defaults:
  file    ${DEFAULT_EXCEL_FILE}
  sheet   ${DEFAULT_SHEET_NAME}
  parent  ${DEFAULT_PARENT_ENTITY_ID} (Support - Sargodha)
  campus  ${DEFAULT_CAMPUS_ID} (Sargodha)

Department matching: reuse campus entity by name when found;
otherwise create C2 under the parent.
`);
    return;
  }

  const excelPath = resolveExcelPath(args.excelPath);
  if (!excelPath) {
    throw new Error("Provide an Excel path with --file <path> or EXCEL_FILE.");
  }

  const { sheetName, entries } = readRowsFromExcel(excelPath, args.sheetName);
  const validEntries = entries.filter((entry) => entry.error == null);
  const invalidEntries = entries.filter((entry) => entry.error != null);
  const departments = [
    ...new Set(validEntries.map((entry) => entry.department)),
  ].sort();

  console.log(`File: ${excelPath}`);
  console.log(`Sheet: ${sheetName}`);
  console.log(`Rows parsed: ${entries.length}`);
  console.log(`Valid rows: ${validEntries.length}`);
  console.log(`Invalid/skipped rows: ${invalidEntries.length}`);
  console.log(`Unique departments: ${departments.length}`);
  console.log(`Parent entity id: ${args.parentEntityId}`);
  console.log(`Campus id: ${args.campusId}`);
  if (args.dryRun) console.log("Mode: dry-run (no database writes)");
  console.log("");

  for (const entry of invalidEntries) {
    console.warn(
      `  skip row ${entry.excelRow}: SAP=${entry.sapCode ?? "—"} (${entry.error})`,
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

    const hasCampusColumn = await columnExists(client, "entities", "campus_id");
    const hasRoleCategory = await columnExists(client, "users", "role_category");
    const c2CategoryId = await getC2CategoryId(client);
    const parent = await loadParentEntity(
      client,
      args.parentEntityId,
      hasCampusColumn,
    );

    if (parent.category !== "C1") {
      console.warn(
        `Warning: parent entity ${parent.id} "${parent.name}" is ${parent.category}, expected C1.`,
      );
    }

    console.log(
      `Fallback parent: ${parent.category} "${parent.name}" (id ${parent.id})` +
        (parent.campus_id != null ? `, campus_id=${parent.campus_id}` : ""),
    );
    console.log("");

    if (!args.dryRun) {
      await client.query("BEGIN");
    }

    const entityResolution = await resolveDepartmentEntities(
      client,
      departments,
      {
        c2CategoryId,
        parentEntityId: args.parentEntityId,
        parentName: parent.name,
        campusId: args.campusId,
        hasCampusColumn,
        dryRun: args.dryRun,
      },
    );

    console.log("Department resolution");
    console.log(
      `  matched existing: ${entityResolution.summary.matchedExisting}`,
    );
    console.log(
      `  C2 created:       ${
        args.dryRun
          ? `would create ${entityResolution.summary.wouldCreate}`
          : entityResolution.summary.createdC2
      }`,
    );
    console.log("");

    for (const [department, info] of entityResolution.resolved) {
      if (info.source === "existing") {
        console.log(
          `  match: "${department}" → ${info.category} "${info.matchedName}"` +
            (info.parentName ? ` (parent: ${info.parentName})` : ""),
        );
      } else if (info.source === "would-create-c2") {
        console.log(
          `  would create C2: "${department}" under "${parent.name}" (campus ${args.campusId})`,
        );
      } else {
        console.log(
          `  created C2: "${department}" under "${parent.name}" (campus ${args.campusId})`,
        );
      }
    }
    console.log("");

    if (args.dryRun) {
      console.log(`Would upsert ${validEntries.length} blue-collar users.`);
      console.log(
        `Legacy enums: ${EMP_CATEGORY} / ${EMP_SUB_CATEGORY}; staff_* left NULL.`,
      );
      return;
    }

    const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

    for (const entry of validEntries) {
      const savepoint = `sp_sap_${entry.sapCode.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      try {
        await client.query(`SAVEPOINT ${savepoint}`);

        const entityInfo = entityResolution.resolved.get(entry.department);
        if (!entityInfo?.entityId) {
          throw new Error(`No entity resolved for "${entry.department}".`);
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
          await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
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
            designation: entry.designation,
            roleCategory: null,
            dateOfJoining: entry.dateOfJoining,
            systemRole: "EMPLOYEE",
            empCategory: EMP_CATEGORY,
            empSubCategory: EMP_SUB_CATEGORY,
            entityId: entityInfo.entityId,
          },
          hasRoleCategory,
        );

        await client.query(`RELEASE SAVEPOINT ${savepoint}`);

        if (result.inserted) {
          summary.inserted += 1;
          console.log(
            `  inserted: SAP ${entry.sapCode} → ${entityInfo.matchedName}`,
          );
        } else {
          summary.updated += 1;
          console.log(
            `  updated: SAP ${entry.sapCode} → ${entityInfo.matchedName}`,
          );
        }
      } catch (error) {
        try {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        } catch {
          // Outer handler will roll back.
        }
        summary.errors += 1;
        console.error(
          `  error: SAP ${entry.sapCode} (Excel row ${entry.excelRow}):`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    await client.query("COMMIT");

    console.log("");
    console.log("Summary");
    console.log(
      `  departments matched: ${entityResolution.summary.matchedExisting}`,
    );
    console.log(
      `  C2 created:          ${entityResolution.summary.createdC2}`,
    );
    console.log(`  inserted:            ${summary.inserted}`);
    console.log(`  updated:             ${summary.updated}`);
    console.log(`  errors:              ${summary.errors}`);
    console.log(`  skipped:             ${invalidEntries.length}`);
    console.log(`  default password (new users): ${DEFAULT_PASSWORD}`);
    console.log(
      `  emp_category / emp_sub_category: ${EMP_CATEGORY} / ${EMP_SUB_CATEGORY}`,
    );
    console.log("  staff_category_id / staff_sub_category_id: left NULL");
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
