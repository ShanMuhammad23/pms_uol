"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchFormSubmission } from "@/lib/queries/form-submissions-client";
import { APPRAISAL_STATUS_LABELS, FIELD_TYPE_LABELS } from "@/types/forms";

interface SubmissionDetailViewProps {
  submissionId: number;
}

function isScoredQuestion(question: {
  inputType: string;
  totalMarks: number;
}): boolean {
  return question.totalMarks > 0 && question.inputType === "NUMBER";
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
      <div className="rounded-xl border border-slate-300/80 p-8 text-sm text-foreground/70 dark:border-white/15">
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-300/80 bg-surface p-4 dark:border-white/15">
          <p className="text-xs font-medium text-foreground/70">Employee</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {data.employeeName}
          </p>
          <p className="text-xs text-foreground/70">{data.employeeEmail}</p>
        </div>
        <div className="rounded-xl border border-slate-300/80 bg-surface p-4 dark:border-white/15">
          <p className="text-xs font-medium text-foreground/70">Form</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {data.templateTitle ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-300/80 bg-surface p-4 dark:border-white/15">
          <p className="text-xs font-medium text-foreground/70">Raw Score</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {data.rawScore} / {data.maxRawScore}
          </p>
          <p className="text-xs text-foreground/70">{data.scorePercent}%</p>
        </div>
        <div className="rounded-xl border border-slate-300/80 bg-surface p-4 dark:border-white/15">
          <p className="text-xs font-medium text-foreground/70">Performance</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {data.performanceLevelName ?? "—"}
          </p>
          <p className="text-xs text-foreground/70">
            {data.quartileName ?? "No matching quartile"}
            {data.quartileScoreMin !== null && data.quartileScoreMax !== null
              ? ` (${data.quartileScoreMin}–${data.quartileScoreMax}%)`
              : ""}
          </p>
        </div>
        <div className="rounded-xl border border-slate-300/80 bg-surface p-4 dark:border-white/15">
          <p className="text-xs font-medium text-foreground/70">Status</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {APPRAISAL_STATUS_LABELS[data.status]}
          </p>
          <p className="text-xs text-foreground/70">
            {new Date(data.submittedAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Responses</h3>
        {data.questions.map((question, index) => {
          const answer = answerMap.get(question.id);
          const scored = isScoredQuestion(question);

          return (
            <div
              key={question.id}
              className="rounded-xl border border-slate-300/80 bg-surface p-5 dark:border-white/15"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-primary">
                  Q{index + 1}
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {FIELD_TYPE_LABELS[question.inputType]}
                </span>
                {scored ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
                    Max {question.totalMarks} marks
                  </span>
                ) : null}
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm font-medium text-text-primary">
                {question.questionText}
              </p>

              <div className="mt-4 rounded-lg border border-slate-300/60 bg-background px-4 py-3 text-sm dark:border-white/10">
                {scored ? (
                  <p className="text-text-primary">
                    <span className="font-medium">Score:</span>{" "}
                    {answer?.pointsEarned ?? 0} / {question.totalMarks}
                  </p>
                ) : answer?.textResponse ? (
                  <p className="whitespace-pre-wrap text-text-primary">
                    {answer.textResponse}
                  </p>
                ) : answer?.selectedOptionId ? (
                  <p className="text-text-primary">
                    {question.options.find(
                      (option) => option.id === answer.selectedOptionId,
                    )?.optionLabel ?? `Option ${answer.selectedOptionId}`}
                  </p>
                ) : (
                  <p className="text-foreground/60">No response</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
