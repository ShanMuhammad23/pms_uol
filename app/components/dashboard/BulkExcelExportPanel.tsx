"use client";

import {
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  applyDashboardExportToWorkbook,
  buildFilledExportFileName,
  downloadWorkbook,
  EXPORT_INSERT_AS_NEW,
  parseExcelWorkbook,
  sapLookupKey,
  suggestExportColumnMapping,
  type ExportColumnMapping,
  type ExportColumnTarget,
  type ParsedExcelWorkbook,
} from "@/app/helpers/bulk-upload-excel";
import {
  DASHBOARD_COLUMN_SECTIONS,
  DASHBOARD_TABLE_COLUMNS,
  type DashboardTableColumnId,
} from "@/app/helpers/dashboard-table-columns";
import type { DashboardFilterParams } from "@/types/dashboard-api";
import type { MasterFilterState } from "@/app/helpers/dashboard-master-filters";
import { emptyDashboardFilterParams } from "@/lib/dashboard/filter-params";
import { EMPTY_MASTER_FILTER_STATE } from "@/app/helpers/dashboard-master-filters";
import { fetchFormSubmissionsPage } from "@/lib/queries/form-submissions-client";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { cn } from "@/lib/utils";

const EMPTY_SUBMISSIONS: FormSubmissionListItem[] = [];

const EXPORTABLE_COLUMNS = DASHBOARD_TABLE_COLUMNS.filter(
  (column) => column.id !== "sapCode",
);

interface BulkExcelExportPanelProps {
  filterParams: DashboardFilterParams;
  masterFilters: MasterFilterState;
  onError: (message: string | null) => void;
}

export function BulkExcelExportPanel({
  filterParams: _filterParams,
  masterFilters: _masterFilters,
  onError,
}: BulkExcelExportPanelProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [workbookData, setWorkbookData] = useState<ParsedExcelWorkbook | null>(
    null,
  );
  const [mapping, setMapping] = useState<ExportColumnMapping>({});
  const [selectedColumnIds, setSelectedColumnIds] = useState<
    Set<DashboardTableColumnId>
  >(() => new Set(EXPORTABLE_COLUMNS.map((column) => column.id)));
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resultSummary, setResultSummary] = useState<string | null>(null);

  // Match against the full active staff listing (not the current dashboard
  // filters). The sheet defines who to fill; any PMS employee should match.
  const { data: pageData, isLoading: employeesLoading } = useQuery({
    queryKey: ["bulk-excel-export-staff-all"],
    queryFn: () =>
      fetchFormSubmissionsPage({
        page: 1,
        pageSize: 100000,
        filters: emptyDashboardFilterParams(),
        masterFilters: EMPTY_MASTER_FILTER_STATE,
      }),
  });

  const employees = pageData?.items ?? EMPTY_SUBMISSIONS;

  const employeesBySap = useMemo(() => {
    const map = new Map<string, FormSubmissionListItem>();
    for (const employee of employees) {
      const key = sapLookupKey(employee.employeeId);
      if (!key || map.has(key)) continue;
      map.set(key, employee);
    }
    return map;
  }, [employees]);

  const matchStats = useMemo(() => {
    if (!workbookData) {
      return { matched: 0, unmatched: 0, unmatchedSaps: [] as string[] };
    }
    let matched = 0;
    const unmatchedSaps: string[] = [];
    for (const row of workbookData.rows) {
      if (employeesBySap.has(sapLookupKey(row.sap))) {
        matched += 1;
      } else {
        unmatchedSaps.push(row.sap);
      }
    }
    return { matched, unmatched: unmatchedSaps.length, unmatchedSaps };
  }, [workbookData, employeesBySap]);

  const selectedColumns = useMemo(
    () => EXPORTABLE_COLUMNS.filter((column) => selectedColumnIds.has(column.id)),
    [selectedColumnIds],
  );

  const mappedCount = useMemo(
    () =>
      selectedColumns.filter((column) => {
        const target = mapping[column.id];
        return target === EXPORT_INSERT_AS_NEW || (target !== "" && target != null);
      }).length,
    [selectedColumns, mapping],
  );

  const insertedCount = useMemo(
    () =>
      selectedColumns.filter(
        (column) => mapping[column.id] === EXPORT_INSERT_AS_NEW,
      ).length,
    [selectedColumns, mapping],
  );

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setParsing(true);
    setResultSummary(null);
    onError(null);
    try {
      const parsed = await parseExcelWorkbook(file);
      const nextMapping = suggestExportColumnMapping(
        parsed.columns,
        EXPORTABLE_COLUMNS,
      );
      setWorkbookData(parsed);
      setMapping(nextMapping);
      setFileName(file.name);
      setSelectedColumnIds(new Set(EXPORTABLE_COLUMNS.map((column) => column.id)));
    } catch (error) {
      setWorkbookData(null);
      setMapping({});
      setFileName(null);
      onError(
        error instanceof Error
          ? error.message
          : "Could not read the Excel file.",
      );
    } finally {
      setParsing(false);
    }
  };

  const toggleColumn = (id: DashboardTableColumnId) => {
    setSelectedColumnIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setMapping((current) => ({ ...current, [id]: "" }));
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const setColumnTarget = (
    columnId: DashboardTableColumnId,
    target: ExportColumnTarget,
  ) => {
    setMapping((prev) => {
      const next: ExportColumnMapping = { ...prev };
      if (typeof target === "number") {
        for (const [id, value] of Object.entries(next)) {
          if (id !== columnId && value === target) {
            next[id] = "";
          }
        }
      }
      next[columnId] = target;
      return next;
    });
  };

  const handleDownload = () => {
    if (!workbookData || mappedCount === 0) return;
    setExporting(true);
    setResultSummary(null);
    onError(null);
    try {
      const activeMapping: ExportColumnMapping = {};
      for (const column of selectedColumns) {
        const target = mapping[column.id];
        if (target === "" || target == null) continue;
        activeMapping[column.id] = target;
      }

      const columnById = new Map(
        DASHBOARD_TABLE_COLUMNS.map((column) => [column.id, column]),
      );
      const columnLabels = Object.fromEntries(
        DASHBOARD_TABLE_COLUMNS.map((column) => [column.id, column.label]),
      );

      const result = applyDashboardExportToWorkbook({
        workbook: workbookData.workbook,
        sheetName: workbookData.sheetName,
        sheetRows: workbookData.rows,
        sheetColumns: workbookData.columns,
        mapping: activeMapping,
        columnLabels,
        employeesBySap: new Map(
          [...employeesBySap.entries()].map(([key, row]) => [
            key,
            {
              getValue: (columnId: string) => {
                const column = columnById.get(columnId as DashboardTableColumnId);
                return column ? column.getValue(row) : "";
              },
            },
          ]),
        ),
      });

      downloadWorkbook(
        workbookData.workbook,
        buildFilledExportFileName(workbookData.fileName),
      );

      const insertedNote =
        result.insertedColumns > 0
          ? ` · inserted ${result.insertedColumns} new column${result.insertedColumns === 1 ? "" : "s"}`
          : "";

      setResultSummary(
        `Filled ${result.writtenCells} cells for ${result.matched} matched employees` +
          insertedNote +
          (result.unmatched > 0
            ? ` · ${result.unmatched} SAP IDs not found in PMS`
            : ""),
      );
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Could not write values to the Excel file.",
      );
    } finally {
      setExporting(false);
    }
  };

  const previewColumns = useMemo(() => {
    return selectedColumns
      .map((column) => {
        const target = mapping[column.id];
        if (target === "" || target == null) return null;

        let targetLabel = "Insert as New";
        if (typeof target === "number") {
          const sheetColumn = workbookData?.columns.find(
            (item) => item.index === target,
          );
          targetLabel = sheetColumn?.header ?? `Column ${target + 1}`;
        }

        return {
          id: column.id,
          label: column.label,
          targetLabel,
          isNew: target === EXPORT_INSERT_AS_NEW,
          getValue: column.getValue,
        };
      })
      .filter((column): column is NonNullable<typeof column> => column != null);
  }, [selectedColumns, mapping, workbookData?.columns]);

  const previewRows = useMemo(() => {
    if (!workbookData) return [];
    return workbookData.rows.map((sheetRow) => {
      const employee = employeesBySap.get(sapLookupKey(sheetRow.sap));
      return {
        sap: sheetRow.sap,
        matched: Boolean(employee),
        employeeName: employee?.employeeName ?? null,
        values: previewColumns.map((column) =>
          employee ? column.getValue(employee) : "",
        ),
      };
    });
  }, [workbookData, employeesBySap, previewColumns]);

  const sheetOptions = workbookData?.columns.filter((column) => !column.isSap) ?? [];

  return (
    <div className="space-y-3">
      <section className="rounded-md border border-[#217346]/25 bg-[#217346]/[0.04] px-3 py-3 dark:border-[#3f9c6b]/30 dark:bg-[#217346]/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Export to Sheet
            </h3>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
              Upload a sheet with SAP IDs, map Staff Listing columns onto sheet
              columns, then download the filled file.
            </p>
          </div>
          {fileName ? (
            <span className="rounded-full bg-[#217346]/15 px-2.5 py-1 text-[11px] font-medium text-[#185C37] dark:bg-[#217346]/25 dark:text-[#8fd4ad]">
              {fileName}
            </span>
          ) : null}
        </div>

        <label
          className={cn(
            "mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
            dragOver
              ? "border-[#217346] bg-[#217346]/10"
              : "border-[#217346]/35 bg-white hover:border-[#217346] hover:bg-[#217346]/[0.06] dark:border-[#3f9c6b]/40 dark:bg-slate-900/40 dark:hover:bg-[#217346]/15",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            const file = event.dataTransfer.files?.[0] ?? null;
            void handleFile(file);
          }}
        >
          <input
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              void handleFile(file);
              event.target.value = "";
            }}
          />
          {parsing ? (
            <Loader2 className="size-6 animate-spin text-[#217346]" />
          ) : (
            <Upload className="size-6 text-[#217346]" />
          )}
          <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">
            {parsing ? "Reading sheet…" : "Drop Excel file here or click to browse"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Requires a SAP / SAP ID column
          </p>
        </label>

        {workbookData ? (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
            <span>
              Sheet rows with SAP:{" "}
              <strong className="text-slate-900 dark:text-white">
                {workbookData.rows.length}
              </strong>
            </span>
            <span>
              Matched in PMS:{" "}
              <strong className="text-[#185C37] dark:text-[#8fd4ad]">
                {employeesLoading ? "…" : matchStats.matched}
              </strong>
            </span>
            <span>
              Not found:{" "}
              <strong className="text-amber-700 dark:text-amber-300">
                {employeesLoading ? "…" : matchStats.unmatched}
              </strong>
            </span>
            <span>
              Sheet columns:{" "}
              <strong className="text-slate-900 dark:text-white">
                {workbookData.columns.length}
              </strong>
            </span>
          </div>
        ) : null}
      </section>

      {workbookData ? (
        <>
          <div className="grid items-start gap-3 lg:grid-cols-2">
            <section className="rounded-md border border-slate-200 px-3 py-3 dark:border-slate-700">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Staff Listing columns
                </h4>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedColumnIds(
                        new Set(EXPORTABLE_COLUMNS.map((column) => column.id)),
                      )
                    }
                    className="rounded px-2 py-1 text-[11px] font-medium text-[#217346] hover:bg-[#217346]/10"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedColumnIds(new Set());
                      setMapping({});
                    }}
                    className="rounded px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="max-h-72 space-y-3 overflow-auto pr-1">
                {DASHBOARD_COLUMN_SECTIONS.map((section) => {
                  const sectionColumns = EXPORTABLE_COLUMNS.filter((column) =>
                    section.columnIds.includes(column.id),
                  );
                  if (sectionColumns.length === 0) return null;
                  return (
                    <div key={section.id}>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {section.label}
                      </p>
                      <div className="space-y-1">
                        {sectionColumns.map((column) => (
                          <label
                            key={column.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-white/5"
                          >
                            <input
                              type="checkbox"
                              checked={selectedColumnIds.has(column.id)}
                              onChange={() => toggleColumn(column.id)}
                              className="size-3.5 rounded border-slate-300 text-[#217346] focus:ring-[#217346]"
                            />
                            <span className="text-slate-800 dark:text-slate-100">
                              {column.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-md border border-slate-200 px-3 py-3 dark:border-slate-700">
              <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
                Map to sheet columns
              </h4>
              <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">
                Map to an existing sheet column, or choose{" "}
                <span className="font-medium text-[#185C37] dark:text-[#8fd4ad]">
                  Insert as New
                </span>{" "}
                to create and fill a new column. Matching is by SAP ID.
              </p>
              <div className="max-h-72 space-y-2 overflow-auto pr-1">
                {selectedColumns.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Select at least one Staff Listing column.
                  </p>
                ) : (
                  selectedColumns.map((column) => (
                    <div
                      key={column.id}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-2 rounded-md border border-slate-100 px-2 py-1.5 dark:border-white/10"
                    >
                      <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                        {column.label}
                      </span>
                      <select
                        value={
                          mapping[column.id] === "" || mapping[column.id] == null
                            ? ""
                            : String(mapping[column.id])
                        }
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === "") {
                            setColumnTarget(column.id, "");
                            return;
                          }
                          if (value === EXPORT_INSERT_AS_NEW) {
                            setColumnTarget(column.id, EXPORT_INSERT_AS_NEW);
                            return;
                          }
                          setColumnTarget(column.id, Number(value));
                        }}
                        className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#217346]/40 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="">Skip</option>
                        <option value={EXPORT_INSERT_AS_NEW}>
                          Insert as New
                        </option>
                        {sheetOptions.map((sheetColumn) => (
                          <option
                            key={sheetColumn.index}
                            value={sheetColumn.index}
                          >
                            {sheetColumn.header}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {matchStats.unmatchedSaps.length > 0 ? (
            <section className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-medium">
                {matchStats.unmatched} SAP ID
                {matchStats.unmatched === 1 ? "" : "s"} in the sheet were not
                found in PMS (skipped).
              </p>
              <p className="mt-1 line-clamp-2 text-amber-800/80 dark:text-amber-200/80">
                {matchStats.unmatchedSaps.slice(0, 12).join(", ")}
                {matchStats.unmatchedSaps.length > 12
                  ? ` +${matchStats.unmatchedSaps.length - 12} more`
                  : ""}
              </p>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Preview
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {previewRows.length} sheet rows · {matchStats.matched} matched ·{" "}
                {previewColumns.length} column
                {previewColumns.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#217346] text-white">
                    <th className="sticky left-0 z-20 whitespace-nowrap border-r border-[#185C37] bg-[#217346] px-3 py-2 text-xs font-semibold">
                      SAP
                    </th>
                    <th className="whitespace-nowrap border-r border-[#185C37] px-3 py-2 text-xs font-semibold">
                      Employee
                    </th>
                    {previewColumns.map((column) => (
                      <th
                        key={column.id}
                        className="min-w-[9rem] whitespace-nowrap border-r border-[#185C37] px-3 py-2 text-xs font-semibold"
                      >
                        <span className="block">{column.label}</span>
                        <span className="mt-0.5 block text-[10px] font-normal text-white/75">
                          {column.isNew
                            ? "→ Insert as New"
                            : `→ ${column.targetLabel}`}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewColumns.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 py-8 text-center text-sm text-slate-500"
                      >
                        Map at least one column to preview values that will be
                        written to the sheet.
                      </td>
                    </tr>
                  ) : previewRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={previewColumns.length + 2}
                        className="px-4 py-8 text-center text-sm text-slate-500"
                      >
                        No sheet rows to preview.
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((row, index) => (
                      <tr
                        key={`${row.sap}-${index}`}
                        className={cn(
                          index % 2 === 0
                            ? "bg-white dark:bg-slate-950"
                            : "bg-slate-50 dark:bg-slate-900/60",
                          !row.matched && "opacity-60",
                        )}
                      >
                        <td className="sticky left-0 z-10 border-r border-b border-slate-200 bg-inherit px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-700 dark:border-slate-700 dark:text-slate-200">
                          {row.sap}
                        </td>
                        <td className="border-r border-b border-slate-200 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200">
                          {row.matched ? (
                            row.employeeName || "—"
                          ) : (
                            <span className="font-medium text-amber-700 dark:text-amber-300">
                              Not in PMS
                            </span>
                          )}
                        </td>
                        {previewColumns.map((column, columnIndex) => (
                          <td
                            key={column.id}
                            className="border-r border-b border-slate-200 px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:text-slate-100"
                          >
                            {row.matched ? (
                              <span className="line-clamp-2">
                                {row.values[columnIndex] || "—"}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {resultSummary ? (
                <span className="font-medium text-[#185C37] dark:text-[#8fd4ad]">
                  {resultSummary}
                </span>
              ) : (
                `${mappedCount} mapped column${mappedCount === 1 ? "" : "s"}` +
                  (insertedCount > 0
                    ? ` (${insertedCount} new)`
                    : "") +
                  ` · ${matchStats.matched} matched employees`
              )}
            </p>
            <button
              type="button"
              onClick={handleDownload}
              disabled={
                exporting ||
                employeesLoading ||
                mappedCount === 0 ||
                matchStats.matched === 0
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#217346] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#185C37] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#217346] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              {exporting ? "Writing…" : "Download filled sheet"}
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-slate-200 px-3 py-6 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <FileSpreadsheet className="size-4 shrink-0 text-[#217346]" />
          Upload a sheet to list its columns and start mapping.
        </div>
      )}
    </div>
  );
}
