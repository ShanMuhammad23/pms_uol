import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import pg from "pg";
import XLSX from "xlsx";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const DEFAULT_EXCEL_FILE =
  "Final File - Performance Portal as of 01.07.26.xlsx";
const DEFAULT_PASSWORD = "Employee@123";
const STAFF_CATEGORY_NAME = "Academic";
const SUB_CATEGORY_BY_ENUM = {
  FACULTY_MEMBER: "Faculty Member",
  HOD: "Head of Department",
  DEAN: "Dean",
};

function createPool() {
  return new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:uzair1321@127.0.0.1:5432/pms_uol",
  });
}

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

function parseArgs(argv) {
  const args = {
    dryRun: false,
    excelPath: join(rootDir, DEFAULT_EXCEL_FILE),
    skipHeadLinking: false,
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
    }
  }

  return args;
}

function readSql(fileName) {
  return readFileSync(join(__dirname, "sql", fileName), "utf8");
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function splitName(fullName) {
  const normalized = normalizeText(fullName);

  if (!normalized) {
    return { firstName: "Unknown", lastName: "Employee" };
  }

  const parts = normalized.split(" ");
  const firstName = parts[0];
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";

  return {
    firstName: firstName.slice(0, 50),
    lastName: lastName.slice(0, 50),
  };
}

function formatDateOfJoining(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const parsed = new Date(text);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function resolveRoles(additionalDesignation) {
  const label = normalizeText(additionalDesignation).toLowerCase();

  if (!label) {
    return {
      systemRole: "EMPLOYEE",
      empSubCategory: "FACULTY_MEMBER",
    };
  }

  if (/\bdean\b/.test(label)) {
    return {
      systemRole: "HEAD",
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
      systemRole: "HEAD",
      empSubCategory: "HOD",
    };
  }

  return {
    systemRole: "EMPLOYEE",
    empSubCategory: "FACULTY_MEMBER",
  };
}

function leadershipPriority(empSubCategory) {
  if (empSubCategory === "DEAN") {
    return 3;
  }

  if (empSubCategory === "HOD") {
    return 2;
  }

  return 0;
}

function readExcelRows(excelPath) {
  if (!existsSync(excelPath)) {
    throw new Error(`Excel file not found: ${excelPath}`);
  }

  const workbook = XLSX.readFile(excelPath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  return rawRows.map((row, index) => {
    const sapCode = normalizeText(row["SAP Code"]);
    const name = normalizeText(row.Name);
    const faculty = normalizeText(row.Faculty);
    const organizationalUnit = normalizeText(row["Organizational Unit"]);
    const designation = normalizeText(row.Designation);
    const additionalDesignation = normalizeText(row["Additional Designation"]);
    const dateOfJoining = formatDateOfJoining(row.DOJ);

    if (!sapCode) {
      throw new Error(`Row ${index + 2} is missing SAP Code.`);
    }

    if (!name) {
      throw new Error(`Row ${index + 2} (SAP ${sapCode}) is missing Name.`);
    }

    if (!faculty) {
      throw new Error(`Row ${index + 2} (SAP ${sapCode}) is missing Faculty.`);
    }

    if (!organizationalUnit) {
      throw new Error(
        `Row ${index + 2} (SAP ${sapCode}) is missing Organizational Unit.`,
      );
    }

    return {
      sapCode,
      name,
      faculty,
      organizationalUnit,
      designation: designation || null,
      additionalDesignation: additionalDesignation || null,
      dateOfJoining,
    };
  });
}

async function runMigrations(client) {
  const files = [
    "add-excel-sheet-columns.sql",
    "add-staff-categories.sql",
    "add-entity-org-structure.sql",
  ];

  for (const file of files) {
    await client.query(readSql(file));
    console.log(`Applied migration: ${file}`);
  }
}

async function ensureStaffCategories(client) {
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

async function findEntity(client, { name, categoryId, parentEntityId }) {
  const result = await client.query(
    `
      SELECT id
      FROM entities
      WHERE name = $1
        AND entity_category_id = $2
        AND (
          ($3::bigint IS NULL AND parent_entity_id IS NULL)
          OR parent_entity_id = $3
        )
      LIMIT 1
    `,
    [name, categoryId, parentEntityId],
  );

  return result.rows[0]?.id ?? null;
}

async function upsertEntity(client, { name, categoryId, parentEntityId }) {
  const existingId = await findEntity(client, {
    name,
    categoryId,
    parentEntityId,
  });

  if (existingId) {
    return existingId;
  }

  const result = await client.query(
    `
      INSERT INTO entities (name, entity_category_id, parent_entity_id)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [name, categoryId, parentEntityId],
  );

  return result.rows[0].id;
}

async function seedEntities(client, rows, categoryIds) {
  const c1ByName = new Map();
  const c2ByParentAndName = new Map();
  let c1Created = 0;
  let c2Created = 0;

  const faculties = [...new Set(rows.map((row) => row.faculty))].sort();

  for (const facultyName of faculties) {
    const before = await findEntity(client, {
      name: facultyName,
      categoryId: categoryIds.c1CategoryId,
      parentEntityId: null,
    });

    const entityId = await upsertEntity(client, {
      name: facultyName,
      categoryId: categoryIds.c1CategoryId,
      parentEntityId: null,
    });

    c1ByName.set(facultyName, entityId);

    if (!before) {
      c1Created += 1;
    }
  }

  const pairs = new Map();

  for (const row of rows) {
    pairs.set(`${row.faculty}::${row.organizationalUnit}`, {
      faculty: row.faculty,
      organizationalUnit: row.organizationalUnit,
    });
  }

  for (const { faculty, organizationalUnit } of pairs.values()) {
    const parentEntityId = c1ByName.get(faculty);

    if (!parentEntityId) {
      throw new Error(`Missing C1 entity for faculty "${faculty}".`);
    }

    const before = await findEntity(client, {
      name: organizationalUnit,
      categoryId: categoryIds.c2CategoryId,
      parentEntityId,
    });

    const entityId = await upsertEntity(client, {
      name: organizationalUnit,
      categoryId: categoryIds.c2CategoryId,
      parentEntityId,
    });

    c2ByParentAndName.set(`${parentEntityId}::${organizationalUnit}`, entityId);

    if (!before) {
      c2Created += 1;
    }
  }

  return {
    c1ByName,
    c2ByParentAndName,
    c1Created,
    c2Created,
  };
}

function resolveEntityId(row, entityMaps) {
  if (row.faculty === row.organizationalUnit) {
    return entityMaps.c1ByName.get(row.faculty) ?? null;
  }

  const parentEntityId = entityMaps.c1ByName.get(row.faculty);

  if (!parentEntityId) {
    return null;
  }

  return (
    entityMaps.c2ByParentAndName.get(
      `${parentEntityId}::${row.organizationalUnit}`,
    ) ?? null
  );
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
      RETURNING id, employee_id,
        (xmax = 0) AS inserted
    `,
    values,
  );

  return {
    id: result.rows[0].id,
    employeeId: result.rows[0].employee_id,
    inserted: result.rows[0].inserted,
  };
}

async function seedUsers(client, rows, entityMaps, staffConfig, passwordHash) {
  const hasStaffColumns =
    staffConfig.hasDynamicStaffColumns &&
    (await columnExists(client, "users", "staff_category_id")) &&
    (await columnExists(client, "users", "staff_sub_category_id"));
  const hasEntityColumn = await columnExists(client, "users", "entity_id");

  if (!hasEntityColumn) {
    throw new Error("users.entity_id column is missing. Run migrations first.");
  }

  let inserted = 0;
  let updated = 0;
  const seededUsers = [];

  for (const row of rows) {
    const entityId = resolveEntityId(row, entityMaps);

    if (!entityId) {
      throw new Error(
        `Could not resolve entity for SAP ${row.sapCode} (${row.faculty} / ${row.organizationalUnit}).`,
      );
    }

    const { firstName, lastName } = splitName(row.name);
    const roles = resolveRoles(row.additionalDesignation);
    const staffSubCategoryId = hasStaffColumns
      ? staffConfig.subCategoryIds.get(roles.empSubCategory)
      : null;

    const payload = {
      employeeId: row.sapCode,
      email: `${row.sapCode}@uol.edu.pk`.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      designation: row.designation,
      dateOfJoining: row.dateOfJoining,
      systemRole: roles.systemRole,
      empCategory: "ACADEMIC",
      empSubCategory: roles.empSubCategory,
      entityId,
      staffCategoryId: hasStaffColumns ? staffConfig.staffCategoryId : null,
      staffSubCategoryId,
    };

    const result = await upsertUser(client, payload);
    seededUsers.push({
      id: result.id,
      employeeId: result.employeeId,
      entityId,
      systemRole: roles.systemRole,
      empSubCategory: roles.empSubCategory,
    });

    if (result.inserted) {
      inserted += 1;
    } else {
      updated += 1;
    }
  }

  return { inserted, updated, seededUsers };
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
      .filter((user) => user.systemRole === "HEAD")
      .sort(
        (left, right) =>
          leadershipPriority(right.empSubCategory) -
          leadershipPriority(left.empSubCategory),
      );

    const head = leaders[0];

    if (!head) {
      continue;
    }

    for (const member of group) {
      if (member.id === head.id) {
        continue;
      }

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
  const pool = createPool();

  const args = parseArgs(process.argv.slice(2));

  if (!existsSync(args.excelPath)) {
    throw new Error(`Excel file not found: ${args.excelPath}`);
  }

  const rows = readExcelRows(args.excelPath);
  console.log(`Loaded ${rows.length} employee rows from Excel.`);

  if (args.dryRun) {
    const faculties = new Set(rows.map((row) => row.faculty));
    const orgUnits = new Set(
      rows.map((row) => `${row.faculty} -> ${row.organizationalUnit}`),
    );
    console.log(`Would seed ${faculties.size} C1 entities.`);
    console.log(`Would seed ${orgUnits.size} C2 entities.`);
    console.log(`Would upsert ${rows.length} users.`);
    return;
  }

  const client = await pool.connect();
  const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

  try {
    await client.query("BEGIN");

    await runMigrations(client);
    const staffConfig = await ensureStaffCategories(client);
    const categoryIds = await getCategoryIds(client);
    const entityMaps = await seedEntities(client, rows, categoryIds);
    const userStats = await seedUsers(
      client,
      rows,
      entityMaps,
      staffConfig,
      passwordHash,
    );

    let headsLinked = 0;

    if (!args.skipHeadLinking) {
      headsLinked = await linkReportingHeads(client, userStats.seededUsers);
    }

    await client.query("COMMIT");

    console.log("Employee seed completed.");
    console.log(`C1 entities created: ${entityMaps.c1Created}`);
    console.log(`C2 entities created: ${entityMaps.c2Created}`);
    console.log(`Users inserted: ${userStats.inserted}`);
    console.log(`Users updated: ${userStats.updated}`);
    console.log(`Reporting heads linked: ${headsLinked}`);
    console.log(`Default password for new users: ${DEFAULT_PASSWORD}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
