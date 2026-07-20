"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import type { FormTemplateRecord, QuestionRecord, FormSectionRecord, FormSubsectionRecord, FieldType } from "@/types/forms";
import {
  CATEGORY_LABELS,
  buildRootLayoutOrderFromRecord,
  flattenAllQuestions,
  SUB_CATEGORY_LABELS,
} from "@/types/forms";
import { cn } from "@/lib/utils";

interface FormTemplateViewProps {
  template: FormTemplateRecord;
}

export default function FormTemplateView({ template }: FormTemplateViewProps) {
  const allQuestions = flattenAllQuestions(template);
  const rootLayout = buildRootLayoutOrderFromRecord(
    template.sections,
    template.questions,
  );

  type TableRow = {
    sr: number;
    sectionTitle: string | null;
    subsectionTitle: string | null;
    question: QuestionRecord;
    isFirstInSection: boolean;
    sectionRowCount: number;
  };

  const rows: TableRow[] = [];
  let sr = 0;

  const collectQuestions = (
    section: FormSectionRecord,
    subsection: FormSubsectionRecord | null,
  ) => {
    const questions = subsection ? subsection.questions : section.questions;
    const startIdx = rows.length;
    questions.forEach((question) => {
      sr += 1;
      rows.push({
        sr,
        sectionTitle: section.title,
        subsectionTitle: subsection?.title ?? null,
        question,
        isFirstInSection: false,
        sectionRowCount: 0,
      });
    });
    if (rows.length > startIdx) {
      rows[startIdx].isFirstInSection = true;
      for (let i = startIdx; i < rows.length; i++) {
        rows[i].sectionRowCount = rows.length - startIdx;
      }
    }
  };

  rootLayout.forEach((item) => {
    if (item.kind === "section") {
      const section = template.sections.find((s) => s.id === item.id);
      if (!section) return;
      const startIdx = rows.length;
      section.subsections.forEach((sub) => collectQuestions(section, sub));
      collectQuestions(section, null);
      if (rows.length > startIdx) {
        rows[startIdx].isFirstInSection = true;
        for (let i = startIdx; i < rows.length; i++) {
          rows[i].sectionRowCount = rows.length - startIdx;
        }
      }
    } else {
      const question = template.questions.find((q) => q.id === item.id);
      if (question) {
        sr += 1;
        rows.push({
          sr,
          sectionTitle: null,
          subsectionTitle: null,
          question,
          isFirstInSection: true,
          sectionRowCount: 1,
        });
      }
    }
  });

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            {template.title}
          </h2>
          {template.description ? (
            <p className="mt-1 text-sm text-foreground/70">
              {template.description}
            </p>
          ) : null}
        </div>

        <Link
          href={`/dashboard/forms/${template.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
        >
          <Pencil className="size-3.5" />
          Edit Form
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 no-print">
        <div className="rounded-xl border border-slate-300/80 bg-surface p-4 dark:border-white/15">
          <p className="text-xs font-medium text-foreground/70">Category</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {CATEGORY_LABELS[template.targetCategory]}
          </p>
          <p className="text-xs text-foreground/70">
            {SUB_CATEGORY_LABELS[template.targetSubCategory]}
          </p>
        </div>
        <div className="rounded-xl border border-slate-300/80 bg-surface p-4 dark:border-white/15">
          <p className="text-xs font-medium text-foreground/70">Appraisal Cycle</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            FY {template.fiscalYear}
          </p>
        </div>
        <div className="rounded-xl border border-slate-300/80 bg-surface p-4 dark:border-white/15">
          <p className="text-xs font-medium text-foreground/70">Questions</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {allQuestions.length}
          </p>
        </div>
      </div>

      <div className="my-6">
        <div className="rounded-lg border border-indigo-200 dark:border-indigo-500/30 overflow-hidden shadow-sm shadow-indigo-100/40 dark:shadow-indigo-900/10">
          <table className="w-full">
            <thead>
              <tr className="bg-indigo-600 dark:bg-indigo-800/80">
                <th className="whitespace-nowrap border-r border-indigo-500/30 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-50 dark:border-indigo-400/20 dark:text-indigo-100">
                  Sr. No.
                </th>
                <th className="whitespace-nowrap border-r border-indigo-500/30 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-50 dark:border-indigo-400/20 dark:text-indigo-100">
                  Key Task / Function
                </th>
                <th className="min-w-[280px] border-r border-indigo-500/30 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-50 dark:border-indigo-400/20 dark:text-indigo-100">
                  Key Performance Indicators (KPIs)
                </th>
                <th className="whitespace-nowrap border-r border-indigo-500/30 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-50 dark:border-indigo-400/20 dark:text-indigo-100">
                  Weight
                </th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-indigo-400 dark:text-indigo-400/70 bg-indigo-50/50 dark:bg-indigo-950/20">
                    No questions defined.
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIdx) => {
                  const { question } = row;
                  const isEvenRow = rowIdx % 2 === 0;
                  return (
                    <tr key={question.id} className={cn(
                      "align-top border-b border-indigo-100 dark:border-indigo-500/15",
                      isEvenRow
                        ? "bg-white dark:bg-slate-900/40"
                        : "bg-indigo-50/40 dark:bg-indigo-950/20"
                    )}>
                      <td className="border-r border-indigo-100 px-3 py-2.5 text-center tabular-nums text-indigo-600 dark:border-indigo-500/15 dark:text-indigo-300">
                        {row.sr}
                      </td>
                      {row.isFirstInSection ? (
                        <td
                          className="max-w-[220px] border-r border-indigo-100 px-3 py-2.5 align-top bg-indigo-100/60 dark:bg-indigo-900/30 dark:border-indigo-500/15 print-section-cell"
                          rowSpan={row.sectionRowCount}
                        >
                          {row.sectionTitle ? (
                            <span className="line-clamp-3 font-medium text-indigo-800 dark:text-indigo-200" title={row.sectionTitle}>
                              {row.sectionTitle}
                            </span>
                          ) : (
                            <span className="text-indigo-300 dark:text-indigo-600">—</span>
                          )}
                        </td>
                      ) : null}
                      <td className="border-r border-indigo-100 px-3 py-2.5 dark:border-indigo-500/15">
                        {row.subsectionTitle ? (
                          <span className="mb-1 block text-xs font-medium text-indigo-500 dark:text-indigo-400/70">
                            {row.subsectionTitle}
                          </span>
                        ) : null}
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
                    </tr>
                  );
                })
              )}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr className="bg-indigo-600 dark:bg-indigo-800/80">
                  <td colSpan={3} className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-indigo-50 dark:text-indigo-100">
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
