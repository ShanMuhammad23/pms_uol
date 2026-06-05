"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import type { QuestionInput } from "@/types/forms";
import { FIELD_TYPES, FIELD_TYPE_LABELS } from "@/types/forms";
import { cn } from "@/lib/utils";

interface QuestionEditorProps {
  question: QuestionInput;
  index: number;
  total: number;
  onChange: (question: QuestionInput) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  error?: string;
}

function needsOptions(inputType: QuestionInput["inputType"]): boolean {
  return ["RADIO", "CHECKBOX", "SELECT"].includes(inputType);
}

export default function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  error,
}: QuestionEditorProps) {
  const showOptions = needsOptions(question.inputType);

  const updateOption = (
    optionIndex: number,
    field: "optionLabel" | "pointsAssigned",
    value: string,
  ) => {
    const options = question.options.map((option, currentIndex) =>
      currentIndex === optionIndex
        ? {
            ...option,
            [field]:
              field === "pointsAssigned" ? Number(value || 0) : value,
          }
        : option,
    );

    onChange({ ...question, options });
  };

  const addOption = () => {
    onChange({
      ...question,
      options: [
        ...question.options,
        {
          optionLabel: "",
          pointsAssigned: 0,
          sortOrder: question.options.length,
        },
      ],
    });
  };

  const removeOption = (optionIndex: number) => {
    onChange({
      ...question,
      options: question.options
        .filter((_, currentIndex) => currentIndex !== optionIndex)
        .map((option, sortOrder) => ({ ...option, sortOrder })),
    });
  };

  const handleInputTypeChange = (inputType: QuestionInput["inputType"]) => {
    const nextQuestion: QuestionInput = { ...question, inputType };

    if (needsOptions(inputType) && question.options.length === 0) {
      nextQuestion.options = [
        { optionLabel: "", pointsAssigned: 0, sortOrder: 0 },
        { optionLabel: "", pointsAssigned: 0, sortOrder: 1 },
      ];
    }

    if (!needsOptions(inputType)) {
      nextQuestion.options = [];
    }

    onChange(nextQuestion);
  };

  return (
    <div className="rounded-xl border border-slate-300/80 bg-surface p-4 dark:border-white/15">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            Question {index + 1}
          </p>
          {error ? (
            <p className="mt-1 text-xs text-red-600">{error}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded-md p-1.5 text-foreground/70 hover:bg-primary/10 disabled:opacity-40"
            aria-label="Move question up"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="rounded-md p-1.5 text-foreground/70 hover:bg-primary/10 disabled:opacity-40"
            aria-label="Move question down"
          >
            <ChevronDown className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-1.5 text-red-500 hover:bg-red-500/10"
            aria-label="Remove question"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-text-primary">
            Question Text
          </label>
          <textarea
            value={question.questionText}
            onChange={(event) =>
              onChange({ ...question, questionText: event.target.value })
            }
            rows={2}
            className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
            placeholder="Enter question text"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text-primary">
            Input Type
          </label>
          <select
            value={question.inputType}
            onChange={(event) =>
              handleInputTypeChange(event.target.value as QuestionInput["inputType"])
            }
            className="h-10 w-full rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
          >
            {FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {FIELD_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={question.isRequired}
              onChange={(event) =>
                onChange({ ...question, isRequired: event.target.checked })
              }
              className="size-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            Required field
          </label>
        </div>
      </div>

      {showOptions ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-text-primary">Options</p>
            <button
              type="button"
              onClick={addOption}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
            >
              <Plus className="size-3.5" />
              Add option
            </button>
          </div>

          {question.options.map((option, optionIndex) => (
            <div
              key={optionIndex}
              className={cn(
                "grid gap-3 rounded-lg border border-slate-300/60 p-3 md:grid-cols-[1fr_120px_auto]",
                "dark:border-white/10",
              )}
            >
              <input
                type="text"
                value={option.optionLabel}
                onChange={(event) =>
                  updateOption(optionIndex, "optionLabel", event.target.value)
                }
                placeholder="Option label"
                className="h-9 rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
              />
              <input
                type="number"
                value={option.pointsAssigned}
                onChange={(event) =>
                  updateOption(optionIndex, "pointsAssigned", event.target.value)
                }
                placeholder="Points"
                className="h-9 rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
              />
              <button
                type="button"
                onClick={() => removeOption(optionIndex)}
                className="inline-flex h-9 items-center justify-center rounded-lg px-2 text-red-500 hover:bg-red-500/10"
                aria-label="Remove option"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
