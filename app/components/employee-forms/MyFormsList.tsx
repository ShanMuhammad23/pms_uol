"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Eye } from "lucide-react";
import Link from "next/link";
import { APPRAISAL_STATE_CONFIG } from "@/app/helpers/dashboard-form-state";
import { fetchAssignedForms } from "@/lib/queries/employee-forms-client";
import type { AppraisalStatus } from "@/types/forms";
import { cn } from "@/lib/utils";

function isFillable(status: AppraisalStatus, submittedAt: string | null): boolean {
  return status === "PENDING_SELF_ASSESSMENT" && !submittedAt;
}

export default function MyFormsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-forms"],
    queryFn: fetchAssignedForms,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-400">
        Loading your assigned forms...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Failed to load assigned forms.
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm dark:border-white/10 dark:bg-slate-900">
        <ClipboardList className="mx-auto size-8 text-slate-300 dark:text-slate-600" />
        <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
          No forms assigned yet
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          A form will appear here once it is assigned to you by an administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900">
          <tr>
            <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
              Form
            </th>
            <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
              Category
            </th>
            <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
              Questions
            </th>
            <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
              Status
            </th>
            <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((form) => {
            const statusConfig = APPRAISAL_STATE_CONFIG[form.status];
            const canFill = isFillable(form.status, form.submittedAt);

            return (
              <tr
                key={form.templateId}
                className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
              >
                <td className="border-b border-slate-100 px-4 py-3 dark:border-white/[0.03]">
                  <p className="font-semibold text-slate-900 dark:text-white">{form.title}</p>
                  {form.description ? (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {form.description}
                    </p>
                  ) : null}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-slate-700 dark:border-white/[0.03] dark:text-slate-300">
                  {form.staffCategoryName ?? "—"}
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {form.staffSubCategoryName ?? "—"}
                  </span>
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-slate-700 dark:border-white/[0.03] dark:text-slate-300">
                  {form.questionCount}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 dark:border-white/[0.03]">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                      statusConfig.bg,
                      statusConfig.color,
                      statusConfig.border,
                      "border",
                    )}
                  >
                    {statusConfig.label}
                  </span>
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-right dark:border-white/[0.03]">
                  <div className="flex justify-end">
                    <Link
                      href={`/dashboard/my-forms/${form.templateId}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-primary/10 dark:border-white/15 dark:text-slate-300"
                    >
                      <Eye className="size-3.5" />
                      {canFill ? "Fill Form" : "View"}
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
