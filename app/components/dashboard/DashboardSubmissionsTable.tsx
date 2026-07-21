"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Eye, Pencil, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BulkEditStaffModal } from "@/app/components/dashboard/BulkEditStaffModal";
import {
  ColumnVisibilityDropdown,
  useDashboardColumnVisibility,
} from "@/app/components/dashboard/ColumnVisibilityDropdown";
import { InlineGradeGroupCell } from "@/app/components/dashboard/InlineGradeGroupCell";
import { InlineRemarksCell } from "@/app/components/dashboard/InlineRemarksCell";
import { InlineRoleCategoryCell } from "@/app/components/dashboard/InlineRoleCategoryCell";
import { StaffListingMasterFilter } from "@/app/components/dashboard/StaffListingMasterFilter";
import { TableColumnHeaderFilter } from "@/app/components/dashboard/TableColumnHeaderFilter";
import { APPRAISAL_STATE_CONFIG } from "@/app/helpers/dashboard-form-state";
import { itemVariants } from "@/app/helpers/dashboard-animations";
import { ELIGIBILITY_CONFIG } from "@/app/helpers/dashboard-chart-config";
import {
  getEligibilityShortLabel,
  getSubmissionEligibilityStatus,
} from "@/app/helpers/dashboard-eligibility";
import {
  EMPTY_MASTER_FILTER_STATE,
  applyMasterFilters,
  isMasterFilterableColumn,
  type MasterFilterMultiSelection,
  type MasterFilterState,
  type MasterFilterTextColumnId,
} from "@/app/helpers/dashboard-master-filters";
import {
  getColumnWidthStyle,
  resolveOrderedColumns,
  type DashboardTableColumnDef,
  type DashboardTableColumnId,
} from "@/app/helpers/dashboard-table-columns";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

interface DashboardSubmissionsTableProps {
  submissions: FormSubmissionListItem[];
  allSubmissions?: FormSubmissionListItem[];
  isLoading: boolean;
  error: unknown;
  onClearAllFilters: () => void;
}

function columnCellClassName(
  column: DashboardTableColumnDef,
  extra?: string,
) {
  return cn(
    "px-2 py-1",
    column.wrap ? "whitespace-normal break-words" : "whitespace-nowrap",
    column.align === "right" && "text-right",
    column.align === "center" && "text-center",
    extra,
  );
}

const STICKY_EDGE_SHADOW_LEFT =
  "shadow-[6px_0_12px_-8px_rgba(15,23,42,0.2)] dark:shadow-[6px_0_12px_-8px_rgba(0,0,0,0.5)]";

function stickySelectHeaderClassName() {
  return cn(
    "sticky left-0 top-0 z-40 border-b border-slate-200 bg-slate-50 px-3 py-3 dark:border-white/10 dark:bg-slate-900",
    STICKY_EDGE_SHADOW_LEFT,
  );
}

function stickySelectCellClassName(isSelected: boolean) {
  return cn(
    "sticky left-0 z-20 border-b border-slate-100 px-2 py-1 dark:border-white/[0.03]",
    STICKY_EDGE_SHADOW_LEFT,
    isSelected
      ? "bg-amber-50/60 dark:bg-amber-500/5"
      : "bg-white group-hover:bg-slate-50/50 dark:bg-slate-900 dark:group-hover:bg-white/[0.02]",
  );
}

function stickyHeaderClassName() {
  return "sticky top-0 z-30 border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-900";
}

function canOpenSubmission(submission: FormSubmissionListItem) {
  return submission.id > 0 && submission.status !== "PENDING_SELF_ASSESSMENT";
}

function SubmissionViewControl({
  submission,
}: {
  submission: FormSubmissionListItem;
}) {
  if (!canOpenSubmission(submission)) {
    return (
      <button
        type="button"
        disabled
        title="Self assessment not yet submitted"
        aria-label="View submission unavailable"
        className="inline-flex size-6 shrink-0 cursor-not-allowed items-center justify-center rounded-md text-slate-300 dark:text-slate-600"
      >
        <Eye className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <Link
      href={`/dashboard/submissions/${submission.id}`}
      title="View submission"
      aria-label={`View submission for ${submission.employeeName}`}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
    >
      <Eye className="h-3.5 w-3.5" />
    </Link>
  );
}

function renderCell(
  column: DashboardTableColumnDef,
  submission: FormSubmissionListItem,
  value: string,
) {
  const columnId = column.id;

  if (columnId === "status") {
    const stateConfig = APPRAISAL_STATE_CONFIG[submission.status];
    const StateIcon = stateConfig.icon;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold",
          stateConfig.bg,
          stateConfig.color,
          stateConfig.border,
        )}
      >
        <StateIcon className="h-3 w-3" />
        {stateConfig.label}
      </span>
    );
  }

  if (columnId === "sapCode") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <SubmissionViewControl submission={submission} />
        <span
          className={cn(
            "block text-slate-700 dark:text-slate-300",
            column.wrap ? "whitespace-normal break-words" : "truncate",
            !column.width && !column.wrap && "max-w-[220px]",
          )}
          style={column.width != null ? { maxWidth: column.width } : undefined}
          title={value === "—" ? undefined : value}
        >
          {value}
        </span>
      </span>
    );
  }

  if (columnId === "eligible" || columnId === "applicableDuration") {
    const status = getSubmissionEligibilityStatus(submission);
    const backgroundColor = ELIGIBILITY_CONFIG[status].light;

    if (columnId === "eligible") {
      const label = getEligibilityShortLabel(status);
      return (
        <span
          className="inline-flex min-w-[3.25rem] items-center justify-center rounded-md px-2.5 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor }}
          title={status}
        >
          {label}
        </span>
      );
    }

    // applicableDuration — same color as Eligible badge, plain number text
    return (
      <span
        className="inline-flex min-w-[3.25rem] items-center justify-center rounded-md px-2.5 py-1 text-xs font-semibold text-white"
        style={{ backgroundColor }}
        title={status}
      >
        {value}
      </span>
    );
  }

  if (columnId === "roleCategory") {
    return (
      <InlineRoleCategoryCell
        employeeId={submission.employeeId}
        value={submission.roleCategory}
      />
    );
  }

  if (columnId === "gradeGroup") {
    return (
      <InlineGradeGroupCell
        employeeId={submission.employeeId}
        value={submission.gradeGroup}
      />
    );
  }

  if (columnId === "remarksEvaluation") {
    return (
      <InlineRemarksCell
        submissionId={submission.id}
        field="remarksEvaluation"
        value={submission.remarksEvaluation}
        disabled={submission.id <= 0}
      />
    );
  }

  if (columnId === "remarksCompensation") {
    return (
      <InlineRemarksCell
        submissionId={submission.id}
        field="remarksCompensation"
        value={submission.remarksCompensation}
        disabled={submission.id <= 0}
      />
    );
  }

  return (
    <span
      className={cn(
        "block text-slate-700 dark:text-slate-300",
        column.wrap ? "whitespace-normal break-words" : "truncate",
        !column.width && !column.wrap && "max-w-[220px]",
        columnId === "employeeName" && "font-semibold text-slate-900 dark:text-white",
      )}
      style={column.width != null ? { maxWidth: column.width } : undefined}
      title={value === "—" ? undefined : value}
    >
      {value}
    </span>
  );
}

export function DashboardSubmissionsTable({
  submissions,
  allSubmissions = submissions,
  isLoading,
  error,
  onClearAllFilters,
}: DashboardSubmissionsTableProps) {
  const {
    visibleIds,
    columnOrder,
    toggleColumn,
    showAll,
    hideAll,
    setColumnPosition,
  } = useDashboardColumnVisibility();
  const [page, setPage] = useState(1);
  const [masterFilters, setMasterFilters] = useState<MasterFilterState>(
    EMPTY_MASTER_FILTER_STATE,
  );
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const visibleColumns = useMemo(
    () => resolveOrderedColumns(columnOrder, visibleIds),
    [columnOrder, visibleIds],
  );
  const colSpan = Math.max(visibleColumns.length, 1) + 1;

  const masterFilteredSubmissions = useMemo(
    () => applyMasterFilters(submissions, masterFilters),
    [masterFilters, submissions],
  );

  const totalCount = masterFilteredSubmissions.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [submissions, masterFilters]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    const available = new Set(
      masterFilteredSubmissions.map((row) => row.employeeId),
    );
    setSelectedEmployeeIds((current) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of current) {
        if (available.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [masterFilteredSubmissions]);

  const paginatedSubmissions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return masterFilteredSubmissions.slice(start, start + PAGE_SIZE);
  }, [page, masterFilteredSubmissions]);

  const filteredEmployeeIds = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const row of masterFilteredSubmissions) {
      if (seen.has(row.employeeId)) continue;
      seen.add(row.employeeId);
      ids.push(row.employeeId);
    }
    return ids;
  }, [masterFilteredSubmissions]);

  const selectedCount = selectedEmployeeIds.size;
  const allFilteredSelected =
    filteredEmployeeIds.length > 0 &&
    filteredEmployeeIds.every((id) => selectedEmployeeIds.has(id));
  const someFilteredSelected =
    selectedCount > 0 && !allFilteredSelected;

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);
  const showPagination = !isLoading && !error && totalCount > 0;

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedEmployeeIds((current) => {
      if (
        filteredEmployeeIds.length > 0 &&
        filteredEmployeeIds.every((id) => current.has(id))
      ) {
        return new Set();
      }
      return new Set(filteredEmployeeIds);
    });
  };

  const handleMasterTextChange = (
    columnId: MasterFilterTextColumnId,
    next: string,
  ) => {
    setMasterFilters((current) => {
      const text = { ...current.text };

      if (!next.trim()) {
        delete text[columnId];
      } else {
        text[columnId] = next;
      }

      return { ...current, text };
    });
  };

  const handleMasterMultiChange = (
    columnId: DashboardTableColumnId,
    next: MasterFilterMultiSelection,
  ) => {
    setMasterFilters((current) => {
      const multi = { ...current.multi };

      if (next === null) {
        delete multi[columnId];
      } else {
        multi[columnId] = next;
      }

      return { ...current, multi };
    });
  };

  const clearMasterFilters = () => {
    setMasterFilters(EMPTY_MASTER_FILTER_STATE);
  };

  const handleClearAllFilters = () => {
    clearMasterFilters();
    onClearAllFilters();
  };

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.6 }}
      className="min-w-0 min-h-screen max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
    >
         <StaffListingMasterFilter
        submissions={submissions}
        allSubmissions={allSubmissions}
        filters={masterFilters}
        onTextChange={handleMasterTextChange}
        onMultiChange={handleMasterMultiChange}
        onClearAll={clearMasterFilters}
      />
      <div className="relative z-50 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-white/5">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            Staff listing ( Total: {totalCount}
            {totalCount !== submissions.length
              ? ` of ${submissions.length}`
              : ""}{" "}
            )
          </p>
          {selectedCount > 0 ? (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {selectedCount} selected
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setBulkEditOpen(true)}
            disabled={selectedCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            <Pencil className="h-3.5 w-3.5" />
            Bulk edit
            {selectedCount > 0 ? ` (${selectedCount})` : ""}
          </button>
          <ColumnVisibilityDropdown
            visibleIds={visibleIds}
            columnOrder={columnOrder}
            onToggle={toggleColumn}
            onShowAll={showAll}
            onHideAll={hideAll}
            onSetColumnPosition={setColumnPosition}
          />
        </div>
      </div>

      <div className="w-full max-w-full max-h-[calc(100vh-5.5rem)] overflow-auto overscroll-contain">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              <th className={stickySelectHeaderClassName()}>
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={(element) => {
                    if (element) {
                      element.indeterminate = someFilteredSelected;
                    }
                  }}
                  onChange={toggleSelectAllFiltered}
                  disabled={filteredEmployeeIds.length === 0}
                  aria-label="Select all filtered staff"
                  className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 disabled:opacity-40 dark:border-white/20 dark:bg-slate-950"
                />
              </th>
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  className={columnCellClassName(
                    column,
                    cn(
                      stickyHeaderClassName(),
                      "text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400",
                    ),
                  )}
                  style={getColumnWidthStyle(column)}
                >
                  {isMasterFilterableColumn(column.id) ? (
                    <TableColumnHeaderFilter
                      column={column}
                      submissions={submissions}
                      allSubmissions={allSubmissions}
                      filters={masterFilters}
                      onTextChange={handleMasterTextChange}
                      onMultiChange={handleMasterMultiChange}
                    />
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  Loading submissions...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-red-600 dark:text-red-400">
                  Failed to load submissions.
                </td>
              </tr>
            ) : (
              <AnimatePresence>
                {paginatedSubmissions.map((submission, index) => {
                  const isSelected = selectedEmployeeIds.has(
                    submission.employeeId,
                  );
                  return (
                    <motion.tr
                      key={`${submission.employeeId}-${submission.id}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{
                        duration: 0.35,
                        delay: Math.min(index, 10) * 0.02,
                        ease: [0.23, 1, 0.32, 1],
                      }}
                      className={cn(
                        "group transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02]",
                        isSelected && "bg-amber-50/60 dark:bg-amber-500/5",
                      )}
                    >
                      <td className={stickySelectCellClassName(isSelected)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            toggleEmployeeSelection(submission.employeeId)
                          }
                          aria-label={`Select ${submission.employeeName}`}
                          className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 dark:border-white/20 dark:bg-slate-950"
                        />
                      </td>
                      {visibleColumns.map((column) => {
                        const value = column.getValue(submission);
                        return (
                          <td
                            key={column.id}
                            className={columnCellClassName(
                              column,
                              "align-middle border-b border-slate-100 dark:border-white/[0.03]",
                            )}
                            style={getColumnWidthStyle(column)}
                          >
                            {renderCell(column, submission, value)}
                          </td>
                        );
                      })}
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && !error && totalCount === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <Search className="h-10 w-10 text-slate-300 dark:text-slate-700" />
          <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-500">
            No records match your filters
          </p>
          <button
            onClick={handleClearAllFilters}
            className="mt-2 text-xs text-amber-600 hover:underline dark:text-amber-400"
          >
            Clear all filters
          </button>
        </motion.div>
      ) : null}

      {showPagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-white/5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {rangeStart}–{rangeEnd} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.04]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <span className="min-w-20 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.04]"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <BulkEditStaffModal
        open={bulkEditOpen}
        selectedEmployeeIds={[...selectedEmployeeIds]}
        onClose={() => setBulkEditOpen(false)}
        onSuccess={() => setSelectedEmployeeIds(new Set())}
      />
    </motion.div>
  );
}
