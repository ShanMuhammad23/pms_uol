"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, CheckCircle2, Eye, Layers, Search } from "lucide-react";
import { getSubmissionDisplayRating } from "@/app/helpers/dashboard-calibration";
import { getCategoryBadgeStyle } from "@/app/helpers/dashboard-category-badge";
import { APPRAISAL_STATE_CONFIG } from "@/app/helpers/dashboard-form-state";
import { itemVariants } from "@/app/helpers/dashboard-animations";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { cn } from "@/lib/utils";

interface DashboardSubmissionsTableProps {
  submissions: FormSubmissionListItem[];
  isLoading: boolean;
  error: unknown;
  onClearAllFilters: () => void;
}

export function DashboardSubmissionsTable({
  submissions,
  isLoading,
  error,
  onClearAllFilters,
}: DashboardSubmissionsTableProps) {
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.6 }}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/5 dark:bg-white/[0.02]">
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Employee
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Function / Sub-Function
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Category
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Score
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Current Rating
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Status
              </th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.03]">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  Loading submissions...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-red-600 dark:text-red-400">
                  Failed to load submissions.
                </td>
              </tr>
            ) : (
              <AnimatePresence>
                {submissions.map((submission, index) => {
                  const stateConfig = APPRAISAL_STATE_CONFIG[submission.status];
                  const StateIcon = stateConfig.icon;
                  const catConfig = getCategoryBadgeStyle(submission.staffCategoryName);
                  const functionLabel = submission.parentEntityName ?? submission.entityName ?? "—";
                  const subFunctionLabel = submission.parentEntityName
                    ? submission.entityName ?? "—"
                    : "—";
                  const displayRating = getSubmissionDisplayRating(submission);

                  return (
                    <motion.tr
                      key={submission.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{
                        duration: 0.35,
                        delay: index * 0.04,
                        ease: [0.23, 1, 0.32, 1],
                      }}
                      className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-4">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 dark:text-white">
                            {submission.employeeName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-500">
                            {submission.employeeId}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {functionLabel}
                            </span>
                          </div>
                          {subFunctionLabel !== "—" ? (
                            <div className="flex items-center gap-1.5 pl-4">
                              <Layers className="h-3 w-3 text-slate-400" />
                              <span className="text-xs text-slate-500 dark:text-slate-500">
                                {subFunctionLabel}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium",
                            catConfig.bg,
                            catConfig.color,
                            catConfig.border,
                          )}
                        >
                          {submission.staffCategoryName ?? "—"}
                        </span>
                        <p className="mt-1 text-xs text-slate-500">
                          {submission.staffSubCategoryName ?? "—"}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                          {submission.rawScore}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                            submission.calibratedRating
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/30 dark:text-emerald-400"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                          )}
                        >
                          {displayRating}
                          {submission.calibratedRating ? (
                            <CheckCircle2 className="ml-1 h-3 w-3" />
                          ) : null}
                        </span>
                      </td>
                      <td className="px-5 py-4">
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
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/submissions/${submission.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 dark:bg-amber-600 dark:hover:bg-amber-500"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </motion.tr>
                  );
                })}
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
