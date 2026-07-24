"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFormTemplatesForDashboard } from "@/lib/queries/forms-client";
import DirectAssessmentSpreadsheet from "@/app/components/dashboard/DirectAssessmentSpreadsheet";
import { ClipboardList, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DirectAssessmentTab() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null,
  );

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["form-templates"],
    queryFn: fetchFormTemplatesForDashboard,
  });

  const directAssessmentTemplates = templates.filter(
    (t) => !t.selfAssessmentEnabled,
  );

  if (selectedTemplateId != null) {
    return (
      <DirectAssessmentSpreadsheet
        templateId={selectedTemplateId}
        onBack={() => setSelectedTemplateId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="size-5 text-violet-600 dark:text-violet-400" />
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Direct Assessment
          </h2>
          <p className="text-sm text-foreground/70">
            Forms where self-assessment is disabled. Managers enter scores
            directly without employee self-assessment.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-md border border-slate-300/80 p-6 text-sm text-foreground/70 dark:border-white/15">
          Loading form templates...
        </div>
      ) : directAssessmentTemplates.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300/80 px-4 py-8 text-center text-sm text-foreground/70 dark:border-white/15">
          No forms with self-assessment disabled. When you create a form with
          self-assessment turned off, it will appear here for direct manager
          assessment.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {directAssessmentTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplateId(template.id)}
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
                  {template.assignedEmployeeCount} assigned
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  Self-Assessment Off
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
