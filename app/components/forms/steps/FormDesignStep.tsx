"use client";

import FormStructureEditor from "../FormStructureEditor";
import type { FormSectionInput, QuestionInput } from "@/types/forms";

interface FormDesignStepProps {
  title: string;
  description: string;
  sections: FormSectionInput[];
  questions: QuestionInput[];
  errors: Record<string, string>;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onStructureChange: (
    sections: FormSectionInput[],
    questions: QuestionInput[],
  ) => void;
}

export default function FormDesignStep({
  title,
  description,
  sections,
  questions,
  errors,
  onTitleChange,
  onDescriptionChange,
  onStructureChange,
}: FormDesignStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Form Design</h2>
        <p className="mt-1 text-sm text-foreground/70">
          Define the form title, description, sections, and questions.
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

      <FormStructureEditor
        sections={sections}
        questions={questions}
        errors={errors}
        onStructureChange={onStructureChange}
      />
    </div>
  );
}
