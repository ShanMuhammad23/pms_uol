"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchFormSubmission } from "@/lib/queries/form-submissions-client";
import {
  APPRAISAL_STATUS_LABELS,
  buildRootLayoutOrderFromRecord,
  type QuestionRecord,
} from "@/types/forms";
import type { EmployeeFormAnswerRecord } from "@/types/employee-forms";
import { cn } from "@/lib/utils";

interface SubmissionDetailViewProps {
  submissionId: number;
}

function isScoredQuestion(question: {
  inputType: string;
  totalMarks: number;
}): boolean {
  return question.totalMarks > 0 && question.inputType === "NUMBER";
}

function formatAnswer(
  question: QuestionRecord,
  answer: EmployeeFormAnswerRecord | undefined,
): string {
  if (isScoredQuestion(question)) {
    return `${answer?.pointsEarned ?? 0} / ${question.totalMarks}`;
  }

  if (answer?.textResponse?.trim()) {
    return answer.textResponse.trim();
  }

  if (answer?.selectedOptionId) {
    return (
      question.options.find((option) => option.id === answer.selectedOptionId)
        ?.optionLabel ?? `Option ${answer.selectedOptionId}`
    );
  }

  return "No response provided";
}

function DocumentQuestion({
  index,
  question,
  answer,
}: {
  index: number;
  question: QuestionRecord;
  answer: EmployeeFormAnswerRecord | undefined;
}) {
  const scored = isScoredQuestion(question);
  const answerText = formatAnswer(question, answer);

  return (
    <div className="break-inside-avoid">
      <p className="text-[15px] font-medium leading-relaxed text-slate-900 dark:text-slate-100">
        <span className="mr-2 text-slate-500 dark:text-slate-400">{index}.</span>
        {question.questionText}
      </p>
      <div
        className={cn(
          "mt-2 border-l-2 pl-4 text-[15px] leading-relaxed",
          answerText === "No response provided"
            ? "border-slate-200 italic text-slate-400 dark:border-white/10 dark:text-slate-500"
            : "border-amber-500/40 text-slate-700 dark:border-amber-500/30 dark:text-slate-300",
        )}
      >
        {scored ? (
          <p>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              Score:{" "}
            </span>
            {answerText}
          </p>
        ) : (
          <p className="whitespace-pre-wrap">{answerText}</p>
        )}
      </div>
    </div>
  );
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
  const rootLayout = buildRootLayoutOrderFromRecord(
    data.sections,
    data.rootQuestions,
  );
  let questionCounter = 0;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
      <header className="border-b border-slate-200 bg-slate-50/80 px-8 py-7 dark:border-white/10 dark:bg-slate-950/40">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Performance Appraisal Submission
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {data.templateTitle ?? "Submitted Form"}
        </h2>
        {data.templateDescription ? (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {data.templateDescription}
          </p>
        ) : null}

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Employee
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {data.employeeName}
            </dd>
            <dd className="text-xs text-slate-500 dark:text-slate-400">
              {data.employeeEmail}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Submitted
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {new Date(data.submittedAt).toLocaleString()}
            </dd>
            <dd className="text-xs text-slate-500 dark:text-slate-400">
              {APPRAISAL_STATUS_LABELS[data.status]}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Raw Score
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {data.rawScore} / {data.maxRawScore}
            </dd>
            <dd className="text-xs text-slate-500 dark:text-slate-400">
              {data.scorePercent}%
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Performance
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {data.performanceLevelName ?? "—"}
            </dd>
            <dd className="text-xs text-slate-500 dark:text-slate-400">
              {data.quartileName ?? "No matching quartile"}
              {data.quartileScoreMin !== null && data.quartileScoreMax !== null
                ? ` (${data.quartileScoreMin}–${data.quartileScoreMax}%)`
                : ""}
            </dd>
          </div>
        </dl>
      </header>

      <div className="px-8 py-8">
        {rootLayout.length > 0 ? (
          <div className="space-y-8">
            {rootLayout.map((item) => {
              if (item.kind === "section") {
                const section = data.sections.find(
                  (currentSection) => currentSection.id === item.id,
                );

                if (!section) {
                  return null;
                }

                return (
                  <section key={section.id} className="space-y-6">
                    <h3 className="border-b border-slate-200 pb-2 text-lg font-semibold text-slate-900 dark:border-white/10 dark:text-white">
                      {section.title}
                    </h3>

                    {section.subsections.map((subsection) => (
                      <div key={subsection.id} className="space-y-5">
                        <h4 className="text-base font-medium text-slate-800 dark:text-slate-200">
                          {subsection.title}
                        </h4>
                        <div className="space-y-6">
                          {subsection.questions.map((question) => {
                            questionCounter += 1;

                            return (
                              <DocumentQuestion
                                key={question.id}
                                index={questionCounter}
                                question={question}
                                answer={answerMap.get(question.id)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {section.questions.length > 0 ? (
                      <div className="space-y-6">
                        {section.questions.map((question) => {
                          questionCounter += 1;

                          return (
                            <DocumentQuestion
                              key={question.id}
                              index={questionCounter}
                              question={question}
                              answer={answerMap.get(question.id)}
                            />
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                );
              }

              const question = data.rootQuestions.find(
                (currentQuestion) => currentQuestion.id === item.id,
              );

              if (!question) {
                return null;
              }

              questionCounter += 1;

              return (
                <DocumentQuestion
                  key={question.id}
                  index={questionCounter}
                  question={question}
                  answer={answerMap.get(question.id)}
                />
              );
            })}
          </div>
        ) : (
          <div className="space-y-6">
            {data.questions.map((question, index) => (
              <DocumentQuestion
                key={question.id}
                index={index + 1}
                question={question}
                answer={answerMap.get(question.id)}
              />
            ))}
          </div>
        )}

        {data.questions.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No questions were found for this submission.
          </p>
        ) : null}
      </div>
    </article>
  );
}
