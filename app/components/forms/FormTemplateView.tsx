"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import type { FormTemplateRecord, QuestionRecord, FormSectionRecord, FormSubsectionRecord } from "@/types/forms";
import {
  CATEGORY_LABELS,
  buildRootLayoutOrderFromRecord,
  flattenAllQuestions,
  SUB_CATEGORY_LABELS,
} from "@/types/forms";

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
      <div className="flex flex-wrap items-start justify-between gap-4">
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

      <div className="grid gap-4 sm:grid-cols-3">
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/50">
                <th className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                  Sr. No.
                </th>
                <th className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                  Key Task / Function
                </th>
                <th className="min-w-[280px] border-r border-slate-200 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                  Key Performance Indicators (KPIs)
                </th>
                <th className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                  Weight
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Score Earned
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No questions defined.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const { question } = row;
                  return (
                    <tr key={question.id} className="align-top">
                      <td className="border-r border-slate-200 px-3 py-2.5 text-center tabular-nums text-slate-500 dark:border-white/10 dark:text-slate-400">
                        {row.sr}
                      </td>
                      {row.isFirstInSection ? (
                        <td
                          className="max-w-[220px] border-r border-slate-200 px-3 py-2.5 align-top text-slate-700 dark:border-white/10 dark:text-slate-300"
                          rowSpan={row.sectionRowCount}
                        >
                          {row.sectionTitle ? (
                            <span className="line-clamp-3" title={row.sectionTitle}>
                              {row.sectionTitle}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      ) : null}
                      <td className="border-r border-slate-200 px-3 py-2.5 text-slate-900 dark:border-white/10 dark:text-slate-100">
                        {row.subsectionTitle ? (
                          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                            {row.subsectionTitle}
                          </span>
                        ) : null}
                        <p className="max-w-[450px] break-words text-xs leading-snug">{question.questionText}</p>
                        {question.options.length > 0 ? (
                          <ul className="mt-1.5 space-y-0.5">
                            {question.options.map((option) => (
                              <li key={option.id} className="max-w-[400px] break-words text-[11px] text-slate-500 dark:text-slate-400">
                                • {option.optionLabel} ({option.pointsAssigned} pts)
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-right tabular-nums text-slate-700 dark:border-white/10 dark:text-slate-300">
                        {question.totalMarks}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-400">
                        —
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 dark:border-white/20 dark:bg-slate-950/50">
                  <td colSpan={3} className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Total
                  </td>
                  <td className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-right tabular-nums text-sm font-bold text-slate-900 dark:border-white/10 dark:text-white">
                    {allQuestions.reduce((sum, q) => sum + q.totalMarks, 0)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-sm font-bold text-slate-900 dark:text-white">
                    —
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
