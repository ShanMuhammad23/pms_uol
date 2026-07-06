"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, Pencil, Trash2 } from "lucide-react";
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
      <div className="rounded-xl border border-slate-300/80 p-8 text-sm text-foreground/70 dark:border-white/15">
        Loading forms...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Failed to load forms.
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
        <FileText className="mx-auto size-8 text-foreground/50" />
        <p className="mt-3 text-sm font-medium text-text-primary">
          No form templates yet
        </p>
        <p className="mt-1 text-sm text-foreground/70">
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

      <div className="overflow-x-auto rounded-xl border border-slate-300/80 dark:border-white/15">
        <table className="min-w-full text-sm">
          <thead className="bg-primary/5">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-text-primary">
                Title
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-primary">
                Category
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-primary">
                Cycle
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-primary">
                Questions
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-primary">
                Appraisals
              </th>
              <th className="px-4 py-3 text-right font-semibold text-text-primary">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((template) => (
              <tr
                key={template.id}
                className="border-t border-slate-300/80 dark:border-white/15"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-text-primary">{template.title}</p>
                  {template.description ? (
                    <p className="mt-0.5 text-xs text-foreground/70">
                      {template.description}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-text-primary">
                  {CATEGORY_LABELS[template.targetCategory]}
                  <span className="block text-xs text-foreground/70">
                    {SUB_CATEGORY_LABELS[template.targetSubCategory]}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-primary">
                  FY {template.fiscalYear}
                </td>
                <td className="px-4 py-3 text-text-primary">
                  {template.questionCount}
                </td>
                <td className="px-4 py-3 text-text-primary">
                  {template.appraisalCount}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/dashboard/forms/${template.id}/view`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                    >
                      <Eye className="size-3.5" />
                      View
                    </Link>
                    <Link
                      href={`/dashboard/forms/${template.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(
                          template.id,
                          template.title,
                          template.appraisalCount,
                        )
                      }
                      disabled={deleteMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-60 dark:border-red-900"
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
