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
}

export default function FormSectionEditor({
  section,
  sectionIndex,
  errors,
  onChange,
  onRemove,
}: FormSectionEditorProps) {
  const titleErrorKey = `section-${sectionIndex}-title`;

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

  return (
    <div className="rounded-md border border-slate-300/80 bg-surface p-4 dark:border-white/15">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 block text-xs font-medium text-foreground/70">
            Section Name
          </label>
          <input
            type="text"
            value={section.title}
            onChange={(event) =>
              onChange({ ...section, title: event.target.value })
            }
            className="h-10 w-full rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
            placeholder="Section title"
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
            />
          ))}
        </div>
      ) : null}

      {section.questions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300/80 px-4 py-6 text-center text-sm text-foreground/70 dark:border-white/15">
          Add a question to this section.
        </div>
      ) : null}
    </div>
  );
}
