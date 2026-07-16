"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Eye, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ColumnVisibilityDropdown,
  useDashboardColumnVisibility,
} from "@/app/components/dashboard/ColumnVisibilityDropdown";
import { InlineRemarksCell } from "@/app/components/dashboard/InlineRemarksCell";
import { InlineRoleCategoryCell } from "@/app/components/dashboard/InlineRoleCategoryCell";
import { StaffListingMasterFilter } from "@/app/components/dashboard/StaffListingMasterFilter";
import { TableColumnHeaderFilter } from "@/app/components/dashboard/TableColumnHeaderFilter";
import { APPRAISAL_STATE_CONFIG } from "@/app/helpers/dashboard-form-state";
import { itemVariants } from "@/app/helpers/dashboard-animations";
import {
  EMPTY_MASTER_FILTER_STATE,
  applyMasterFilters,
  isMasterFilterableColumn,
  type MasterFilterMultiSelection,
  type MasterFilterState,
  type MasterFilterTextColumnId,
} from "@/app/helpers/dashboard-master-filters";
import {
  resolveOrderedColumns,
  type DashboardTableColumnId,
} from "@/app/helpers/dashboard-table-columns";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

interface DashboardSubmissionsTableProps {
  submissions: FormSubmissionListItem[];
  isLoading: boolean;
  error: unknown;
  onClearAllFilters: () => void;
}

function renderCell(
  columnId: DashboardTableColumnId,
  submission: FormSubmissionListItem,
  value: string,
) {
  if (columnId === "status") {
    const stateConfig = APPRAISAL_STATE_CONFIG[submission.status];
    const StateIcon = stateConfig.icon;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
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

  if (columnId === "actions") {
    if (submission.id <= 0) {
      return <span className="text-xs text-slate-400">—</span>;
    }

    return (
      <Link
        href={`/dashboard/submissions/${submission.id}`}
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 dark:bg-amber-600 dark:hover:bg-amber-500"
      >
        <Eye className="h-3.5 w-3.5" />
      </Link>
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

  if (columnId === "remarksEvaluation") {
    return (
      <InlineRemarksCell
        submissionId={submission.id}
        value={submission.remarksEvaluation}
        disabled={submission.id <= 0}
      />
    );
  }

  return (
    <span
      className={cn(
        "block max-w-[220px] truncate text-slate-700 dark:text-slate-300",
        columnId === "employeeName" && "font-semibold text-slate-900 dark:text-white",
      )}
      title={value === "—" ? undefined : value}
    >
      {value}
    </span>
  );
}

export function DashboardSubmissionsTable({
  submissions,
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

  const visibleColumns = useMemo(
    () => resolveOrderedColumns(columnOrder, visibleIds),
    [columnOrder, visibleIds],
  );
  const colSpan = Math.max(visibleColumns.length, 1);

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

  const paginatedSubmissions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return masterFilteredSubmissions.slice(start, start + PAGE_SIZE);
  }, [page, masterFilteredSubmissions]);

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);
  const showPagination = !isLoading && !error && totalCount > 0;

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
      className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
    >
         <StaffListingMasterFilter
        submissions={submissions}
        filters={masterFilters}
        onTextChange={handleMasterTextChange}
        onMultiChange={handleMasterMultiChange}
        onClearAll={clearMasterFilters}
      />
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-white/5">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            Staff listing ( Total: {totalCount}
            {totalCount !== submissions.length
              ? ` of ${submissions.length}`
              : ""}{" "}
            )
          </p>
        </div>
     
        <ColumnVisibilityDropdown
          visibleIds={visibleIds}
          columnOrder={columnOrder}
          onToggle={toggleColumn}
          onShowAll={showAll}
          onHideAll={hideAll}
          onSetColumnPosition={setColumnPosition}
        />
      </div>

     

      <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
        <table className="w-max min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/5 dark:bg-white/[0.02]">
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  className={cn(
                    "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400",
                    column.align === "right" && "text-right",
                    column.align === "center" && "text-center",
                  )}
                >
                  {isMasterFilterableColumn(column.id) ? (
                    <TableColumnHeaderFilter
                      column={column}
                      submissions={submissions}
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
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.03]">
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
                {paginatedSubmissions.map((submission, index) => (
                  <motion.tr
                    key={submission.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{
                      duration: 0.35,
                      delay: Math.min(index, 10) * 0.02,
                      ease: [0.23, 1, 0.32, 1],
                    }}
                    className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                  >
                    {visibleColumns.map((column) => {
                      const value = column.getValue(submission);
                      return (
                        <td
                          key={column.id}
                          className={cn(
                            "whitespace-nowrap px-4 py-3 align-middle",
                            column.align === "right" && "text-right",
                            column.align === "center" && "text-center",
                          )}
                        >
                          {renderCell(column.id, submission, value)}
                        </td>
                      );
                    })}
                  </motion.tr>
                ))}
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
    </motion.div>
  );
}
