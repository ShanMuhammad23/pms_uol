"use client";

import type { FormTemplateRecord, QuestionRecord, FieldType } from "@/types/forms";
import {
  CATEGORY_LABELS,
  FIELD_TYPE_LABELS,
  flattenAllQuestions,
  SUB_CATEGORY_LABELS,
} from "@/types/forms";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  buildFormTableRows,
  formatSectionLabel,
  formatSubsectionLabel,
} from "@/app/helpers/form-table-rows";

interface FormTemplateViewProps {
  template: FormTemplateRecord;
  headerActions?: ReactNode;
}

export default function FormTemplateView({ template, headerActions }: FormTemplateViewProps) {
  const allQuestions = flattenAllQuestions(template);
  const rows = buildFormTableRows(template.sections, template.questions);

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 no-print">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold break-words text-text-primary">
            {template.title}
          </h2>
          {template.description ? (
            <p className="mt-1 text-sm text-foreground/70">
              {template.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-900/30 dark:text-indigo-100">
            <span className="text-indigo-600 dark:text-indigo-300">Category</span>
            <span className="font-medium text-text-primary">
              {template.targetCategory ? CATEGORY_LABELS[template.targetCategory] : "Unassigned"}
              {template.targetSubCategory ? ` · ${SUB_CATEGORY_LABELS[template.targetSubCategory]}` : ""}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/30 dark:text-emerald-100">
            <span className="text-emerald-600 dark:text-emerald-300">Appraisal Cycle</span>
            <span className="font-medium text-text-primary">FY {template.fiscalYear}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/30 dark:text-amber-100">
            <span className="text-amber-600 dark:text-amber-300">Questions</span>
            <span className="font-medium text-text-primary">{allQuestions.length}</span>
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs text-sky-800 dark:border-sky-500/30 dark:bg-sky-900/30 dark:text-sky-100"
          >
            <span className="text-sky-600 dark:text-sky-300">
              Self Assessment
            </span>
            <span className="font-medium text-text-primary">
              Per-Employee
            </span>
          </span>
          {headerActions}
        </div>
      </div>

      <div className="my-6">
        <div className="form-template-table-wrapper rounded-lg border border-indigo-200 dark:border-indigo-500/30 overflow-auto max-h-[70vh] shadow-sm shadow-indigo-100/40 dark:shadow-indigo-900/10 no-print-overflow">
          <table className="form-template-table w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-indigo-600 dark:bg-indigo-800/80">
                <th className="print-col-minimal border-r border-indigo-500/30 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-50 dark:border-indigo-400/20 dark:text-indigo-100">
                  Sr
                </th>
                <th className="min-w-[280px] print-col-largest border-r border-indigo-500/30 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-50 dark:border-indigo-400/20 dark:text-indigo-100">
                  Key Performance Indicators (KPIs)
                </th>
                <th className="print-col-minimal whitespace-nowrap border-r border-indigo-500/30 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-50 dark:border-indigo-400/20 dark:text-indigo-100">
                  Weight
                </th>
                <th className="print-col-small whitespace-nowrap border-r border-indigo-500/30 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-50 dark:border-indigo-400/20 dark:text-indigo-100">
                  Field Type
                </th>
                <th className="print-col-minimal whitespace-nowrap border-r border-indigo-500/30 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-50 dark:border-indigo-400/20 dark:text-indigo-100">
                  Required
                </th>
                <th className="print-col-small whitespace-nowrap border-r border-indigo-500/30 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-50 dark:border-indigo-400/20 dark:text-indigo-100">
                  Self Assessment
                </th>
                <th className="print-col-small whitespace-nowrap border-r border-indigo-500/30 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-50 dark:border-indigo-400/20 dark:text-indigo-100">
                  HOD Assessment
                </th>
                
              </tr>
            </thead>
            <tbody className="text-sm">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-indigo-400 dark:text-indigo-400/70 bg-indigo-50/50 dark:bg-indigo-950/20">
                    No questions defined.
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIdx) => {
                  const { question } = row;
                  const isEvenRow = rowIdx % 2 === 0;
                  return (
                    <Fragment key={question.id}>
                      {row.isFirstInSection && row.sectionTitle ? (
                        <tr className="bg-indigo-100/70 dark:bg-indigo-900/30">
                          <td colSpan={7} className="form-section-header-cell text-sm font-bold text-indigo-800 dark:text-indigo-200">
                            {formatSectionLabel(row)}
                          </td>
                        </tr>
                      ) : null}
                      {row.isFirstInSubsection && row.subsectionTitle ? (
                        <tr className="bg-indigo-50/70 dark:bg-indigo-900/20">
                          <td colSpan={7} className="form-section-header-cell pl-8 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                            {formatSubsectionLabel(row)}
                          </td>
                        </tr>
                      ) : null}
                    <tr className={cn(
                      "align-top border-b border-indigo-100 dark:border-indigo-500/15",
                      isEvenRow
                        ? "bg-white dark:bg-slate-900/40"
                        : "bg-indigo-50/40 dark:bg-indigo-950/20"
                    )}>
                      <td className="border-r border-indigo-100 px-3 py-2.5 text-center tabular-nums text-indigo-600 dark:border-indigo-500/15 dark:text-indigo-300">
                        {row.sr}
                      </td>
                      <td className="border-r border-indigo-100 px-3 py-2.5 dark:border-indigo-500/15">
                        <p className="max-w-[450px] break-words text-xs leading-snug text-slate-800 dark:text-slate-200">{question.questionText}</p>
                        {question.options.length > 0 ? (
                          <ul className="mt-1.5 space-y-0.5">
                            {question.options.map((option) => (
                              <li key={option.id} className="max-w-[400px] break-words text-[11px] text-slate-600 dark:text-slate-400">
                                <span className="text-teal-600 dark:text-teal-400">•</span> {option.optionLabel} <span className="text-slate-400">({option.pointsAssigned} pts)</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap border-r border-indigo-100 px-3 py-2.5 text-right tabular-nums font-semibold text-teal-700 dark:border-indigo-500/15 dark:text-teal-300">
                        {question.totalMarks}
                      </td>
                      <td className="whitespace-nowrap border-r border-indigo-100 px-3 py-2.5 text-xs text-slate-700 dark:border-indigo-500/15 dark:text-slate-300">
                        {FIELD_TYPE_LABELS[question.inputType]}
                      </td>
                      <td className="whitespace-nowrap border-r border-indigo-100 px-3 py-2.5 text-center dark:border-indigo-500/15">
                        {question.isRequired ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            Mandatory
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700/40 dark:text-slate-400">
                            Optional
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap border-r border-indigo-100 px-3 py-2.5 text-center dark:border-indigo-500/15">
                        {question.selfAssessmentEnabled ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700/40 dark:text-slate-400">
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap border-r border-indigo-100 px-3 py-2.5 text-center dark:border-indigo-500/15">
                        {question.hodAssessmentEnabled ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700/40 dark:text-slate-400">
                            Disabled
                          </span>
                        )}
                      </td>
                    </tr>
                    </Fragment>
                  );
                })
              )}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr className="bg-indigo-600 dark:bg-indigo-800/80">
                  <td colSpan={6} className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-indigo-50 dark:text-indigo-100">
                    Total
                  </td>
                  <td className="whitespace-nowrap border-r border-indigo-500/30 px-3 py-2.5 text-right tabular-nums text-sm font-bold text-indigo-50 dark:border-indigo-400/20 dark:text-indigo-100">
                    {allQuestions.reduce((sum, q) => sum + q.totalMarks, 0)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}
