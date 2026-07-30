"use client";

import { Download } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ExportColumnSelectorModal } from "@/app/components/common/ExportColumnSelectorModal";
import {
  exportToExcel,
  type ExportColumnDef,
} from "@/app/helpers/excel-export-service";

interface ExcelExportButtonProps<T> {
  /** All columns available for export (already RBAC-filtered). */
  columns: readonly ExportColumnDef<T>[];
  /** All accessible rows (before selection/filtering — the full dataset the user can see). */
  allRows: T[];
  /** Filtered rows (after all filters are applied). */
  filteredRows: T[];
  /** Set of selected employee IDs (rows matching these are "selected"). */
  selectedEmployeeIds: Set<string>;
  /** Function to get the employee ID from a row, for matching selection. */
  getEmployeeId: (row: T) => string;
  /** Base file name (without extension). */
  fileName: string;
  /** Sheet name in the Excel file. */
  sheetName?: string;
  /** localStorage key for persisting column selection. */
  storageKey?: string;
  /** Whether to show the button. */
  visible?: boolean;
  /** Disabled state. */
  disabled?: boolean;
}

export function ExcelExportButton<T>({
  columns,
  allRows,
  filteredRows,
  selectedEmployeeIds,
  getEmployeeId,
  fileName,
  sheetName = "Export",
  storageKey,
  visible = true,
  disabled = false,
}: ExcelExportButtonProps<T>) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const hasSelection = selectedEmployeeIds.size > 0;

  const scopeLabel = hasSelection
    ? `${selectedEmployeeIds.size} selected record${selectedEmployeeIds.size !== 1 ? "s" : ""}`
    : filteredRows.length !== allRows.length
      ? `${filteredRows.length} filtered record${filteredRows.length !== 1 ? "s" : ""}`
      : `All ${allRows.length} record${allRows.length !== 1 ? "s" : ""}`;

  const rowsToExport = useMemo(() => {
    if (hasSelection) {
      const idSet = selectedEmployeeIds;
      return filteredRows.filter((row) => idSet.has(getEmployeeId(row)));
    }
    return filteredRows;
  }, [hasSelection, selectedEmployeeIds, filteredRows, getEmployeeId]);

  const recordCount = rowsToExport.length;

  const handleExport = useCallback(
    (selectedColumns: ExportColumnDef<T>[]) => {
      setIsExporting(true);
      try {
        exportToExcel({
          columns: selectedColumns,
          rows: rowsToExport,
          fileName,
          sheetName,
        });
      } catch {
        // ignore — user sees the modal close
      } finally {
        setIsExporting(false);
        setModalOpen(false);
      }
    },
    [rowsToExport, fileName, sheetName],
  );

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        disabled={disabled || columns.length === 0}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5"
        title="Export to Excel"
      >
        <Download className="h-3.5 w-3.5" />
        Excel Export
      </button>

      <ExportColumnSelectorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        columns={columns}
        onExport={handleExport}
        recordCount={recordCount}
        scopeLabel={scopeLabel}
        storageKey={storageKey}
        isExporting={isExporting}
      />
    </>
  );
}
