/**
 * Seed Sargodha academic faculty from Excel.
 *
 * Hierarchy (fixed):
 *   C0 Academic (SGD) → C1 Faculty Sargodha (default parent id 223)
 *     → C2 departments from Excel "Department" (campus_id default 2)
 *
 * Maps:
 *   SAP Code         → users.employee_id
 *   Employee Name    → first_name / last_name
 *   Email ID         → email (fallback: {sap}@uol.edu.pk)
 *   Joining Date     → date_of_joining
 *   Designation      → designation + role inference (Dean/HOD/Director/Principal)
 *   Department       → C2 entity under --parent (default 223)
 *
 * Usage:
 *   node scripts/seed-sargodha-faculty-from-excel.mjs --dry-run
 *   node scripts/seed-sargodha-faculty-from-excel.mjs
 *   node scripts/seed-sargodha-faculty-from-excel.mjs --file "SRG - Faculty PMS Data 2025-26.xlsx"
 *   node scripts/seed-sargodha-faculty-from-excel.mjs --parent 223 --campus 2
 *   node scripts/seed-sargodha-faculty-from-excel.mjs --skip-head-linking
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
  "SRG - Faculty PMS Data 2025-26.xlsx",
);
const DEFAULT_SHEET_NAME = "Acad. Staff";
const DEFAULT_PARENT_ENTITY_ID = 223;
const DEFAULT_CAMPUS_ID = 2;
const DEFAULT_PASSWORD = "Employee@123";
const STAFF_CATEGORY_NAME = "Academic";
const SUB_CATEGORY_BY_ENUM = {
  FACULTY_MEMBER: "Faculty Member",
  HOD: "Head of Department",
  DEAN: "Dean",
};

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
    skipHeadLinking: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--skip-head-linking") {
      args.skipHeadLinking = true;
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
  // Excel serial date (days since 1899-12-30), UTC midnight.
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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function resolveRoles(designation) {
  const label = normalizeText(designation).toLowerCase();

  if (!label) {
    return {
      systemRole: "EMPLOYEE",
      empSubCategory: "FACULTY_MEMBER",
    };
  }

  // user_role enum has no HEAD — managers use MANAGER + emp_sub_category.
  if (/\bdean\b/.test(label) || /\bpro\s*rector\b/.test(label)) {
    return {
      systemRole: "MANAGER",
      empSubCategory: "DEAN",
    };
  }

  if (
    /\bhod\b/.test(label) ||
    /head of department/.test(label) ||
    /\bprincipal\b/.test(label) ||
    /\bdirector\b/.test(label)
  ) {
    return {
      systemRole: "MANAGER",
      empSubCategory: "HOD",
    };
  }

  return {
    systemRole: "EMPLOYEE",
    empSubCategory: "FACULTY_MEMBER",
  };
}

function leadershipPriority(empSubCategory) {
  if (empSubCategory === "DEAN") return 3;
  if (empSubCategory === "HOD") return 2;
  return 0;
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
  const seenEmail = new Map();

  for (let index = 0; index < rawRows.length; index += 1) {
    const row = rawRows[index];
    const excelRow = index + 2;
    const sapCode = normalizeText(row["SAP Code"]);
    const name = normalizeText(row["Employee Name"] ?? row.Name);
    const department = normalizeText(row.Department);
    const designation = normalizeText(row.Designation) || null;
    const rawEmail = normalizeText(row["Email ID"] ?? row["Email IDs"]).toLowerCase();
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

    let email = rawEmail;
    if (!email || !isValidEmail(email) || email.includes("no official email")) {
      email = `${sapCode}@uol.edu.pk`.toLowerCase();
    }

    if (seenEmail.has(email)) {
      entries.push({
        excelRow,
        sapCode,
        email,
        error: `Duplicate email (also on row ${seenEmail.get(email)})`,
      });
      continue;
    }

    seenSap.set(sapCode, excelRow);
    seenEmail.set(email, excelRow);

    const { firstName, lastName } = splitName(name);
    const roles = resolveRoles(designation);

    entries.push({
      excelRow,
      sapCode,
      name,
      firstName,
      lastName,
      department,
      designation,
      email,
      dateOfJoining,
      systemRole: roles.systemRole,
      empSubCategory: roles.empSubCategory,
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
  const campusSelect = hasCampusColumn ? ", e.campus_id" : ", NULL::int AS campus_id";
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

async function ensureStaffCategories(client) {
  const hasStaffCategory = await columnExists(client, "users", "staff_category_id");
  const hasStaffSubCategory = await columnExists(
    client,
    "users",
    "staff_sub_category_id",
  );

  if (!hasStaffCategory || !hasStaffSubCategory) {
    return {
      staffCategoryId: null,
      subCategoryIds: new Map(),
      hasDynamicStaffColumns: false,
    };
  }

  const categoryResult = await client.query(
    `INSERT INTO staff_categories (name)
     VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [STAFF_CATEGORY_NAME],
  );

  const staffCategoryId = categoryResult.rows[0].id;
  const subCategoryIds = new Map();

  for (const [enumValue, label] of Object.entries(SUB_CATEGORY_BY_ENUM)) {
    const result = await client.query(
      `INSERT INTO staff_sub_categories (name, staff_category_id)
       VALUES ($1, $2)
       ON CONFLICT (staff_category_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [label, staffCategoryId],
    );
    subCategoryIds.set(enumValue, result.rows[0].id);
  }

  return {
    staffCategoryId,
    subCategoryIds,
    hasDynamicStaffColumns: true,
  };
}

async function upsertC2UnderParent(
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
  { c2CategoryId, parentEntityId, parentName, campusId, hasCampusColumn, dryRun },
) {
  const resolved = new Map();
  let matchedExisting = 0;
  let createdC2 = 0;
  let wouldCreate = 0;

  for (const department of departments) {
    const existing = await client.query(
      `
        SELECT id, name
        FROM entities
        WHERE entity_category_id = $1
          AND parent_entity_id = $2
          AND lower(name) = lower($3)
        LIMIT 1
      `,
      [c2CategoryId, parentEntityId, department],
    );

    if (existing.rows[0]) {
      matchedExisting += 1;
      resolved.set(department, {
        entityId: existing.rows[0].id,
        source: "existing",
        matchedName: existing.rows[0].name,
      });
      continue;
    }

    if (dryRun) {
      wouldCreate += 1;
      resolved.set(department, {
        entityId: null,
        source: "would-create-c2",
        matchedName: department,
      });
      continue;
    }

    const created = await upsertC2UnderParent(client, {
      name: department,
      c2CategoryId,
      parentEntityId,
      campusId,
      hasCampusColumn,
    });

    if (created.created) createdC2 += 1;
    resolved.set(department, {
      entityId: created.id,
      source: created.created ? "created-c2" : "existing",
      matchedName: department,
    });
  }

  return {
    resolved,
    summary: { matchedExisting, createdC2, wouldCreate },
    parentName,
  };
}

async function upsertUser(client, payload) {
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

  if (payload.staffCategoryId && payload.staffSubCategoryId) {
    columns.push("staff_category_id", "staff_sub_category_id");
    values.push(payload.staffCategoryId, payload.staffSubCategoryId);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const updates = columns
    .filter((column) => column !== "employee_id" && column !== "password_hash")
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

async function linkReportingHeads(client, seededUsers) {
  const usersByEntity = new Map();

  for (const user of seededUsers) {
    const group = usersByEntity.get(user.entityId) ?? [];
    group.push(user);
    usersByEntity.set(user.entityId, group);
  }

  let linked = 0;

  for (const group of usersByEntity.values()) {
    const leaders = group
      .filter(
        (user) =>
          user.systemRole === "MANAGER" &&
          (user.empSubCategory === "HOD" || user.empSubCategory === "DEAN"),
      )
      .sort(
        (left, right) =>
          leadershipPriority(right.empSubCategory) -
          leadershipPriority(left.empSubCategory),
      );

    const head = leaders[0];
    if (!head) continue;

    for (const member of group) {
      if (member.id === head.id) continue;
      await client.query(`UPDATE users SET head_id = $1 WHERE id = $2`, [
        head.id,
        member.id,
      ]);
      linked += 1;
    }
  }

  return linked;
}

async function main() {
  loadEnvFile();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`Seed Sargodha faculty from Excel under a fixed C1 parent.

Usage:
  node scripts/seed-sargodha-faculty-from-excel.mjs --dry-run
  node scripts/seed-sargodha-faculty-from-excel.mjs
  node scripts/seed-sargodha-faculty-from-excel.mjs --file "SRG - Faculty PMS Data 2025-26.xlsx"
  node scripts/seed-sargodha-faculty-from-excel.mjs --parent 223 --campus 2
  node scripts/seed-sargodha-faculty-from-excel.mjs --skip-head-linking

Defaults:
  file    ${DEFAULT_EXCEL_FILE}
  sheet   ${DEFAULT_SHEET_NAME}
  parent  ${DEFAULT_PARENT_ENTITY_ID} (Faculty Sargodha)
  campus  ${DEFAULT_CAMPUS_ID} (Sargodha)
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
    headsLinked: 0,
  };

  try {
    const hasEntityColumn = await columnExists(client, "users", "entity_id");
    if (!hasEntityColumn) {
      throw new Error("users.entity_id is missing. Run entity migrations first.");
    }

    const hasCampusColumn = await columnExists(client, "entities", "campus_id");
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

    if (
      hasCampusColumn &&
      parent.campus_id != null &&
      Number(parent.campus_id) !== args.campusId
    ) {
      console.warn(
        `Warning: parent campus_id=${parent.campus_id} differs from --campus ${args.campusId}.`,
      );
    }

    console.log(
      `Parent: ${parent.category} "${parent.name}" (id ${parent.id})` +
        (parent.campus_id != null ? `, campus_id=${parent.campus_id}` : ""),
    );
    console.log("");

    if (!args.dryRun) {
      await client.query("BEGIN");
    }

    const staffConfig = args.dryRun
      ? {
          staffCategoryId: null,
          subCategoryIds: new Map(),
          hasDynamicStaffColumns: false,
        }
      : await ensureStaffCategories(client);

    const entityResolution = await resolveDepartmentEntities(client, departments, {
      c2CategoryId,
      parentEntityId: args.parentEntityId,
      parentName: parent.name,
      campusId: args.campusId,
      hasCampusColumn,
      dryRun: args.dryRun,
    });

    console.log("Department → C2 resolution");
    console.log(`  matched existing: ${entityResolution.summary.matchedExisting}`);
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
          `  match: "${department}" → C2 "${info.matchedName}" under "${parent.name}"`,
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
      const managers = validEntries.filter(
        (e) => e.systemRole === "MANAGER",
      ).length;
      console.log(
        `Would upsert ${validEntries.length} users (${managers} MANAGER roles).`,
      );
      console.log("Then optionally:");
      console.log(
        `  npm run db:seed:qualifications -- --file "SRG - Faculty PMS Data 2025-26.xlsx" --sheet "Acad. Staff"`,
      );
      return;
    }

    const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
    const seededUsers = [];

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

        const staffSubCategoryId = staffConfig.hasDynamicStaffColumns
          ? staffConfig.subCategoryIds.get(entry.empSubCategory)
          : null;

        const result = await upsertUser(client, {
          employeeId: entry.sapCode,
          email: entry.email,
          passwordHash,
          firstName: entry.firstName,
          lastName: entry.lastName,
          designation: entry.designation,
          dateOfJoining: entry.dateOfJoining,
          systemRole: entry.systemRole,
          empCategory: "ACADEMIC",
          empSubCategory: entry.empSubCategory,
          entityId: entityInfo.entityId,
          staffCategoryId: staffConfig.hasDynamicStaffColumns
            ? staffConfig.staffCategoryId
            : null,
          staffSubCategoryId,
        });

        await client.query(`RELEASE SAVEPOINT ${savepoint}`);

        seededUsers.push({
          id: result.id,
          employeeId: result.employeeId,
          entityId: entityInfo.entityId,
          systemRole: entry.systemRole,
          empSubCategory: entry.empSubCategory,
        });

        if (result.inserted) {
          summary.inserted += 1;
          console.log(
            `  inserted: SAP ${entry.sapCode} → ${entityInfo.matchedName} (${entry.systemRole}/${entry.empSubCategory})`,
          );
        } else {
          summary.updated += 1;
          console.log(
            `  updated: SAP ${entry.sapCode} → ${entityInfo.matchedName} (${entry.systemRole}/${entry.empSubCategory})`,
          );
        }
      } catch (error) {
        try {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        } catch {
          // Transaction already unusable; outer handler will roll back.
        }
        summary.errors += 1;
        console.error(
          `  error: SAP ${entry.sapCode} (Excel row ${entry.excelRow}):`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    if (!args.skipHeadLinking) {
      summary.headsLinked = await linkReportingHeads(client, seededUsers);
    }

    await client.query("COMMIT");

    console.log("");
    console.log("Summary");
    console.log(`  C2 matched:  ${entityResolution.summary.matchedExisting}`);
    console.log(`  C2 created:  ${entityResolution.summary.createdC2}`);
    console.log(`  inserted:    ${summary.inserted}`);
    console.log(`  updated:     ${summary.updated}`);
    console.log(`  errors:      ${summary.errors}`);
    console.log(`  skipped:     ${invalidEntries.length}`);
    console.log(`  heads linked:${summary.headsLinked}`);
    console.log(`  default password (new users): ${DEFAULT_PASSWORD}`);
    console.log("");
    console.log("Next (qualifications):");
    console.log(
      `  npm run db:seed:qualifications -- --file "SRG - Faculty PMS Data 2025-26.xlsx" --sheet "Acad. Staff"`,
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
