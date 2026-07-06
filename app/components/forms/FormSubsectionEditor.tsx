"use client";

import { Plus } from "lucide-react";
import QuestionEditor from "./QuestionEditor";
import type { FormSubsectionInput, QuestionInput } from "@/types/forms";
import { createEmptyQuestion } from "@/types/forms";

interface FormSubsectionEditorProps {
  subsection: FormSubsectionInput;
  sectionIndex: number;
  subsectionIndex: number;
  errors: Record<string, string>;
  onChange: (subsection: FormSubsectionInput) => void;
  onRemove: () => void;
}

export default function FormSubsectionEditor({
  subsection,
  sectionIndex,
  subsectionIndex,
  errors,
  onChange,
  onRemove,
}: FormSubsectionEditorProps) {
  const titleErrorKey = `section-${sectionIndex}-sub-${subsectionIndex}-title`;
  const questionsErrorKey = `section-${sectionIndex}-sub-${subsectionIndex}-questions`;

  const updateQuestion = (index: number, question: QuestionInput) => {
    onChange({
      ...subsection,
      questions: subsection.questions.map((current, currentIndex) =>
        currentIndex === index ? question : current,
      ),
    });
  };

  const removeQuestion = (index: number) => {
    onChange({
      ...subsection,
      questions: subsection.questions
        .filter((_, currentIndex) => currentIndex !== index)
        .map((question, sortOrder) => ({ ...question, sortOrder })),
    });
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= subsection.questions.length) {
      return;
    }

    const next = [...subsection.questions];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];

    onChange({
      ...subsection,
      questions: next.map((question, sortOrder) => ({ ...question, sortOrder })),
    });
  };

  const addQuestion = () => {
    onChange({
      ...subsection,
      questions: [
        ...subsection.questions,
        createEmptyQuestion(subsection.questions.length),
      ],
    });
  };

  return (
    <div className="rounded-xl border border-slate-300/60 bg-background/50 p-4 dark:border-white/10">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 block text-xs font-medium text-foreground/70">
            Subsection Name
          </label>
          <input
            type="text"
            value={subsection.title}
            onChange={(event) =>
              onChange({ ...subsection, title: event.target.value })
            }
            className="h-10 w-full rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
            placeholder="Subsection title"
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
          Remove Subsection
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-semibold text-text-primary">Questions</h5>
          <button
            type="button"
            onClick={addQuestion}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-text-primary hover:bg-primary/10 dark:border-white/15"
          >
            <Plus className="size-3" />
            Add Question
          </button>
        </div>

        {errors[questionsErrorKey] ? (
          <p className="text-xs text-red-600">{errors[questionsErrorKey]}</p>
        ) : null}

        {subsection.questions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300/80 px-3 py-5 text-center text-xs text-foreground/70 dark:border-white/15">
            No questions in this subsection yet.
          </div>
        ) : (
          subsection.questions.map((question, questionIndex) => (
            <QuestionEditor
              key={questionIndex}
              question={question}
              index={questionIndex}
              total={subsection.questions.length}
              onChange={(value) => updateQuestion(questionIndex, value)}
              onRemove={() => removeQuestion(questionIndex)}
              onMoveUp={() => moveQuestion(questionIndex, "up")}
              onMoveDown={() => moveQuestion(questionIndex, "down")}
              error={
                errors[
                  `section-${sectionIndex}-sub-${subsectionIndex}-question-${questionIndex}`
                ]
              }
              totalMarksError={
                errors[
                  `section-${sectionIndex}-sub-${subsectionIndex}-question-${questionIndex}-marks`
                ]
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
