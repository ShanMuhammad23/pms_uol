"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Eye } from "lucide-react";
import Link from "next/link";
import { fetchAssignedForms } from "@/lib/queries/employee-forms-client";
import type { EmployeeFormStatus } from "@/types/employee-forms";

const STATUS_LABELS: Record<EmployeeFormStatus, string> = {
  NOT_STARTED: "Not started",
  DRAFT: "Draft saved",
  SUBMITTED: "Submitted",
};

const STATUS_CLASSES: Record<EmployeeFormStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
  DRAFT: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  SUBMITTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
};

export default function MyFormsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-forms"],
    queryFn: fetchAssignedForms,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-300/80 p-8 text-sm text-foreground/70 dark:border-white/15">
        Loading your assigned forms...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Failed to load assigned forms.
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
        <ClipboardList className="mx-auto size-8 text-foreground/50" />
        <p className="mt-3 text-sm font-medium text-text-primary">
          No forms assigned yet
        </p>
        <p className="mt-1 text-sm text-foreground/70">
          A form will appear here once one is published for your staff category.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-300/80 dark:border-white/15">
      <table className="min-w-full text-sm">
        <thead className="bg-primary/5">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-text-primary">
              Form
            </th>
            <th className="px-4 py-3 text-left font-semibold text-text-primary">
              Category
            </th>
            <th className="px-4 py-3 text-left font-semibold text-text-primary">
              Questions
            </th>
            <th className="px-4 py-3 text-left font-semibold text-text-primary">
              Status
            </th>
            <th className="px-4 py-3 text-right font-semibold text-text-primary">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((form) => (
            <tr
              key={form.templateId}
              className="border-t border-slate-300/80 dark:border-white/15"
            >
              <td className="px-4 py-3">
                <p className="font-medium text-text-primary">{form.title}</p>
                {form.description ? (
                  <p className="mt-0.5 text-xs text-foreground/70">
                    {form.description}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-text-primary">
                {form.staffCategoryName ?? "—"}
                <span className="block text-xs text-foreground/70">
                  {form.staffSubCategoryName ?? "—"}
                </span>
              </td>
              <td className="px-4 py-3 text-text-primary">
                {form.questionCount}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[form.status]}`}
                >
                  {STATUS_LABELS[form.status]}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end">
                  <Link
                    href={`/dashboard/my-forms/${form.templateId}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                  >
                    <Eye className="size-3.5" />
                    {form.status === "SUBMITTED" ? "View" : "Fill Form"}
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
