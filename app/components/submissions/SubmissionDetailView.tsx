"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchFormSubmission } from "@/lib/queries/form-submissions-client";
import {
  APPRAISAL_STATUS_LABELS,
  buildRootLayoutOrderFromRecord,
  type FormSectionRecord,
  type FormSubsectionRecord,
  type QuestionRecord,
} from "@/types/forms";
import type { EmployeeFormAnswerRecord } from "@/types/employee-forms";

interface SubmissionDetailViewProps {
  submissionId: number;
}

function getAnswerLabel(
  question: QuestionRecord,
  answer: EmployeeFormAnswerRecord | undefined,
): string | null {
  if (answer?.textResponse?.trim()) {
    return answer.textResponse.trim();
  }

  if (answer?.selectedOptionId) {
    return (
      question.options.find((option) => option.id === answer.selectedOptionId)
        ?.optionLabel ?? `Option ${answer.selectedOptionId}`
    );
  }

  return null;
}

export default function SubmissionDetailView({
  submissionId,
}: SubmissionDetailViewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["form-submission", submissionId],
    queryFn: () => fetchFormSubmission(submissionId),
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-300/80 p-6 text-sm text-foreground/70 dark:border-white/15">
        Loading submission...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Failed to load submission.
      </div>
    );
  }

  const answerMap = new Map(
    data.answers.map((answer) => [answer.questionId, answer]),
  );
  const managerAnswerMap = new Map(
    data.managerAnswers.map((answer) => [answer.questionId, answer]),
  );
  const rootLayout = buildRootLayoutOrderFromRecord(
    data.sections,
    data.rootQuestions,
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
      const section = data.sections.find((s) => s.id === item.id);
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
      const question = data.rootQuestions.find((q) => q.id === item.id);
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

  const metaParts = [
    data.employeeName,
    data.employeeId ? `SAP ${data.employeeId}` : null,
    data.templateTitle,
    APPRAISAL_STATUS_LABELS[data.status],
    `Score ${data.rawScore}/${data.maxRawScore} (${data.scorePercent}%)`,
    data.performanceLevelName
      ? `${data.performanceLevelName}${data.quartileName ? ` · ${data.quartileName}` : ""}`
      : null,
    data.submittedAt ? new Date(data.submittedAt).toLocaleString() : null,
  ].filter(Boolean);

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-2.5 dark:border-white/10">
        <p className="truncate text-xs leading-5 text-slate-600 dark:text-slate-300" title={metaParts.join(" · ")}>
          {metaParts.join(" · ")}
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 text-xs text-slate-400 dark:border-white/10 dark:text-slate-500">
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
        Scroll horizontally to view all columns
      </div>
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
              <th className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                Self Assessed
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Manager Review
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No questions were found for this submission.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const { question } = row;
                const answer = answerMap.get(question.id);
                const managerAnswer = managerAnswerMap.get(question.id);
                const answerText = getAnswerLabel(question, answer);

                return (
                  <tr key={question.id} className="align-top hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
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
                      {answerText ? (
                        <p className="mt-1 max-w-[400px] break-words text-[11px] text-slate-500 dark:text-slate-400">
                          Response: {answerText}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-right tabular-nums text-slate-700 dark:border-white/10 dark:text-slate-300">
                      {question.totalMarks}
                    </td>
                    <td className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-right tabular-nums font-medium text-slate-900 dark:border-white/10 dark:text-white">
                      {answer?.pointsEarned ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums font-medium text-slate-900 dark:text-white">
                      {managerAnswer?.pointsEarned ?? 0}
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
                  {data.maxRawScore}
                </td>
                <td className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-right tabular-nums text-sm font-bold text-slate-900 dark:border-white/10 dark:text-white">
                  {data.answers.reduce((sum, a) => sum + a.pointsEarned, 0)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-sm font-bold text-slate-900 dark:text-white">
                  {data.managerAnswers.reduce((sum, a) => sum + a.pointsEarned, 0)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
