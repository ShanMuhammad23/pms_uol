import * as XLSX from "xlsx";
import {
  BULK_UPLOAD_SELECTABLE_COLUMNS,
  type BulkUploadColumnId,
} from "@/app/helpers/bulk-upload-columns";

const SAP_HEADER_ALIASES = new Set([
  "sap",
  "sap id",
  "sapid",
  "sap code",
  "sapcode",
  "sap_id",
  "employee id",
  "employeeid",
  "employee_id",
]);

const COLUMN_HEADER_ALIASES: Partial<
  Record<BulkUploadColumnId, readonly string[]>
> = {
  employeeName: ["name", "employee name", "staff name", "full name"],
  email: ["email", "email address", "e-mail", "e mail", "mail"],
  designation: ["designation", "job title", "position"],
  dateOfJoining: [
    "date of joining",
    "doj",
    "joining date",
    "join date",
    "date joined",
  ],
  qualification: ["qualification", "degree", "education"],
  qualificationSubject: ["subject", "major", "field", "specialization"],
  qualificationYear: ["year", "passing year", "graduation year"],
  qualificationInstitute: ["institute", "institution", "university", "college"],
  qualificationCountry: ["country"],
  creditHrsErpAdj: [
    "ch adjustment",
    "ch adj",
    "credit hours",
    "credit hrs",
    "ch",
  ],
  pubOricScoreAdj: ["oric adj", "oric adjustment", "oric"],
  qecScoreAdj: ["qec adjust", "qec adj", "qec adjustment", "qec"],
  currentSalary: ["current salary", "current sal", "salary", "basic salary"],
  previousSalary: [
    "prev salary",
    "previous salary",
    "last salary",
    "old salary",
  ],
  remarksCompensation: [
    "salary remarks",
    "remarks compensation",
    "compensation remarks",
    "remarks",
  ],
};

export type ExcelSheetColumn = {
  index: number;
  header: string;
  isSap: boolean;
};

export type ExcelStaffRow = {
  sap: string;
  values: string[];
};

export type ParsedExcelStaffSheet = {
  columns: ExcelSheetColumn[];
  sapColumnIndex: number;
  rows: ExcelStaffRow[];
};

export type ExcelColumnMapping = Record<number, BulkUploadColumnId | "">;

export function normalizeSapId(value: unknown): string {
  if (value == null) {
    return "";
  }
  let text = String(value).trim();
  if (text === "") {
    return "";
  }
  if (/^\d+\.0+$/.test(text)) {
    text = text.replace(/\.0+$/, "");
  }
  return text;
}

export function sapLookupKey(value: unknown): string {
  return normalizeSapId(value).toLowerCase();
}

export function normalizeExcelHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[:*]/g, "")
    .replace(/\s+/g, " ");
}

function findSapColumnIndex(headers: unknown[]): number {
  return headers.findIndex((header) =>
    SAP_HEADER_ALIASES.has(normalizeExcelHeader(header)),
  );
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

export function parseFlexibleDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }
    return null;
  }

  const dmy = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return null;
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function normalizeMappedExcelValue(
  columnId: BulkUploadColumnId,
  raw: string,
): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (columnId === "dateOfJoining") {
    return parseFlexibleDate(trimmed) ?? trimmed;
  }

  if (
    columnId === "qualificationYear" ||
    columnId === "creditHrsErpAdj" ||
    columnId === "pubOricScoreAdj" ||
    columnId === "qecScoreAdj" ||
    columnId === "currentSalary" ||
    columnId === "previousSalary"
  ) {
    return trimmed.replace(/,/g, "");
  }

  return trimmed;
}

export async function parseExcelStaffSheet(
  file: File,
): Promise<ParsedExcelStaffSheet> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The Excel file has no sheets.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
    sheet,
    {
      header: 1,
      raw: false,
      defval: "",
      dateNF: "yyyy-mm-dd",
    },
  );

  if (rows.length === 0) {
    throw new Error("The Excel file is empty.");
  }

  const headerRow = rows[0] ?? [];
  const sapColumnIndex = findSapColumnIndex(headerRow);
  if (sapColumnIndex < 0) {
    throw new Error(
      "A SAP column is required. Add a column named SAP, SAP ID, or SAP Code and try again.",
    );
  }

  const columnCount = Math.max(
    headerRow.length,
    ...rows.slice(1).map((row) => row.length),
  );
  const usedHeaders = new Map<string, number>();
  const columns: ExcelSheetColumn[] = [];
  for (let index = 0; index < columnCount; index += 1) {
    const rawHeader = cellToString(headerRow[index]);
    const base = rawHeader || `Column ${index + 1}`;
    const seen = usedHeaders.get(base) ?? 0;
    usedHeaders.set(base, seen + 1);
    columns.push({
      index,
      header: seen === 0 ? base : `${base} (${seen + 1})`,
      isSap: index === sapColumnIndex,
    });
  }

  const staffRows: ExcelStaffRow[] = [];
  const seenSaps = new Set<string>();
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const sap = normalizeSapId(row[sapColumnIndex]);
    if (!sap) continue;
    const key = sapLookupKey(sap);
    if (seenSaps.has(key)) continue;
    seenSaps.add(key);
    staffRows.push({
      sap,
      values: columns.map((column) => cellToString(row[column.index])),
    });
  }

  if (staffRows.length === 0) {
    throw new Error("No SAP IDs were found in the SAP column.");
  }

  return {
    columns,
    sapColumnIndex,
    rows: staffRows,
  };
}

export async function parseSapIdsFromExcelFile(file: File): Promise<string[]> {
  const parsed = await parseExcelStaffSheet(file);
  return parsed.rows.map((row) => row.sap);
}

export function suggestExcelColumnMapping(
  columns: ExcelSheetColumn[],
): ExcelColumnMapping {
  const mapping: ExcelColumnMapping = {};
  const usedTargets = new Set<BulkUploadColumnId>();

  for (const column of columns) {
    mapping[column.index] = "";
    if (column.isSap) continue;

    const header = normalizeExcelHeader(column.header.replace(/ \(\d+\)$/, ""));
    const match = BULK_UPLOAD_SELECTABLE_COLUMNS.find((target) => {
      if (usedTargets.has(target.id)) return false;
      const aliases = COLUMN_HEADER_ALIASES[target.id] ?? [];
      return (
        header === normalizeExcelHeader(target.label) ||
        aliases.includes(header)
      );
    });
    if (!match) continue;
    mapping[column.index] = match.id;
    usedTargets.add(match.id);
  }

  return mapping;
}
