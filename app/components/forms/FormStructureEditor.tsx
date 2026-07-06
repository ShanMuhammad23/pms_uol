"use client";

import { Plus } from "lucide-react";
import FormSectionEditor from "./FormSectionEditor";
import QuestionEditor from "./QuestionEditor";
import type { FormSectionInput, QuestionInput } from "@/types/forms";
import { createEmptyQuestion, createEmptySection } from "@/types/forms";

interface FormStructureEditorProps {
  sections: FormSectionInput[];
  questions: QuestionInput[];
  errors: Record<string, string>;
  onStructureChange: (
    sections: FormSectionInput[],
    questions: QuestionInput[],
  ) => void;
}

export default function FormStructureEditor({
  sections,
  questions,
  errors,
  onStructureChange,
}: FormStructureEditorProps) {
  const updateSection = (index: number, section: FormSectionInput) => {
    onStructureChange(
      sections.map((current, currentIndex) =>
        currentIndex === index ? section : current,
      ),
      questions,
    );
  };

  const removeSection = (index: number) => {
    onStructureChange(
      sections
        .filter((_, currentIndex) => currentIndex !== index)
        .map((section, sortOrder) => ({ ...section, sortOrder })),
      questions,
    );
  };

  const addSection = () => {
    onStructureChange(
      [...sections, createEmptySection(sections.length)],
      questions,
    );
  };

  const updateQuestion = (index: number, question: QuestionInput) => {
    onStructureChange(
      sections,
      questions.map((current, currentIndex) =>
        currentIndex === index ? question : current,
      ),
    );
  };

  const removeQuestion = (index: number) => {
    onStructureChange(
      sections,
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

    onStructureChange(
      sections,
      next.map((question, sortOrder) => ({ ...question, sortOrder })),
    );
  };

  const addQuestion = () => {
    onStructureChange(sections, [
      ...questions,
      createEmptyQuestion(questions.length),
    ]);
  };

  const hasContent =
    sections.length > 0 || questions.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary">Form Structure</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-text-primary hover:bg-primary/10 dark:border-white/15"
          >
            <Plus className="size-3.5" />
            Add Section
          </button>
          <button
            type="button"
            onClick={addQuestion}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            Add Question
          </button>
        </div>
      </div>

      {errors.questions ? (
        <p className="text-xs text-red-600">{errors.questions}</p>
      ) : null}

      {!hasContent ? (
        <div className="rounded-xl border border-dashed border-slate-300/80 px-4 py-8 text-center text-sm text-foreground/70 dark:border-white/15">
          No sections or questions yet. Add a section or root-level question to
          get started.
        </div>
      ) : null}

      {sections.length > 0 ? (
        <div className="space-y-4">
          {sections.map((section, sectionIndex) => (
            <FormSectionEditor
              key={section.clientId}
              section={section}
              sectionIndex={sectionIndex}
              errors={errors}
              onChange={(value) => updateSection(sectionIndex, value)}
              onRemove={() => removeSection(sectionIndex)}
            />
          ))}
        </div>
      ) : null}

      {questions.length > 0 ? (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-text-primary">
            Root Questions
          </h4>
          {questions.map((question, index) => (
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
          ))}
        </div>
      ) : null}
    </div>
  );
}
