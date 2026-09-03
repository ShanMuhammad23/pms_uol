"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchDirectAssessmentTemplates,
  fetchDirectAssessmentOrgStaffCounts,
  type DirectAssessmentTemplateScope,
} from "@/lib/queries/forms-client";
import { fetchDashboardEntities } from "@/lib/queries/entities-client";
import DirectAssessmentSpreadsheet from "@/app/components/dashboard/DirectAssessmentSpreadsheet";
import { DirectAssessmentOrgLevelFilterBar } from "@/app/components/dashboard/DirectAssessmentFilterBar";
import {
  seedDirectAssessmentSpreadsheetOrgFilters,
  useDirectAssessmentOrgLevelFilters,
} from "@/app/queries/direct-assessment-filters";
import { isAdminRole } from "@/lib/auth/submission-review-roles";
import { Building2, ClipboardList, FileText, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormTemplateListItem } from "@/types/forms";

interface DirectAssessmentTabProps {
  role?: string | null;
}

export default function DirectAssessmentTab({
  role,
}: DirectAssessmentTabProps) {
  const showSplitViews = isAdminRole(role ?? undefined);
  const [view, setView] = useState<DirectAssessmentTemplateScope>("all");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null,
  );

  const { data: entities = [] } = useQuery({
    queryKey: ["entities"],
    queryFn: fetchDashboardEntities,
    enabled: showSplitViews,
  });

  const { data: orgStaffByEntity = [] } = useQuery({
    queryKey: ["direct-assessment-org-staff-counts"],
    queryFn: fetchDirectAssessmentOrgStaffCounts,
    enabled: showSplitViews,
  });

  const orgFilters = useDirectAssessmentOrgLevelFilters(
    entities,
    orgStaffByEntity,
  );

  const { data: managedTemplates = [], isLoading: managedLoading } = useQuery({
    queryKey: ["direct-assessment-templates", "managed"],
    queryFn: () => fetchDirectAssessmentTemplates("managed"),
    enabled: showSplitViews,
  });

  const { data: allTemplates = [], isLoading: allLoading } = useQuery({
    queryKey: [
      "direct-assessment-templates",
      "all",
      orgFilters.selectedCategory1EntityIds,
      orgFilters.selectedCategory2EntityIds,
    ],
    queryFn: () =>
      fetchDirectAssessmentTemplates("all", {
        category1EntityIds:
          orgFilters.selectedCategory1EntityIds === null
            ? null
            : orgFilters.selectedCategory1EntityIds.map(Number),
        category2EntityIds:
          orgFilters.selectedCategory2EntityIds === null
            ? null
            : orgFilters.selectedCategory2EntityIds.map(Number),
      }),
    enabled: showSplitViews,
  });

  const { data: managerTemplates = [], isLoading: managerLoading } = useQuery({
    queryKey: ["direct-assessment-templates", "manager"],
    queryFn: () => fetchDirectAssessmentTemplates("all"),
    enabled: !showSplitViews,
  });

  const templates = showSplitViews
    ? view === "managed"
      ? managedTemplates
      : allTemplates
    : managerTemplates;
  const isLoading = showSplitViews
    ? view === "managed"
      ? managedLoading
      : allLoading
    : managerLoading;

  if (selectedTemplateId != null) {
    return (
      <DirectAssessmentSpreadsheet
        templateId={selectedTemplateId}
        scope={showSplitViews ? view : "managed"}
        onBack={() => setSelectedTemplateId(null)}
      />
    );
  }

  const emptyMessage =
    showSplitViews && view === "managed"
      ? "You are not assigned as Manager 1 or Manager 2 on any direct assessment form. Switch to All Direct Assessments to view organization-wide forms."
      : showSplitViews && view === "all" && orgFilters.hasActiveOrgFilters
        ? "No direct assessment forms match the selected organization."
        : showSplitViews
          ? "No forms with self-assessment disabled. When you create a form with self-assessment turned off, it will appear here for direct manager assessment."
          : "You are not assigned as Manager 1 or Manager 2 on any direct assessment form.";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="size-5 text-violet-600 dark:text-violet-400" />
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Direct Assessment
          </h2>
          <p className="text-sm text-foreground/70">
            {showSplitViews
              ? "My Direct Assessments are forms where you are Manager 1 or Manager 2. All Direct Assessments include every form with self-assessment disabled, regardless of manager."
              : "Forms for staff where you are Manager 1 or Manager 2 and self-assessment is disabled."}
          </p>
        </div>
      </div>

      {showSplitViews ? (
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setView("managed")}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
              view === "managed"
                ? "border-violet-500 text-violet-700 dark:border-violet-400 dark:text-violet-300"
                : "border-transparent text-foreground/60 hover:text-text-primary",
            )}
          >
            <Users className="size-3.5" aria-hidden="true" />
            My Direct Assessments
            {managedTemplates.length > 0 || !managedLoading ? (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {managedTemplates.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setView("all")}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
              view === "all"
                ? "border-violet-500 text-violet-700 dark:border-violet-400 dark:text-violet-300"
                : "border-transparent text-foreground/60 hover:text-text-primary",
            )}
          >
            <Building2 className="size-3.5" aria-hidden="true" />
            All Direct Assessments
            {allTemplates.length > 0 || !allLoading ? (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {allTemplates.length}
              </span>
            ) : null}
          </button>
        </div>
      ) : null}

      {showSplitViews && view === "all" ? (
        <DirectAssessmentOrgLevelFilterBar
          selectedCategory1EntityIds={orgFilters.selectedCategory1EntityIds}
          selectedCategory2EntityIds={orgFilters.selectedCategory2EntityIds}
          category1Options={orgFilters.category1Options}
          category2Options={orgFilters.category2Options}
          onCategory1EntityChange={orgFilters.handleCategory1EntityChange}
          onCategory2EntityChange={orgFilters.handleCategory2EntityChange}
          onClearOrgFilters={orgFilters.clearOrgFilters}
          hasActiveOrgFilters={orgFilters.hasActiveOrgFilters}
        />
      ) : null}

      {isLoading ? (
        <div className="rounded-md border border-slate-300/80 p-6 text-sm text-foreground/70 dark:border-white/15">
          Loading form templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300/80 px-4 py-8 text-center text-sm text-foreground/70 dark:border-white/15">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              assignedLabel={
                showSplitViews && view === "managed"
                  ? "you manage"
                  : "assigned"
              }
              onSelect={() => {
                if (showSplitViews && view === "all") {
                  seedDirectAssessmentSpreadsheetOrgFilters(
                    orgFilters.selectedCategory1EntityIds,
                    orgFilters.selectedCategory2EntityIds,
                  );
                }
                setSelectedTemplateId(template.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  assignedLabel,
  onSelect,
}: {
  template: FormTemplateListItem;
  assignedLabel: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-violet-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-violet-700",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-violet-600 dark:text-violet-400" />
          <h3 className="text-sm font-semibold text-text-primary">
            {template.title}
          </h3>
        </div>
      </div>

      {template.description ? (
        <p className="line-clamp-2 text-xs text-foreground/60">
          {template.description}
        </p>
      ) : null}

      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          FY {template.fiscalYear}
        </span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          {template.questionCount} questions
        </span>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
          {template.assignedEmployeeCount} {assignedLabel}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Self-Assessment Off
        </span>
      </div>
    </button>
  );
}
