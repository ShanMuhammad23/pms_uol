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
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-400">
        Loading forms...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Failed to load forms.
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm dark:border-white/10 dark:bg-slate-900">
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

      <div className=" border border-slate-200 dark:border-neutral-700 rounded-md overflow-x-auto bg-white dark:bg-slate-900">
        <table className="min-w-full">
          <thead className="bg-primary text-left text-sm font-semibold whitespace-nowrap text-white">
            <tr className="divide-x divide-white/15">
              <th className="px-4 py-3.5">Title</th>
              <th className="px-4 py-3.5">Assigned Employees</th>
              <th className="px-4 py-3.5">Cycle</th>
              <th className="px-4 py-3.5">Questions</th>
              <th className="px-4 py-3.5">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-slate-200 dark:divide-neutral-700">
            {data.map((template) => (
              <tr
                key={template.id}
                className="divide-x divide-slate-200 dark:divide-neutral-700"
              >
                <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-50 whitespace-nowrap">
                  <p className="font-semibold text-slate-900 dark:text-white">{template.title}</p>
                  {template.description ? (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {template.description}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-4 text-slate-700 dark:text-slate-300">
                  {template.assignedEmployeeCount}
                </td>
                <td className="px-4 py-4 text-slate-700 dark:text-slate-300">
                  FY {template.fiscalYear}
                </td>
                <td className="px-4 py-4 text-slate-700 dark:text-slate-300">
                  {template.questionCount}
                </td>
                <td className="px-4 py-4 text-right whitespace-nowrap">
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
