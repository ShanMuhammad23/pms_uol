"use client";

import { Plus } from "lucide-react";
import QuestionEditor from "../QuestionEditor";
import type { QuestionInput } from "@/types/forms";
import { createEmptyQuestion } from "@/types/forms";

interface FormDesignStepProps {
  title: string;
  description: string;
  questions: QuestionInput[];
  errors: Record<string, string>;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onQuestionsChange: (questions: QuestionInput[]) => void;
}

export default function FormDesignStep({
  title,
  description,
  questions,
  errors,
  onTitleChange,
  onDescriptionChange,
  onQuestionsChange,
}: FormDesignStepProps) {
  const updateQuestion = (index: number, question: QuestionInput) => {
    onQuestionsChange(
      questions.map((current, currentIndex) =>
        currentIndex === index ? question : current,
      ),
    );
  };

  const removeQuestion = (index: number) => {
    onQuestionsChange(
      questions
        .filter((_, currentIndex) => currentIndex !== index)
        .map((question, sortOrder) => ({ ...question, sortOrder })),
    );
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) {
      return;
    }

    const next = [...questions];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];

    onQuestionsChange(
      next.map((question, sortOrder) => ({ ...question, sortOrder })),
    );
  };

  const addQuestion = () => {
    onQuestionsChange([...questions, createEmptyQuestion(questions.length)]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Form Design</h2>
        <p className="mt-1 text-sm text-foreground/70">
          Define the form title, description, and questions.
        </p>
      </div>

      <div className="grid gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-text-primary">
            Form Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            className="h-11 w-full rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
            placeholder="Annual Faculty Evaluation Form"
          />
          {errors.title ? (
            <p className="mt-1 text-xs text-red-600">{errors.title}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text-primary">
            Description
          </label>
          <textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
            placeholder="Optional description for this form template"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Questions</h3>
          <button
            type="button"
            onClick={addQuestion}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            Add Question
          </button>
        </div>

        {errors.questions ? (
          <p className="text-xs text-red-600">{errors.questions}</p>
        ) : null}

        {questions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300/80 px-4 py-8 text-center text-sm text-foreground/70 dark:border-white/15">
            No questions yet. Add your first question to get started.
          </div>
        ) : (
          questions.map((question, index) => (
            <QuestionEditor
              key={index}
              question={question}
              index={index}
              total={questions.length}
              onChange={(value) => updateQuestion(index, value)}
              onRemove={() => removeQuestion(index)}
              onMoveUp={() => moveQuestion(index, "up")}
              onMoveDown={() => moveQuestion(index, "down")}
              error={errors[`question-${index}`]}
              totalMarksError={errors[`question-${index}-marks`]}
            />
          ))
        )}
      </div>
    </div>
  );
}
