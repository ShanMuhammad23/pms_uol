import * as XLSX from "xlsx";

export type ExportColumnDef<T> = {
  id: string;
  label: string;
  getValue: (row: T) => string;
  width?: number;
};

export type ExportScope = "selected" | "filtered" | "all";

export type ExportOptions<T> = {
  columns: readonly ExportColumnDef<T>[];
  rows: T[];
  fileName: string;
  sheetName?: string;
};

function buildWorksheet<T>(
  columns: readonly ExportColumnDef<T>[],
  rows: T[],
): XLSX.WorkSheet {
  const header = columns.map((col) => col.label);
  const data = rows.map((row) => columns.map((col) => col.getValue(row)));
  const aoa = [header, ...data];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const colWidths = columns.map((col) => {
    const headerLen = col.label.length;
    let maxLen = headerLen;
    for (const row of rows) {
      const val = col.getValue(row);
      const len = val ? String(val).length : 0;
      if (len > maxLen) maxLen = len;
    }
  return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });
  ws["!cols"] = colWidths;

  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  (ws["!margins"] as unknown) = {
    left: 0.5,
    right: 0.5,
    top: 0.5,
    bottom: 0.5,
    header: 0.3,
    footer: 0.3,
  };

  return ws;
}

export function exportToExcel<T>(options: ExportOptions<T>): void {
  const { columns, rows, fileName, sheetName = "Export" } = options;

  if (columns.length === 0) {
    throw new Error("No columns selected for export.");
  }

  const ws = buildWorksheet(columns, rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const timestamp = new Date().toISOString().slice(0, 10);
  const fullFileName = `${fileName}_${timestamp}.xlsx`;
  XLSX.writeFile(wb, fullFileName, { compression: true });
}
