"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchFormSubmission } from "@/lib/queries/form-submissions-client";
import {
  APPRAISAL_STATUS_LABELS,
  buildRootLayoutOrderFromRecord,
  type QuestionRecord,
} from "@/types/forms";
import type { EmployeeFormAnswerRecord } from "@/types/employee-forms";

interface SubmissionDetailViewProps {
  submissionId: number;
}

type TableRow = {
  sr: number;
  section: string;
  question: string;
  weight: number;
  scoreEarned: number;
  answerText: string | null;
};

function isScoredQuestion(question: {
  inputType: string;
  totalMarks: number;
}): boolean {
  return question.totalMarks > 0 && question.inputType === "NUMBER";
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

function buildRows(
  sections: Parameters<typeof buildRootLayoutOrderFromRecord>[0],
  rootQuestions: QuestionRecord[],
  allQuestions: QuestionRecord[],
  answerMap: Map<number, EmployeeFormAnswerRecord>,
): TableRow[] {
  const rootLayout = buildRootLayoutOrderFromRecord(sections, rootQuestions);
  const rows: TableRow[] = [];
  let sr = 0;

  const pushRow = (
    question: QuestionRecord,
    sectionLabel: string,
  ) => {
    sr += 1;
    const answer = answerMap.get(question.id);
    const scored = isScoredQuestion(question);

    rows.push({
      sr,
      section: sectionLabel,
      question: question.questionText,
      weight: question.totalMarks,
      scoreEarned: scored ? (answer?.pointsEarned ?? 0) : (answer?.pointsEarned ?? 0),
      answerText: scored ? null : getAnswerLabel(question, answer),
    });
  };

  if (rootLayout.length === 0) {
    allQuestions.forEach((question) => pushRow(question, "—"));
    return rows;
  }

  rootLayout.forEach((item) => {
    if (item.kind === "section") {
      const section = sections.find((current) => current.id === item.id);
      if (!section) return;

      section.subsections.forEach((subsection) => {
        const label = `${section.title} › ${subsection.title}`;
        subsection.questions.forEach((question) => pushRow(question, label));
      });

      section.questions.forEach((question) => pushRow(question, section.title));
      return;
    }

    const question = rootQuestions.find((current) => current.id === item.id);
    if (question) {
      pushRow(question, "—");
    }
  });

  return rows;
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
  const rows = buildRows(
    data.sections,
    data.rootQuestions,
    data.questions,
    answerMap,
  );

  const metaParts = [
    data.employeeName,
    data.employeeId ? `SAP ${data.employeeId}` : null,
    data.templateTitle,
    APPRAISAL_STATUS_LABELS[data.status],
    `Score ${data.rawScore}/${data.maxRawScore} (${data.scorePercent}%)`,
    data.performanceLevelName
      ? `${data.performanceLevelName}${data.quartileName ? ` · ${data.quartileName}` : ""}`
      : null,
    new Date(data.submittedAt).toLocaleString(),
  ].filter(Boolean);

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-2.5 dark:border-white/10">
        <p className="truncate text-xs leading-5 text-slate-600 dark:text-slate-300" title={metaParts.join(" · ")}>
          {metaParts.join(" · ")}
        </p>
      </div>

      <div className="w-full max-w-full overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/50">
              <th className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Sr Number
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Section
              </th>
              <th className="min-w-[280px] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Questions
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Weight
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Score Earned
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  No questions were found for this submission.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={`${row.sr}-${row.question}`}
                  className="align-top hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
                >
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">
                    {row.sr}
                  </td>
                  <td className="max-w-[220px] px-3 py-2.5 text-slate-700 dark:text-slate-300">
                    <span className="line-clamp-2" title={row.section}>
                      {row.section}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-900 dark:text-slate-100">
                    <p className="leading-snug">{row.question}</p>
                    {row.answerText ? (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Response: {row.answerText}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                    {row.weight}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums font-medium text-slate-900 dark:text-white">
                    {row.scoreEarned}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/50">
                <td
                  colSpan={3}
                  className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Total
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-sm font-semibold text-slate-900 dark:text-white">
                  {data.maxRawScore}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-sm font-semibold text-slate-900 dark:text-white">
                  {data.rawScore}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
