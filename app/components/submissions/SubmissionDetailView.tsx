"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchFormSubmission } from "@/lib/queries/form-submissions-client";
import {
  APPRAISAL_STATUS_LABELS,
  buildRootLayoutOrderFromRecord,
  type AppraisalStatus,
  type FormSectionRecord,
  type FormSubsectionRecord,
  type QuestionRecord,
} from "@/types/forms";
import type { EmployeeFormAnswerRecord } from "@/types/employee-forms";
import { cn } from "@/lib/utils";

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

  const statusStyles: Record<AppraisalStatus, string> = {
    PENDING_SELF_ASSESSMENT: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    PENDING_HEAD_REVIEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    PENDING_HR_CALIBRATION: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    PENDING_BOARD_APPROVAL: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    APPROVED: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
    COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  };

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden rounded-xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-200/50 dark:shadow-slate-900/30 bg-white dark:bg-slate-900">
      {/* Meta Header */}
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{data.employeeName}</span>
          {data.employeeId ? (
            <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              SAP {data.employeeId}
            </span>
          ) : null}
          <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", statusStyles[data.status])}>
            {APPRAISAL_STATUS_LABELS[data.status]}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{data.templateTitle}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-indigo-700 dark:text-indigo-300">
            Score {data.rawScore}/{data.maxRawScore} ({data.scorePercent}%)
          </span>
          {data.performanceLevelName ? (
            <span className="font-medium text-teal-700 dark:text-teal-300">
              {data.performanceLevelName}{data.quartileName ? ` · ${data.quartileName}` : ""}
            </span>
          ) : null}
          {data.submittedAt ? (
            <span className="text-slate-500 dark:text-slate-400">
              {new Date(data.submittedAt).toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-500">
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
        Scroll horizontally to view all columns
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-800 dark:bg-slate-950/80">
              <th className="whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200 dark:border-slate-700/50 dark:text-slate-300">
                Sr. No.
              </th>
              <th className="whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200 dark:border-slate-700/50 dark:text-slate-300">
                Key Task / Function
              </th>
              <th className="min-w-[280px] border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200 dark:border-slate-700/50 dark:text-slate-300">
                Key Performance Indicators (KPIs)
              </th>
              <th className="whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200 dark:border-slate-700/50 dark:text-slate-300">
                Weight
              </th>
              <th className="whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-teal-300 dark:border-slate-700/50 dark:text-teal-400">
                Self Assessed
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wider text-violet-300 dark:text-violet-400">
                Manager Review
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30">
                  No questions were found for this submission.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIdx) => {
                const { question } = row;
                const answer = answerMap.get(question.id);
                const managerAnswer = managerAnswerMap.get(question.id);
                const answerText = getAnswerLabel(question, answer);
                const isEvenRow = rowIdx % 2 === 0;

                return (
                  <tr key={question.id} className={cn(
                    "align-top border-b border-slate-100 dark:border-slate-700/40",
                    isEvenRow
                      ? "bg-white dark:bg-slate-900/40"
                      : "bg-slate-50/60 dark:bg-slate-800/20"
                  )}>
                    <td className="border-r border-slate-100 px-3 py-2.5 text-center tabular-nums text-slate-500 dark:border-slate-700/40 dark:text-slate-400">
                      {row.sr}
                    </td>
                    {row.isFirstInSection ? (
                      <td
                        className="max-w-[220px] border-r border-slate-100 px-3 py-2.5 align-top bg-amber-50/80 dark:bg-amber-950/20 dark:border-slate-700/40"
                        rowSpan={row.sectionRowCount}
                      >
                        {row.sectionTitle ? (
                          <span className="line-clamp-3 font-semibold text-amber-800 dark:text-amber-200" title={row.sectionTitle}>
                            {row.sectionTitle}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    ) : null}
                    <td className="border-r border-slate-100 px-3 py-2.5 dark:border-slate-700/40">
                      {row.subsectionTitle ? (
                        <span className="mb-1 block text-xs font-medium text-amber-600 dark:text-amber-400/70">
                          {row.subsectionTitle}
                        </span>
                      ) : null}
                      <p className="max-w-[450px] break-words text-xs leading-snug text-slate-800 dark:text-slate-200">{question.questionText}</p>
                      {answerText ? (
                        <p className="mt-1 max-w-[400px] break-words text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-600 dark:text-slate-300">Response:</span> {answerText}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right tabular-nums font-semibold text-slate-700 dark:border-slate-700/40 dark:text-slate-300">
                      {question.totalMarks}
                    </td>
                    <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right tabular-nums font-bold text-teal-700 dark:border-slate-700/40 dark:text-teal-300">
                      {answer?.pointsEarned ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums font-bold text-violet-700 dark:text-violet-300">
                      {managerAnswer?.pointsEarned ?? 0}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="bg-slate-800 dark:bg-slate-950/80">
                <td colSpan={3} className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-200 dark:text-slate-300">
                  Total
                </td>
                <td className="whitespace-nowrap border-r border-slate-700 px-3 py-2.5 text-right tabular-nums text-sm font-bold text-slate-100 dark:border-slate-700/50 dark:text-slate-200">
                  {data.maxRawScore}
                </td>
                <td className="whitespace-nowrap border-r border-slate-700 px-3 py-2.5 text-right tabular-nums text-sm font-bold text-teal-300 dark:border-slate-700/50 dark:text-teal-400">
                  {data.answers.reduce((sum, a) => sum + a.pointsEarned, 0)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-sm font-bold text-violet-300 dark:text-violet-400">
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
