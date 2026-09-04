"use client";

import { Plus } from "lucide-react";
import QuestionEditor from "./QuestionEditor";
import type { FormSectionInput, QuestionInput } from "@/types/forms";
import { createEmptyQuestion } from "@/types/forms";

interface FormSectionEditorProps {
  section: FormSectionInput;
  sectionIndex: number;
  errors: Record<string, string>;
  onChange: (section: FormSectionInput) => void;
  onRemove: () => void;
  formSelfAssessmentEnabled?: boolean;
}

export default function FormSectionEditor({
  section,
  sectionIndex,
  errors,
  onChange,
  onRemove,
  formSelfAssessmentEnabled = true,
}: FormSectionEditorProps) {
  const titleErrorKey = `section-${sectionIndex}-title`;
  const isOpenAssessment = Boolean(section.isOpenAssessment);

  const updateQuestion = (index: number, question: QuestionInput) => {
    onChange({
      ...section,
      questions: section.questions.map((current, currentIndex) =>
        currentIndex === index ? question : current,
      ),
    });
  };

  const removeQuestion = (index: number) => {
    onChange({
      ...section,
      questions: section.questions
        .filter((_, currentIndex) => currentIndex !== index)
        .map((question, sortOrder) => ({ ...question, sortOrder })),
    });
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= section.questions.length) {
      return;
    }

    const next = [...section.questions];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];

    onChange({
      ...section,
      questions: next.map((question, sortOrder) => ({ ...question, sortOrder })),
    });
  };

  const addQuestion = () => {
    onChange({
      ...section,
      questions: [
        ...section.questions,
        createEmptyQuestion(section.questions.length),
      ],
    });
  };

  const toggleOpenAssessment = (enabled: boolean) => {
    if (enabled) {
      onChange({
        ...section,
        isOpenAssessment: true,
        questions: [],
        subsections: [],
        layout: [],
        openAssessmentTotalMarks: section.openAssessmentTotalMarks ?? 100,
      });
    } else {
      onChange({
        ...section,
        isOpenAssessment: false,
        openAssessmentTotalMarks: 0,
      });
    }
  };

  return (
    <div className="rounded-md border border-slate-300/80 bg-surface p-4 dark:border-white/15">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 block text-xs font-medium text-foreground/70">
            Section Name
          </label>
          <textarea
            value={section.title}
            onChange={(event) =>
              onChange({ ...section, title: event.target.value })
            }
            rows={2}
            maxLength={500}
            className="w-full resize-y rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
            placeholder="Section title (Press Enter for new line)"
          />
          {errors[titleErrorKey] ? (
            <p className="mt-1 text-xs text-red-600">{errors[titleErrorKey]}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/30"
        >
          Remove Section
        </button>
      </div>

      {/* Open Assessment toggle */}
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-white/10 dark:bg-slate-800/30">
        <label className="flex items-center gap-2 text-xs font-medium text-foreground/80">
          <input
            type="checkbox"
            checked={isOpenAssessment}
            onChange={(e) => toggleOpenAssessment(e.target.checked)}
            className="size-4 rounded border-slate-300 text-primary focus-visible:ring-2 focus-visible:ring-primary dark:border-white/20 dark:bg-slate-800"
          />
          Open Assessment Section
          <span className="font-normal text-foreground/50">
            (employee/manager writes the questions at fill time)
          </span>
        </label>
        {isOpenAssessment ? (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-foreground/70">
              Total Marks Budget
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={section.openAssessmentTotalMarks ?? 0}
              onChange={(e) =>
                onChange({
                  ...section,
                  openAssessmentTotalMarks: Number(e.target.value) || 0,
                })
              }
              className="h-9 w-32 rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
              placeholder="e.g. 100"
            />
            <p className="mt-1.5 text-xs text-foreground/50">
              The employee or manager will split this budget across their own
              questions. The sum of all question marks must equal this budget.
            </p>
            {errors[`section-${sectionIndex}-open-budget`] ? (
              <p className="mt-1 text-xs text-red-600">
                {errors[`section-${sectionIndex}-open-budget`]}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-foreground/80">
                <input
                  type="checkbox"
                  checked={section.selfAssessmentEnabled !== false}
                  onChange={(e) =>
                    onChange({
                      ...section,
                      selfAssessmentEnabled: e.target.checked,
                    })
                  }
                  disabled={!formSelfAssessmentEnabled}
                  className="size-4 rounded border-slate-300 text-primary focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 dark:border-white/20 dark:bg-slate-800"
                />
                Self Assessment
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-foreground/80">
                <input
                  type="checkbox"
                  checked={section.hodAssessmentEnabled !== false}
                  onChange={(e) =>
                    onChange({
                      ...section,
                      hodAssessmentEnabled: e.target.checked,
                    })
                  }
                  className="size-4 rounded border-slate-300 text-primary focus-visible:ring-2 focus-visible:ring-primary dark:border-white/20 dark:bg-slate-800"
                />
                HOD Assessment
              </label>
            </div>
          </div>
        ) : null}
      </div>

      {/* Normal section: show question editor */}
      {!isOpenAssessment ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addQuestion}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90"
            >
              <Plus className="size-3.5" />
              Add Question
            </button>
          </div>

          {section.questions.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-text-primary">
                Section Questions
              </h4>
              {section.questions.map((question, questionIndex) => (
                <QuestionEditor
                  key={questionIndex}
                  question={question}
                  index={questionIndex}
                  total={section.questions.length}
                  onChange={(value) => updateQuestion(questionIndex, value)}
                  onRemove={() => removeQuestion(questionIndex)}
                  onMoveUp={() => moveQuestion(questionIndex, "up")}
                  onMoveDown={() => moveQuestion(questionIndex, "down")}
                  error={errors[`section-${sectionIndex}-question-${questionIndex}`]}
                  totalMarksError={
                    errors[`section-${sectionIndex}-question-${questionIndex}-marks`]
                  }
                  formSelfAssessmentEnabled={formSelfAssessmentEnabled}
                />
              ))}
            </div>
          ) : null}

          {section.questions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300/80 px-4 py-6 text-center text-sm text-foreground/70 dark:border-white/15">
              Add a question to this section.
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-amber-300/80 bg-amber-50/40 px-4 py-6 text-center text-sm text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-300">
          This is an open-assessment section. Questions will be authored by the
          employee (self-assessment) or manager (direct assessment) at fill time.
          No questions need to be created here.
        </div>
      )}
    </div>
  );
}
