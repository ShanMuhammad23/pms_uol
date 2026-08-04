/**
 * Seed employee qualifications from an Excel sheet.
 *
 * Finds users by SAP Code (users.employee_id) and upserts the primary row in
 * employee_qualifications from:
 *   Terminal Degree → qualification
 *   Year of Comp.   → year
 *   Specialization  → subject
 *   Institution     → institute
 *   Country         → country
 *
 * Usage:
 *   node scripts/seed-qualifications-from-excel.mjs
 *   node scripts/seed-qualifications-from-excel.mjs --file "path/to/file.xlsx"
 *   node scripts/seed-qualifications-from-excel.mjs --file "path/to/file.xlsx" --dry-run
 *   node scripts/seed-qualifications-from-excel.mjs --file "path/to/file.xlsx" --sheet "Acad. Staff"
 *
 * Options:
 *   --file <path>    Excel file path (default: public Academic Staff sheet)
 *   --sheet <name>   Sheet name (default: first sheet)
 *   --dry-run        Report changes without writing to the database
 */

import { existsSync, readFileSync } from "fs";
import { dirname, isAbsolute, join, resolve } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import XLSX from "xlsx";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const DEFAULT_EXCEL_FILE = join(
  rootDir,
  "public",
  "Academic Staff - Performance Portal Data with Education & Email 21.07.26.xlsx",
);

const SAP_HEADER_CANDIDATES = ["sap code", "sap", "employee id", "employee_id"];
const QUALIFICATION_HEADER_CANDIDATES = [
  "terminal degree",
  "qualification",
  "degree",
];
const YEAR_HEADER_CANDIDATES = [
  "year of comp.",
  "year of completion",
  "year of comp",
  "year",
];
const SUBJECT_HEADER_CANDIDATES = [
  "specialization",
  "subject",
  "major",
];
const INSTITUTE_HEADER_CANDIDATES = [
  "institution",
  "institute",
  "university",
];
const COUNTRY_HEADER_CANDIDATES = ["country"];

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
    sheetName: null,
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

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }

  return args;
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeOptionalText(value) {
  const text = normalizeText(value);
  if (!text || text === "-" || text.toLowerCase() === "n/a") {
    return null;
  }
  return text;
}

function normalizeHeader(value) {
  return normalizeText(value).toLowerCase();
}

function parseYear(value) {
  const text = normalizeOptionalText(value);
  if (!text) {
    return { year: null };
  }

  // Prefer a single year; if multiple (e.g. "2012 2023"), use the latest.
  const years = [...text.matchAll(/\b((?:19|20)\d{2})\b/g)].map((match) =>
    Number(match[1]),
  );

  if (years.length === 0) {
    return { error: `Invalid year "${text}"` };
  }

  return { year: Math.max(...years) };
}

function resolveColumnKey(headers, candidates) {
  const normalized = headers.map((header) => ({
    original: header,
    key: normalizeHeader(header),
  }));

  for (const candidate of candidates) {
    const exact = normalized.find((header) => header.key === candidate);
    if (exact) {
      return exact.original;
    }
  }

  for (const candidate of candidates) {
    const partial = normalized.find((header) => header.key.includes(candidate));
    if (partial) {
      return partial.original;
    }
  }

  return null;
}

function resolveExcelPath(pathValue) {
  if (!pathValue) {
    return null;
  }

  return isAbsolute(pathValue) ? pathValue : resolve(rootDir, pathValue);
}

function truncate(value, maxLength) {
  if (value == null) {
    return null;
  }
  return value.length > maxLength ? value.slice(0, maxLength) : value;
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
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    throw new Error(`Sheet "${targetSheetName}" has no data rows.`);
  }

  const headers = Object.keys(rows[0] ?? {});
  const sapKey = resolveColumnKey(headers, SAP_HEADER_CANDIDATES);
  const qualificationKey = resolveColumnKey(
    headers,
    QUALIFICATION_HEADER_CANDIDATES,
  );
  const yearKey = resolveColumnKey(headers, YEAR_HEADER_CANDIDATES);
  const subjectKey = resolveColumnKey(headers, SUBJECT_HEADER_CANDIDATES);
  const instituteKey = resolveColumnKey(headers, INSTITUTE_HEADER_CANDIDATES);
  const countryKey = resolveColumnKey(headers, COUNTRY_HEADER_CANDIDATES);

  if (!sapKey) {
    throw new Error(
      `Could not find a SAP Code column. Headers: ${headers.join(", ")}`,
    );
  }

  if (!qualificationKey) {
    throw new Error(
      `Could not find a Terminal Degree / Qualification column. Headers: ${headers.join(", ")}`,
    );
  }

  const keys = {
    sapKey,
    qualificationKey,
    yearKey,
    subjectKey,
    instituteKey,
    countryKey,
  };

  const entries = [];
  const seenSap = new Map();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const excelRow = index + 2;
    const sapCode = normalizeText(row[sapKey]);
    const qualification = normalizeOptionalText(row[qualificationKey]);
    const yearResult = yearKey ? parseYear(row[yearKey]) : { year: null };
    const subject = subjectKey
      ? truncate(normalizeOptionalText(row[subjectKey]), 255)
      : null;
    const institute = instituteKey
      ? truncate(normalizeOptionalText(row[instituteKey]), 255)
      : null;
    const country = countryKey
      ? truncate(normalizeOptionalText(row[countryKey]), 100)
      : null;

    if (
      !sapCode &&
      !qualification &&
      yearResult?.year == null &&
      !subject &&
      !institute &&
      !country
    ) {
      continue;
    }

    if (!sapCode) {
      entries.push({
        excelRow,
        sapCode: null,
        qualification,
        year: yearResult?.year ?? null,
        subject,
        institute,
        country,
        error: "Missing SAP Code",
      });
      continue;
    }

    if (!qualification) {
      entries.push({
        excelRow,
        sapCode,
        qualification: null,
        year: yearResult?.year ?? null,
        subject,
        institute,
        country,
        error: "Missing Terminal Degree",
      });
      continue;
    }

    if (yearResult?.error) {
      entries.push({
        excelRow,
        sapCode,
        qualification,
        year: null,
        subject,
        institute,
        country,
        error: yearResult.error,
      });
      continue;
    }

    if (seenSap.has(sapCode)) {
      entries.push({
        excelRow,
        sapCode,
        qualification,
        year: yearResult?.year ?? null,
        subject,
        institute,
        country,
        error: `Duplicate SAP Code (also on row ${seenSap.get(sapCode)})`,
      });
      continue;
    }

    seenSap.set(sapCode, excelRow);
    entries.push({
      excelRow,
      sapCode,
      qualification: truncate(qualification, 255),
      year: yearResult?.year ?? null,
      subject,
      institute,
      country,
      error: null,
    });
  }

  return {
    sheetName: targetSheetName,
    keys,
    entries,
  };
}

function sameQualification(existing, entry) {
  return (
    normalizeText(existing.qualification) ===
      normalizeText(entry.qualification) &&
    (existing.year == null ? null : Number(existing.year)) === entry.year &&
    normalizeText(existing.subject) === normalizeText(entry.subject) &&
    normalizeText(existing.institute) === normalizeText(entry.institute) &&
    normalizeText(existing.country) === normalizeText(entry.country)
  );
}

async function ensureQualificationsTable(client) {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = 'employee_qualifications'
     ) AS exists`,
  );

  if (!result.rows[0]?.exists) {
    throw new Error(
      'Table "employee_qualifications" does not exist. Run: npm run db:migrate:excel-sheet-columns',
    );
  }
}

async function upsertPrimaryQualification(client, userId, entry) {
  const existing = await client.query(
    `SELECT id, qualification, year, subject, institute, country
     FROM employee_qualifications
     WHERE user_id = $1
     ORDER BY is_primary DESC, year DESC NULLS LAST, id DESC
     LIMIT 1`,
    [userId],
  );

  if (existing.rows[0]) {
    if (sameQualification(existing.rows[0], entry)) {
      return "unchanged";
    }

    await client.query(
      `UPDATE employee_qualifications
       SET qualification = $2,
           year = $3,
           subject = $4,
           institute = $5,
           country = $6,
           is_primary = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [
        existing.rows[0].id,
        entry.qualification,
        entry.year,
        entry.subject,
        entry.institute,
        entry.country,
      ],
    );
    return "updated";
  }

  await client.query(
    `INSERT INTO employee_qualifications (
       user_id,
       qualification,
       year,
       subject,
       institute,
       country,
       is_primary
     ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
    [
      userId,
      entry.qualification,
      entry.year,
      entry.subject,
      entry.institute,
      entry.country,
    ],
  );
  return "inserted";
}

async function main() {
  loadEnvFile();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`Seed employee qualifications from Excel (SAP Code + education columns).

Usage:
  node scripts/seed-qualifications-from-excel.mjs
  node scripts/seed-qualifications-from-excel.mjs --file "path/to/file.xlsx"
  node scripts/seed-qualifications-from-excel.mjs --file "path/to/file.xlsx" --dry-run
  node scripts/seed-qualifications-from-excel.mjs --file "path/to/file.xlsx" --sheet "Acad. Staff"
`);
    return;
  }

  const excelPath = resolveExcelPath(args.excelPath);
  if (!excelPath) {
    throw new Error(
      "Provide an Excel path with --file <path> or EXCEL_FILE env var.",
    );
  }

  const { sheetName, keys, entries } = readRowsFromExcel(
    excelPath,
    args.sheetName,
  );

  const validEntries = entries.filter((entry) => entry.error == null);
  const invalidEntries = entries.filter((entry) => entry.error != null);

  console.log(`File: ${excelPath}`);
  console.log(`Sheet: ${sheetName}`);
  console.log(
    `Columns: "${keys.sapKey}" → employee_id, "${keys.qualificationKey}" → qualification` +
      (keys.yearKey ? `, "${keys.yearKey}" → year` : "") +
      (keys.subjectKey ? `, "${keys.subjectKey}" → subject` : "") +
      (keys.instituteKey ? `, "${keys.instituteKey}" → institute` : "") +
      (keys.countryKey ? `, "${keys.countryKey}" → country` : ""),
  );
  console.log(`Rows parsed: ${entries.length}`);
  console.log(`Valid rows: ${validEntries.length}`);
  console.log(`Invalid/skipped rows: ${invalidEntries.length}`);
  if (args.dryRun) {
    console.log("Mode: dry-run (no database writes)");
  }
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
    unchanged: 0,
    notFound: 0,
    errors: 0,
  };

  try {
    await ensureQualificationsTable(client);

    if (!args.dryRun) {
      await client.query("BEGIN");
    }

    for (const entry of validEntries) {
      try {
        const existing = await client.query(
          `SELECT id, employee_id
           FROM users
           WHERE employee_id = $1
           LIMIT 1`,
          [entry.sapCode],
        );

        if (existing.rows.length === 0) {
          summary.notFound += 1;
          console.warn(
            `  not found: SAP ${entry.sapCode} (Excel row ${entry.excelRow})`,
          );
          continue;
        }

        const userId = existing.rows[0].id;

        if (args.dryRun) {
          const current = await client.query(
            `SELECT qualification, year, subject, institute, country
             FROM employee_qualifications
             WHERE user_id = $1
             ORDER BY is_primary DESC, year DESC NULLS LAST, id DESC
             LIMIT 1`,
            [userId],
          );

          if (current.rows[0] && sameQualification(current.rows[0], entry)) {
            summary.unchanged += 1;
            continue;
          }

          const action = current.rows[0] ? "would update" : "would insert";
          summary[current.rows[0] ? "updated" : "inserted"] += 1;
          console.log(
            `  ${action}: SAP ${entry.sapCode} → ${entry.qualification}` +
              (entry.year != null ? ` (${entry.year})` : "") +
              (entry.subject ? `, ${entry.subject}` : ""),
          );
          continue;
        }

        const action = await upsertPrimaryQualification(client, userId, entry);
        summary[action] += 1;

        if (action !== "unchanged") {
          console.log(
            `  ${action}: SAP ${entry.sapCode} → ${entry.qualification}` +
              (entry.year != null ? ` (${entry.year})` : "") +
              (entry.subject ? `, ${entry.subject}` : ""),
          );
        }
      } catch (error) {
        summary.errors += 1;
        console.error(
          `  error: SAP ${entry.sapCode} (Excel row ${entry.excelRow}):`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    if (!args.dryRun) {
      await client.query("COMMIT");
    }
  } catch (error) {
    if (!args.dryRun) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log("");
  console.log("Summary");
  console.log(`  inserted:  ${summary.inserted}`);
  console.log(`  updated:   ${summary.updated}`);
  console.log(`  unchanged: ${summary.unchanged}`);
  console.log(`  not found: ${summary.notFound}`);
  console.log(`  errors:    ${summary.errors}`);
  console.log(`  skipped:   ${invalidEntries.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
