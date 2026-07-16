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
  type FormSectionRecord,
  type FormSubsectionRecord,
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
  const rootLayout = buildRootLayoutOrderFromRecord(
    template.sections,
    template.questions,
  );

  type TableRow = {
    sr: number;
    sectionTitle: string;
    sectionNumber: number | null;
    subsectionTitle: string | null;
    question: QuestionRecord;
    isFirstInSection: boolean;
    sectionRowCount: number;
  };

  const rows: TableRow[] = [];
  let sr = 0;
  let sectionNumber = 0;

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
        sectionNumber: null,
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
      sectionNumber += 1;
      const startIdx = rows.length;
      section.subsections.forEach((sub) => collectQuestions(section, sub));
      collectQuestions(section, null);
      if (rows.length > startIdx) {
        rows[startIdx].isFirstInSection = true;
        rows[startIdx].sectionNumber = sectionNumber;
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
          sectionTitle: "—",
          sectionNumber: null,
          subsectionTitle: null,
          question,
          isFirstInSection: true,
          sectionRowCount: 1,
        });
      }
    }
  });

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
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      {successMessage ? (
        <p className="text-sm text-emerald-600">{successMessage}</p>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-slate-900">
        <p
          className="truncate text-xs leading-5 text-slate-600 dark:text-slate-300"
          title={metaParts.join(" · ")}
        >
          {metaParts.join(" · ")}
        </p>
      </div>

      <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
        <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/50">
                <th className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400" rowSpan={2}>
                  Sr. No.
                </th>
                <th className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400" rowSpan={2}>
                  Key Task / Function
                </th>
                <th className="min-w-[280px] border-r border-slate-200 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400" rowSpan={2}>
                  Key Performance Indicators (KPIs)
                </th>
                <th className="border-r border-slate-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400" colSpan={2}>
                  Faculty&apos;s Performance
                </th>
                <th className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400" rowSpan={2}>
                  Weight
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400" rowSpan={2}>
                  Score Earned
                </th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/50">
                <th className="border-r border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                  Previous Year
                </th>
                <th className="border-r border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                  Current Year
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
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
                      {row.isFirstInSection ? (
                        <>
                          <td
                            className="border-r border-slate-200 px-3 py-2.5 text-center align-top font-semibold text-slate-700 dark:border-white/10 dark:text-slate-300"
                            rowSpan={row.sectionRowCount}
                          >
                            {row.sectionNumber ?? ""}
                          </td>
                          <td
                            className="max-w-[200px] border-r border-slate-200 px-3 py-2.5 align-top text-slate-700 dark:border-white/10 dark:text-slate-300"
                            rowSpan={row.sectionRowCount}
                          >
                            <span className="line-clamp-3" title={row.sectionTitle}>
                              {row.sectionTitle}
                            </span>
                          </td>
                        </>
                      ) : null}
                      <td className="border-r border-slate-200 px-3 py-2.5 text-slate-900 dark:border-white/10 dark:text-slate-100">
                        {row.subsectionTitle ? (
                          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                            {row.subsectionTitle}
                          </span>
                        ) : null}
                        <p className="text-xs leading-snug">{question.questionText}</p>
                        {question.options.length > 0 ? (
                          <div className="mt-1.5 space-y-1">
                            {question.options.map((option) => (
                              <label key={option.id} className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                                <input
                                  type="radio"
                                  name={`question-${question.id}`}
                                  value={option.id}
                                  checked={answer.selectedOptionId === String(option.id)}
                                  disabled={isReadOnly}
                                  onChange={() => updateAnswer(question.id, "selectedOptionId", String(option.id))}
                                />
                                <span>{option.optionLabel}{option.pointsAssigned > 0 ? ` (${option.pointsAssigned} pts)` : ""}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="border-r border-slate-200 px-2 py-2.5 dark:border-white/10">
                        <input
                          type="text"
                          value=""
                          disabled
                          className="h-8 w-full rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-400 dark:border-white/10 dark:bg-slate-800/50"
                          placeholder="—"
                        />
                      </td>
                      <td className="border-r border-slate-200 px-2 py-2.5 dark:border-white/10">
                        {question.inputType === "TEXTAREA" ? (
                          <textarea
                            value={answer.textResponse}
                            disabled={isReadOnly}
                            rows={2}
                            onChange={(e) => updateAnswer(question.id, "textResponse", e.target.value)}
                            className="w-full rounded border border-slate-300 bg-background px-2 py-1 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 dark:border-white/15"
                            placeholder="Enter performance"
                          />
                        ) : (
                          <input
                            type="text"
                            value={answer.textResponse}
                            disabled={isReadOnly}
                            onChange={(e) => updateAnswer(question.id, "textResponse", e.target.value)}
                            className="h-8 w-full rounded border border-slate-300 bg-background px-2 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 dark:border-white/15"
                            placeholder="Enter performance"
                          />
                        )}
                      </td>
                      <td className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-right tabular-nums text-slate-700 dark:border-white/10 dark:text-slate-300">
                        {question.totalMarks}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        {scored ? (
                          <input
                            type="number"
                            min={0}
                            max={question.totalMarks}
                            step="0.5"
                            value={answer.pointsEarned}
                            disabled={isReadOnly}
                            onChange={(e) => updateScore(question.id, question.totalMarks, e.target.value)}
                            onBlur={(e) => updateScore(question.id, question.totalMarks, e.target.value)}
                            className="h-8 w-20 rounded border border-slate-300 bg-background px-2 text-right text-xs tabular-nums text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 dark:border-white/15"
                            placeholder={`0–${question.totalMarks}`}
                          />
                        ) : (
                          <span className="tabular-nums text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 dark:border-white/20 dark:bg-slate-950/50">
                  <td colSpan={5} className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Overall Score
                  </td>
                  <td className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-right tabular-nums text-sm font-bold text-slate-900 dark:border-white/10 dark:text-white">
                    {maxRawScore}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-sm font-bold text-slate-900 dark:text-white">
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
