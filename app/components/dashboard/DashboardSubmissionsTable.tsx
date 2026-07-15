"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Search } from "lucide-react";
import {
  ColumnVisibilityDropdown,
  useDashboardColumnVisibility,
} from "@/app/components/dashboard/ColumnVisibilityDropdown";
import { APPRAISAL_STATE_CONFIG } from "@/app/helpers/dashboard-form-state";
import { itemVariants } from "@/app/helpers/dashboard-animations";
import {
  DASHBOARD_TABLE_COLUMNS,
  type DashboardTableColumnId,
} from "@/app/helpers/dashboard-table-columns";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { cn } from "@/lib/utils";

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
  const { visibleIds, toggleColumn, showAll, isVisible } = useDashboardColumnVisibility();

  const visibleColumns = DASHBOARD_TABLE_COLUMNS.filter((column) => isVisible(column.id));
  const colSpan = Math.max(visibleColumns.length, 1);

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.6 }}
      className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-white/5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Staff listing</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Excel-aligned appraisal columns · toggle visibility for committee views
          </p>
        </div>
        <ColumnVisibilityDropdown
          visibleIds={visibleIds}
          onToggle={toggleColumn}
          onShowAll={showAll}
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
                  {column.label}
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
                {submissions.map((submission, index) => (
                  <motion.tr
                    key={submission.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{
                      duration: 0.35,
                      delay: index * 0.02,
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

      {!isLoading && !error && submissions.length === 0 ? (
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
            onClick={onClearAllFilters}
            className="mt-2 text-xs text-amber-600 hover:underline dark:text-amber-400"
          >
            Clear all filters
          </button>
        </motion.div>
      ) : null}
    </motion.div>
  );
}
