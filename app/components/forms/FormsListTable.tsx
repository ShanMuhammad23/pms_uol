"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  deleteFormTemplate,
  fetchFormTemplates,
} from "@/lib/queries/forms-client";
import type { FormTemplateListItem } from "@/types/forms";
import FormActionsDropdown from "./FormActionsDropdown";
import { ViewFormAsModal } from "./ViewFormAsModal";

interface FormsListTableProps {
  templates: FormTemplateListItem[];
  canEdit?: boolean;
}

function AssignedSubmissionProgress({
  assigned,
  submitted,
}: {
  assigned: number;
  submitted: number;
}) {
  const clampedSubmitted = Math.min(Math.max(submitted, 0), Math.max(assigned, 0));
  const percent =
    assigned > 0 ? Math.round((clampedSubmitted / assigned) * 100) : 0;

  return (
    <div
      className="mx-auto flex w-28 flex-col items-stretch gap-1"
      title={`${clampedSubmitted} of ${assigned} assigned employees submitted (${percent}%)`}
    >
      <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {assigned}
      </span>
      <span className="text-[11px] leading-tight tabular-nums text-slate-500 dark:text-slate-400">
        {clampedSubmitted} submitted
      </span>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${clampedSubmitted} of ${assigned} assigned employees submitted`}
      >
        <div
          className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default function FormsListTable({ templates, canEdit = true }: FormsListTableProps) {
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [viewAsTarget, setViewAsTarget] = useState<{
    id: number;
    title: string;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["form-templates"],
    queryFn: fetchFormTemplates,
    initialData: templates,
    // SSR already loaded templates; avoid an immediate duplicate /api/admin/forms hit.
    staleTime: 30_000,
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

  const [titleFilter, setTitleFilter] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");

  const siteOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const t of data ?? []) {
      if (t.campusId != null && t.campusName) {
        byId.set(t.campusId, t.campusName);
      }
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const hasUnassignedSite = useMemo(
    () => (data ?? []).some((t) => t.campusId == null),
    [data],
  );

  const filtered = useMemo(() => {
    const titleNeedle = titleFilter.trim().toLowerCase();
    const codeNeedle = codeFilter.trim().toLowerCase();
    return (data ?? []).filter((t) => {
      if (titleNeedle && !t.title.toLowerCase().includes(titleNeedle)) {
        return false;
      }
      if (codeNeedle && !(t.code ?? "").toLowerCase().includes(codeNeedle)) {
        return false;
      }
      if (siteFilter === "none") {
        if (t.campusId != null) return false;
      } else if (siteFilter && t.campusId !== Number(siteFilter)) {
        return false;
      }
      return true;
    });
  }, [data, titleFilter, codeFilter, siteFilter]);

  const hasActiveFilters =
    titleFilter.trim() !== "" || codeFilter.trim() !== "" || siteFilter !== "";

  const clearFilters = () => {
    setTitleFilter("");
    setCodeFilter("");
    setSiteFilter("");
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
        {canEdit ? (
          <Link
            href="/dashboard/forms/new"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Create Form
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deleteError ? (
        <p className="text-sm text-red-600">{deleteError}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={titleFilter}
            onChange={(e) => setTitleFilter(e.target.value)}
            placeholder="Filter by title…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 dark:border-neutral-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <input
          type="text"
          value={codeFilter}
          onChange={(e) => setCodeFilter(e.target.value)}
          placeholder="Filter by code…"
          className="h-9 w-36 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 dark:border-neutral-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <select
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 dark:border-neutral-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">All sites</option>
          {siteOptions.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
          {hasUnassignedSite ? <option value="none">No site</option> : null}
        </select>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-neutral-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="size-3.5" />
            Clear
          </button>
        ) : null}
        {hasActiveFilters ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {filtered.length} of {data?.length ?? 0} forms
          </span>
        ) : null}
      </div>

      <div className=" border border-slate-200 dark:border-neutral-700 rounded-md overflow-x-auto bg-white dark:bg-slate-900">
        <table className="min-w-full">
          <thead className="bg-primary text-left text-sm font-semibold whitespace-nowrap text-white">
            <tr className="divide-x divide-white/15">
              <th className="px-4 py-3.5">Title</th>
              <th className="px-4 py-3.5">Code</th>
              <th className="px-4 py-3.5">Site</th>
              <th className="px-2 py-2 w-1/16 text-center">Assigned</th>
              <th className="px-4 py-3.5 text-center w-1/16">Cycle</th>
              <th className="px-4 py-3.5 text-center w-1/16">Questions</th>
              <th className="px-4 py-3.5 text-center">Last updated</th>
              <th className="px-4 py-3.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-slate-200 dark:divide-neutral-700">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  No forms match the current filters.
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="ml-2 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            ) : null}
            {filtered.map((template) => (
              <tr
                key={template.id}
                className="divide-x divide-slate-200 dark:divide-neutral-700"
              >
                <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-50">
                  <a
                    href={`/dashboard/forms/${template.id}/employee-view`}
                    
                    rel="noopener noreferrer"
                    className="font-semibold whitespace-nowrap text-primary hover:underline dark:text-sky-300"
                    title="Open employee form preview in a new window"
                  >
                    {template.title}
                  </a>
                </td>
                <td className="px-4 py-4 text-slate-700 dark:text-slate-300">
                  <span className="whitespace-nowrap font-mono text-xs font-medium text-slate-600 dark:text-slate-400">
                    {template.code || "—"}
                  </span>
                </td>
                <td className="px-4 py-4 text-slate-700 dark:text-slate-300">
                  {template.campusName ? (
                    <span className="whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-300">
                      {template.campusName}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center text-slate-700 dark:text-slate-300">
                  <AssignedSubmissionProgress
                    assigned={template.assignedEmployeeCount}
                    submitted={template.submissionCount}
                  />
                </td>
                <td className="px-4 py-4 text-center text-slate-700 dark:text-slate-300">
                  FY {template.fiscalYear}
                </td>
                <td className="px-4 py-4 text-center text-slate-700 dark:text-slate-300">
                  {template.questionCount}
                </td>
                <td className="px-4 py-4 text-center text-slate-700 dark:text-slate-300">
                  <div className="min-w-[10rem] space-y-0.5">
                    <p className="whitespace-nowrap text-slate-900 dark:text-slate-100">
                      {new Date(template.updatedAt).toLocaleString()}
                    </p>
                    {template.updatedByName || template.updatedByEmployeeId ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {[
                          template.updatedByName,
                          template.updatedByEmployeeId
                            ? `(${template.updatedByEmployeeId})`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        —
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-center whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setViewAsTarget({
                          id: template.id,
                          title: template.title,
                        })
                      }
                      title="View Form As"
                      aria-label="View Form As"
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 p-1.5 text-slate-600 transition-colors hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 dark:border-white/15 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                    >
                      <Eye className="size-4" />
                    </button>
                    <FormActionsDropdown
                      templateId={template.id}
                      templateTitle={template.title}
                      appraisalCount={template.appraisalCount}
                      onDelete={handleDelete}
                      deletePending={deleteMutation.isPending}
                      canEdit={canEdit}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ViewFormAsModal
        key={viewAsTarget?.id ?? "closed"}
        open={viewAsTarget != null}
        templateId={viewAsTarget?.id ?? null}
        templateTitle={viewAsTarget?.title ?? ""}
        onClose={() => setViewAsTarget(null)}
      />
    </div>
  );
}
