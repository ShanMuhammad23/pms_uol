"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  deleteFormTemplate,
  fetchFormTemplates,
} from "@/lib/queries/forms-client";
import type { FormTemplateListItem } from "@/types/forms";
import {
  CATEGORY_LABELS,
  SUB_CATEGORY_LABELS,
} from "@/types/forms";
import FormActionsDropdown from "./FormActionsDropdown";

interface FormsListTableProps {
  templates: FormTemplateListItem[];
}

export default function FormsListTable({ templates }: FormsListTableProps) {
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["form-templates"],
    queryFn: fetchFormTemplates,
    initialData: templates,
    refetchOnMount: "always",
  });

  useEffect(() => {
    queryClient.setQueryData(["form-templates"], templates);
  }, [templates, queryClient]);

  const deleteMutation = useMutation({
    mutationFn: deleteFormTemplate,
    onSuccess: () => {
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["form-templates"] });
    },
    onError: (mutationError: Error) => {
      setDeleteError(mutationError.message);
    },
  });

  const handleDelete = (id: number, title: string, appraisalCount: number) => {
    const warning =
      appraisalCount > 0
        ? `This form is linked to ${appraisalCount} appraisal(s). Deleting it will remove the form structure from those records.`
        : "This action cannot be undone.";

    const confirmed = window.confirm(
      `Delete "${title}"?\n\n${warning}`,
    );

    if (!confirmed) {
      return;
    }

    deleteMutation.mutate(id);
  };

  if (isLoading && !data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-400">
        Loading forms...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Failed to load forms.
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm dark:border-white/10 dark:bg-slate-900">
        <FileText className="mx-auto size-8 text-slate-300 dark:text-slate-600" />
        <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
          No form templates yet
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Create your first appraisal form to get started.
        </p>
        <Link
          href="/dashboard/forms/new"
          className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          Create Form
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deleteError ? (
        <p className="text-sm text-red-600">{deleteError}</p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                Title
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                Category
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                Cycle
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                Questions
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                Appraisals
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((template) => (
              <tr
                key={template.id}
                className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
              >
                <td className="border-b border-slate-100 px-4 py-3 dark:border-white/[0.03]">
                  <p className="font-semibold text-slate-900 dark:text-white">{template.title}</p>
                  {template.description ? (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {template.description}
                    </p>
                  ) : null}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-slate-700 dark:border-white/[0.03] dark:text-slate-300">
                  {CATEGORY_LABELS[template.targetCategory]}
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {SUB_CATEGORY_LABELS[template.targetSubCategory]}
                  </span>
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-slate-700 dark:border-white/[0.03] dark:text-slate-300">
                  FY {template.fiscalYear}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-slate-700 dark:border-white/[0.03] dark:text-slate-300">
                  {template.questionCount}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-slate-700 dark:border-white/[0.03] dark:text-slate-300">
                  {template.appraisalCount}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-right dark:border-white/[0.03]">
                  <FormActionsDropdown
                    templateId={template.id}
                    templateTitle={template.title}
                    appraisalCount={template.appraisalCount}
                    onDelete={handleDelete}
                    deletePending={deleteMutation.isPending}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
