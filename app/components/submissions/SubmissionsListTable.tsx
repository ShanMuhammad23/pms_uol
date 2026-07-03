"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, Eye } from "lucide-react";
import Link from "next/link";
import { fetchFormSubmissions } from "@/lib/queries/form-submissions-client";
import { APPRAISAL_STATUS_LABELS } from "@/types/forms";

export default function SubmissionsListTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["form-submissions"],
    queryFn: fetchFormSubmissions,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-300/80 p-8 text-sm text-foreground/70 dark:border-white/15">
        Loading submissions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Failed to load submissions.
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
        <ClipboardCheck className="mx-auto size-8 text-foreground/50" />
        <p className="mt-3 text-sm font-medium text-text-primary">
          No submitted forms yet
        </p>
        <p className="mt-1 text-sm text-foreground/70">
          Employee submissions will appear here once forms are completed.
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
              Employee
            </th>
            <th className="px-4 py-3 text-left font-semibold text-text-primary">
              Form
            </th>
            <th className="px-4 py-3 text-left font-semibold text-text-primary">
              Category
            </th>
            <th className="px-4 py-3 text-left font-semibold text-text-primary">
              Raw Score
            </th>
            <th className="px-4 py-3 text-left font-semibold text-text-primary">
              Performance / Quartile
            </th>
            <th className="px-4 py-3 text-left font-semibold text-text-primary">
              Status
            </th>
            <th className="px-4 py-3 text-left font-semibold text-text-primary">
              Submitted
            </th>
            <th className="px-4 py-3 text-right font-semibold text-text-primary">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((submission) => (
            <tr
              key={submission.id}
              className="border-t border-slate-300/80 dark:border-white/15"
            >
              <td className="px-4 py-3">
                <p className="font-medium text-text-primary">
                  {submission.employeeName}
                </p>
                <p className="text-xs text-foreground/70">
                  {submission.employeeEmail}
                </p>
              </td>
              <td className="px-4 py-3 text-text-primary">
                {submission.templateTitle ?? "—"}
              </td>
              <td className="px-4 py-3 text-text-primary">
                {submission.staffCategoryName ?? "—"}
                <span className="block text-xs text-foreground/70">
                  {submission.staffSubCategoryName ?? "—"}
                </span>
              </td>
              <td className="px-4 py-3 font-medium text-text-primary">
                {submission.rawScore} / {submission.maxRawScore}
                <span className="block text-xs font-normal text-foreground/70">
                  {submission.scorePercent}%
                </span>
              </td>
              <td className="px-4 py-3 text-text-primary">
                {submission.performanceLevelName ?? "—"}
                <span className="block text-xs text-foreground/70">
                  {submission.quartileName ?? "No matching quartile"}
                </span>
              </td>
              <td className="px-4 py-3 text-text-primary">
                {APPRAISAL_STATUS_LABELS[submission.status]}
              </td>
              <td className="px-4 py-3 text-text-primary">
                {new Date(submission.submittedAt).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end">
                  <Link
                    href={`/dashboard/submissions/${submission.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                  >
                    <Eye className="size-3.5" />
                    View
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
