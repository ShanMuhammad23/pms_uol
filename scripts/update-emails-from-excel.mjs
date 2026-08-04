/**
 * Update user emails from an Excel sheet.
 *
 * Reads "SAP Code" and "Email ID" columns, finds users by employee_id (SAP),
 * and updates email with the Excel value.
 *
 * Usage:
 *   node scripts/update-emails-from-excel.mjs --file "path/to/file.xlsx"
 *   node scripts/update-emails-from-excel.mjs --file "path/to/file.xlsx" --dry-run
 *   node scripts/update-emails-from-excel.mjs --file "path/to/file.xlsx" --sheet "Sheet1"
 *
 * Options:
 *   --file <path>    Excel file path (required unless EXCEL_FILE env is set)
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

const SAP_HEADER_CANDIDATES = ["sap code", "sap", "employee id", "employee_id"];
const EMAIL_HEADER_CANDIDATES = [
  "email id",
  "email",
  "email address",
  "e-mail",
  "e-mail id",
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
    excelPath: process.env.EXCEL_FILE ? String(process.env.EXCEL_FILE) : null,
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

function normalizeHeader(value) {
  return normalizeText(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
  const emailKey = resolveColumnKey(headers, EMAIL_HEADER_CANDIDATES);

  if (!sapKey) {
    throw new Error(
      `Could not find a SAP Code column. Headers: ${headers.join(", ")}`,
    );
  }

  if (!emailKey) {
    throw new Error(
      `Could not find an Email ID column. Headers: ${headers.join(", ")}`,
    );
  }

  const entries = [];
  const seenSap = new Map();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const sapCode = normalizeText(row[sapKey]);
    const email = normalizeText(row[emailKey]).toLowerCase();
    const excelRow = index + 2;

    if (!sapCode && !email) {
      continue;
    }

    if (!sapCode) {
      entries.push({
        excelRow,
        sapCode: null,
        email,
        error: "Missing SAP Code",
      });
      continue;
    }

    if (!email) {
      entries.push({
        excelRow,
        sapCode,
        email: null,
        error: "Missing Email ID",
      });
      continue;
    }

    if (!isValidEmail(email)) {
      entries.push({
        excelRow,
        sapCode,
        email,
        error: "Invalid email format",
      });
      continue;
    }

    if (seenSap.has(sapCode)) {
      entries.push({
        excelRow,
        sapCode,
        email,
        error: `Duplicate SAP Code (also on row ${seenSap.get(sapCode)})`,
      });
      continue;
    }

    seenSap.set(sapCode, excelRow);
    entries.push({ excelRow, sapCode, email, error: null });
  }

  return {
    sheetName: targetSheetName,
    sapKey,
    emailKey,
    entries,
  };
}

async function main() {
  loadEnvFile();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`Update user emails from Excel (SAP Code + Email ID).

Usage:
  node scripts/update-emails-from-excel.mjs --file "path/to/file.xlsx"
  node scripts/update-emails-from-excel.mjs --file "path/to/file.xlsx" --dry-run
  node scripts/update-emails-from-excel.mjs --file "path/to/file.xlsx" --sheet "Sheet1"
`);
    return;
  }

  const excelPath = resolveExcelPath(args.excelPath);
  if (!excelPath) {
    throw new Error(
      "Provide an Excel path with --file <path> or EXCEL_FILE env var.",
    );
  }

  const { sheetName, sapKey, emailKey, entries } = readRowsFromExcel(
    excelPath,
    args.sheetName,
  );

  const validEntries = entries.filter((entry) => entry.error == null);
  const invalidEntries = entries.filter((entry) => entry.error != null);

  console.log(`File: ${excelPath}`);
  console.log(`Sheet: ${sheetName}`);
  console.log(`Columns: "${sapKey}" → employee_id, "${emailKey}" → email`);
  console.log(`Rows parsed: ${entries.length}`);
  console.log(`Valid rows: ${validEntries.length}`);
  console.log(`Invalid/skipped rows: ${invalidEntries.length}`);
  if (args.dryRun) {
    console.log("Mode: dry-run (no database writes)");
  }
  console.log("");

  for (const entry of invalidEntries) {
    console.warn(
      `  skip row ${entry.excelRow}: SAP=${entry.sapCode ?? "—"} email=${entry.email ?? "—"} (${entry.error})`,
    );
  }

  const pool = createPool();
  const client = await pool.connect();

  const summary = {
    updated: 0,
    unchanged: 0,
    notFound: 0,
    conflicts: 0,
    errors: 0,
  };

  try {
    if (!args.dryRun) {
      await client.query("BEGIN");
    }

    for (const entry of validEntries) {
      try {
        const existing = await client.query(
          `SELECT id, employee_id, email
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

        const user = existing.rows[0];
        const currentEmail = normalizeText(user.email).toLowerCase();

        if (currentEmail === entry.email) {
          summary.unchanged += 1;
          continue;
        }

        const conflict = await client.query(
          `SELECT id, employee_id
           FROM users
           WHERE lower(email) = lower($1)
             AND employee_id <> $2
           LIMIT 1`,
          [entry.email, entry.sapCode],
        );

        if (conflict.rows.length > 0) {
          summary.conflicts += 1;
          console.warn(
            `  conflict: SAP ${entry.sapCode} → ${entry.email} already used by SAP ${conflict.rows[0].employee_id}`,
          );
          continue;
        }

        if (args.dryRun) {
          summary.updated += 1;
          console.log(
            `  would update: SAP ${entry.sapCode} ${currentEmail} → ${entry.email}`,
          );
          continue;
        }

        await client.query(
          `UPDATE users
           SET email = $1
           WHERE employee_id = $2`,
          [entry.email, entry.sapCode],
        );

        summary.updated += 1;
        console.log(
          `  updated: SAP ${entry.sapCode} ${currentEmail} → ${entry.email}`,
        );
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
  console.log(`  updated:   ${summary.updated}`);
  console.log(`  unchanged: ${summary.unchanged}`);
  console.log(`  not found: ${summary.notFound}`);
  console.log(`  conflicts: ${summary.conflicts}`);
  console.log(`  errors:    ${summary.errors}`);
  console.log(`  skipped:   ${invalidEntries.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
