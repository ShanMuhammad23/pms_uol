"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/app/components/auth/Button";
import {
  fetchEmployeeForm,
  saveEmployeeForm,
} from "@/lib/queries/employee-forms-client";
import type { EmployeeFormAnswerInput } from "@/types/employee-forms";
import {
  buildRootLayoutOrderFromRecord,
  CATEGORY_LABELS,
  flattenAllQuestions,
  SUB_CATEGORY_LABELS,
  type QuestionRecord,
} from "@/types/forms";

interface EmployeeFormFillProps {
  templateId: number;
}

type AnswerState = Record<
  number,
  {
    textResponse: string;
    selectedOptionId: string;
    pointsEarned: string;
  }
>;

type FormRow = {
  sr: number;
  section: string;
  question: QuestionRecord;
};

function buildInitialAnswers(
  questions: Array<{ id: number }>,
  existingAnswers: Array<{
    questionId: number;
    textResponse: string | null;
    selectedOptionId: number | null;
    pointsEarned: number;
  }>,
): AnswerState {
  const map: AnswerState = {};

  for (const question of questions) {
    map[question.id] = {
      textResponse: "",
      selectedOptionId: "",
      pointsEarned: "",
    };
  }

  for (const answer of existingAnswers) {
    map[answer.questionId] = {
      textResponse: answer.textResponse ?? "",
      selectedOptionId: answer.selectedOptionId
        ? String(answer.selectedOptionId)
        : "",
      pointsEarned:
        answer.pointsEarned > 0
          ? String(answer.pointsEarned)
          : answer.textResponse ?? "",
    };
  }

  return map;
}

function toPayload(answers: AnswerState): EmployeeFormAnswerInput[] {
  return Object.entries(answers)
    .map(([questionId, value]) => ({
      questionId: Number(questionId),
      textResponse: value.textResponse.trim() || null,
      selectedOptionId: value.selectedOptionId
        ? Number(value.selectedOptionId)
        : null,
      pointsEarned:
        value.pointsEarned !== "" ? Number(value.pointsEarned) : undefined,
    }))
    .filter(
      (answer) =>
        answer.textResponse ||
        answer.selectedOptionId ||
        answer.pointsEarned !== undefined,
    );
}

function clampScore(value: string, maxMarks: number): string {
  if (value === "") {
    return "";
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return value;
  }

  if (numeric < 0) {
    return "0";
  }

  if (numeric > maxMarks) {
    return String(maxMarks);
  }

  return value;
}

function isScoredQuestion(question: {
  inputType: string;
  totalMarks: number;
}): boolean {
  return question.totalMarks > 0 && question.inputType === "NUMBER";
}

function buildFormRows(
  sections: Parameters<typeof buildRootLayoutOrderFromRecord>[0],
  rootQuestions: QuestionRecord[],
  allQuestions: QuestionRecord[],
): FormRow[] {
  const rootLayout = buildRootLayoutOrderFromRecord(sections, rootQuestions);
  const rows: FormRow[] = [];
  let sr = 0;

  const pushRow = (question: QuestionRecord, section: string) => {
    sr += 1;
    rows.push({ sr, section, question });
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

export default function EmployeeFormFill({ templateId }: EmployeeFormFillProps) {
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<AnswerState>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-form", templateId],
    queryFn: () => fetchEmployeeForm(templateId),
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    setAnswers(
      buildInitialAnswers(flattenAllQuestions(data.template), data.answers),
    );
  }, [data]);

  const isReadOnly = data?.status === "SUBMITTED";
  const maxRawScore = data?.maxRawScore ?? 0;

  const liveRawScore = useMemo(() => {
    if (!data) {
      return 0;
    }

    return flattenAllQuestions(data.template)
      .filter(isScoredQuestion)
      .reduce((sum, question) => {
        const answer = answers[question.id];
        if (!answer || answer.pointsEarned === "") {
          return sum;
        }

        const score = Number(answer.pointsEarned);
        return sum + (Number.isNaN(score) ? 0 : score);
      }, 0);
  }, [answers, data]);

  const displayedRawScore = isReadOnly ? (data?.rawScore ?? 0) : liveRawScore;

  const saveMutation = useMutation({
    mutationFn: (submit: boolean) =>
      saveEmployeeForm(templateId, {
        answers: toPayload(answers),
        submit,
      }),
    onSuccess: (result, submit) => {
      setFormError(null);
      setSuccessMessage(
        submit
          ? `Form submitted. Raw score: ${result.rawScore} / ${result.maxRawScore}.`
          : "Draft saved successfully.",
      );
      queryClient.setQueryData(["my-form", templateId], result);
      queryClient.invalidateQueries({ queryKey: ["my-forms"] });
    },
    onError: (mutationError: Error) => {
      setSuccessMessage(null);
      setFormError(mutationError.message);
    },
  });

  const updateAnswer = (
    questionId: number,
    field: keyof AnswerState[number],
    value: string,
  ) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        ...current[questionId],
        [field]: value,
      },
    }));
  };

  const updateScore = (questionId: number, maxMarks: number, value: string) => {
    updateAnswer(questionId, "pointsEarned", clampScore(value, maxMarks));
  };

  const validateBeforeSubmit = (): string | null => {
    if (!data) {
      return null;
    }

    for (const question of flattenAllQuestions(data.template)) {
      if (!isScoredQuestion(question)) {
        continue;
      }

      const answer = answers[question.id];
      if (!answer || answer.pointsEarned === "") {
        return `Enter a score for question ${question.questionText.slice(0, 60)}...`;
      }

      const score = Number(answer.pointsEarned);
      if (Number.isNaN(score) || score < 0 || score > question.totalMarks) {
        return `Score must be between 0 and ${question.totalMarks} for "${question.questionText.slice(0, 60)}..."`;
      }
    }

    return null;
  };

  const handleSave = (submit: boolean) => {
    setFormError(null);
    setSuccessMessage(null);

    if (submit) {
      const validationError = validateBeforeSubmit();
      if (validationError) {
        setFormError(validationError);
        return;
      }
    }

    saveMutation.mutate(submit);
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-300/80 p-6 text-sm text-foreground/70 dark:border-white/15">
        Loading form...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Failed to load this form.
      </div>
    );
  }

  const { template } = data;
  const rows = buildFormRows(
    template.sections,
    template.questions,
    flattenAllQuestions(template),
  );

  const metaParts = [
    template.title,
    `${CATEGORY_LABELS[template.targetCategory]} / ${SUB_CATEGORY_LABELS[template.targetSubCategory]}`,
    `Score ${displayedRawScore}/${maxRawScore}`,
    data.status === "SUBMITTED"
      ? `Submitted${data.submittedAt ? ` ${new Date(data.submittedAt).toLocaleString()}` : ""}`
      : data.status === "DRAFT"
        ? "Draft"
        : "Not started",
  ].filter(Boolean);

  const inputClassName =
    "h-9 w-full rounded-md border border-slate-300 bg-background px-2.5 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 dark:border-white/15";

  return (
    <div className="min-w-0 max-w-full space-y-3 overflow-x-hidden">
      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      {successMessage ? (
        <p className="text-sm text-emerald-600">{successMessage}</p>
      ) : null}

      <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-2.5 dark:border-white/10">
          <p
            className="truncate text-xs leading-5 text-slate-600 dark:text-slate-300"
            title={metaParts.join(" · ")}
          >
            {metaParts.join(" · ")}
          </p>
        </div>

        <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
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
                <th className="min-w-[140px] whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                    No questions were found for this form.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const { question } = row;
                  const answer = answers[question.id] ?? {
                    textResponse: "",
                    selectedOptionId: "",
                    pointsEarned: "",
                  };
                  const scored = isScoredQuestion(question);

                  return (
                    <tr key={question.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">
                        {row.sr}
                      </td>
                      <td className="max-w-[220px] px-3 py-2.5 text-slate-700 dark:text-slate-300">
                        <span className="line-clamp-2" title={row.section}>
                          {row.section}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-900 dark:text-slate-100">
                        <p className="leading-snug">{question.questionText}</p>

                        {question.inputType === "TEXT" ? (
                          <input
                            type="text"
                            value={answer.textResponse}
                            disabled={isReadOnly}
                            onChange={(event) =>
                              updateAnswer(
                                question.id,
                                "textResponse",
                                event.target.value,
                              )
                            }
                            className={`${inputClassName} mt-2`}
                            placeholder="Your response"
                          />
                        ) : null}

                        {question.inputType === "TEXTAREA" ? (
                          <textarea
                            value={answer.textResponse}
                            disabled={isReadOnly}
                            rows={3}
                            onChange={(event) =>
                              updateAnswer(
                                question.id,
                                "textResponse",
                                event.target.value,
                              )
                            }
                            className="mt-2 w-full rounded-md border border-slate-300 bg-background px-2.5 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 dark:border-white/15"
                            placeholder="Your response"
                          />
                        ) : null}

                        {["RADIO", "SELECT"].includes(question.inputType) ? (
                          <div className="mt-2 space-y-1.5">
                            {question.options.map((option) => (
                              <label
                                key={option.id}
                                className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300"
                              >
                                <input
                                  type="radio"
                                  name={`question-${question.id}`}
                                  value={option.id}
                                  checked={
                                    answer.selectedOptionId === String(option.id)
                                  }
                                  disabled={isReadOnly}
                                  onChange={() =>
                                    updateAnswer(
                                      question.id,
                                      "selectedOptionId",
                                      String(option.id),
                                    )
                                  }
                                />
                                <span>
                                  {option.optionLabel}
                                  {option.pointsAssigned > 0
                                    ? ` (${option.pointsAssigned} pts)`
                                    : ""}
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : null}

                        {question.inputType === "CHECKBOX" ? (
                          <div className="mt-2 space-y-1.5">
                            {question.options.map((option) => (
                              <label
                                key={option.id}
                                className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    answer.selectedOptionId === String(option.id)
                                  }
                                  disabled={isReadOnly}
                                  onChange={() =>
                                    updateAnswer(
                                      question.id,
                                      "selectedOptionId",
                                      answer.selectedOptionId === String(option.id)
                                        ? ""
                                        : String(option.id),
                                    )
                                  }
                                />
                                <span>{option.optionLabel}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {question.totalMarks}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {scored ? (
                          <input
                            type="number"
                            min={0}
                            max={question.totalMarks}
                            step="0.5"
                            value={answer.pointsEarned}
                            disabled={isReadOnly}
                            onChange={(event) =>
                              updateScore(
                                question.id,
                                question.totalMarks,
                                event.target.value,
                              )
                            }
                            onBlur={(event) =>
                              updateScore(
                                question.id,
                                question.totalMarks,
                                event.target.value,
                              )
                            }
                            className={`${inputClassName} ml-auto max-w-[120px] text-right tabular-nums`}
                            placeholder={`0–${question.totalMarks}`}
                          />
                        ) : (
                          <span className="tabular-nums text-slate-400">
                            {answer.pointsEarned || "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
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
                    {maxRawScore}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-sm font-semibold text-slate-900 dark:text-white">
                    {displayedRawScore}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      {!isReadOnly ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="!w-auto px-5"
            isLoading={saveMutation.isPending}
            onClick={() => handleSave(false)}
          >
            Save Draft
          </Button>
          <Button
            type="button"
            className="!w-auto px-5"
            isLoading={saveMutation.isPending}
            onClick={() => handleSave(true)}
          >
            Submit Form
          </Button>
        </div>
      ) : (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          Submitted
          {data.submittedAt
            ? ` on ${new Date(data.submittedAt).toLocaleString()}`
            : ""}
          · read-only · score {data.rawScore}/{data.maxRawScore}
        </p>
      )}
    </div>
  );
}
