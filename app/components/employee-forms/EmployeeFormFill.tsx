"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/app/components/auth/Button";
import {
  fetchEmployeeForm,
  saveEmployeeForm,
} from "@/lib/queries/employee-forms-client";
import type { EmployeeFormAnswerInput } from "@/types/employee-forms";
import { CATEGORY_LABELS, FIELD_TYPE_LABELS, flattenAllQuestions, SUB_CATEGORY_LABELS } from "@/types/forms";

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
        value.pointsEarned !== ""
          ? Number(value.pointsEarned)
          : undefined,
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

  const displayedRawScore = isReadOnly ? data?.rawScore ?? 0 : liveRawScore;

  const saveMutation = useMutation({
    mutationFn: (submit: boolean) =>
      saveEmployeeForm(templateId, {
        answers: toPayload(answers),
        submit,
      }),
    onSuccess: (result, submit) => {
      setFormError(null);
      setSuccessMessage(
        submit ? `Form submitted. Raw score: ${result.rawScore} / ${result.maxRawScore}.` : "Draft saved successfully.",
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
      <div className="rounded-xl border border-slate-300/80 p-8 text-sm text-foreground/70 dark:border-white/15">
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
  const allQuestions = flattenAllQuestions(template);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-300/80 bg-surface p-6 dark:border-white/15">
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
            <p className="mt-2 text-xs text-foreground/60">
              {CATEGORY_LABELS[template.targetCategory]} /{" "}
              {SUB_CATEGORY_LABELS[template.targetSubCategory]}
            </p>
          </div>
          <div className="rounded-xl border border-slate-300/80 px-4 py-3 text-right dark:border-white/15">
            <p className="text-xs text-foreground/70">Raw score</p>
            <p className="text-lg font-semibold text-text-primary">
              {displayedRawScore} / {maxRawScore}
            </p>
          </div>
        </div>
      </div>

      {formError ? (
        <p className="text-sm text-red-600">{formError}</p>
      ) : null}
      {successMessage ? (
        <p className="text-sm text-emerald-600">{successMessage}</p>
      ) : null}

      <div className="space-y-4">
        {allQuestions.map((question, index) => {
          const answer = answers[question.id] ?? {
            textResponse: "",
            selectedOptionId: "",
            pointsEarned: "",
          };

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
                {question.isRequired ? (
                  <span className="text-[11px] text-red-500">Required</span>
                ) : null}
                {question.totalMarks > 0 ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
                    Max {question.totalMarks} marks
                  </span>
                ) : null}
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm font-medium text-text-primary">
                {question.questionText}
              </p>

              <div className="mt-4">
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
                    className="h-11 w-full rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 dark:border-white/15"
                  />
                ) : null}

                {question.inputType === "TEXTAREA" ? (
                  <textarea
                    value={answer.textResponse}
                    disabled={isReadOnly}
                    rows={5}
                    onChange={(event) =>
                      updateAnswer(
                        question.id,
                        "textResponse",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 dark:border-white/15"
                  />
                ) : null}

                {isScoredQuestion(question) ? (
                  <div className="max-w-xs">
                    <label className="mb-1.5 block text-xs font-medium text-foreground/70">
                      Your score (max {question.totalMarks})
                    </label>
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
                      className="h-11 w-full rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 dark:border-white/15"
                      placeholder={`0 - ${question.totalMarks}`}
                    />
                  </div>
                ) : null}

                {["RADIO", "SELECT"].includes(question.inputType) ? (
                  <div className="space-y-2">
                    {question.options.map((option) => (
                      <label
                        key={option.id}
                        className="flex items-center gap-2 text-sm text-text-primary"
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={option.id}
                          checked={answer.selectedOptionId === String(option.id)}
                          disabled={isReadOnly}
                          onChange={() =>
                            updateAnswer(
                              question.id,
                              "selectedOptionId",
                              String(option.id),
                            )
                          }
                        />
                        <span>{option.optionLabel}</span>
                        <span className="text-xs text-foreground/60">
                          ({option.pointsAssigned} pts)
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}

                {question.inputType === "CHECKBOX" ? (
                  <div className="space-y-2">
                    {question.options.map((option) => (
                      <label
                        key={option.id}
                        className="flex items-center gap-2 text-sm text-text-primary"
                      >
                        <input
                          type="checkbox"
                          checked={answer.selectedOptionId === String(option.id)}
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
              </div>
            </div>
          );
        })}
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
        <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          This form was submitted
          {data.submittedAt
            ? ` on ${new Date(data.submittedAt).toLocaleString()}`
            : ""}
          . Raw score: {data.rawScore} / {data.maxRawScore}. It is now read-only.
        </div>
      )}
    </div>
  );
}
