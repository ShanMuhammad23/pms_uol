"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  createClientId,
  createEmptyRatingScale,
  type FormRatingScaleInput,
  type RatingScaleOptionInput,
} from "@/types/forms";
import { deriveRatingScaleMaxValue } from "@/app/helpers/form-rating-scoring";
import { cn } from "@/lib/utils";

interface FormRatingScalesEditorProps {
  scales: FormRatingScaleInput[];
  onChange: (scales: FormRatingScaleInput[]) => void;
  error?: string;
}

function withDerivedMax(
  scale: FormRatingScaleInput,
  options: RatingScaleOptionInput[],
): FormRatingScaleInput {
  return {
    ...scale,
    options: options.map((option, index) => ({ ...option, sortOrder: index })),
    maxValue: deriveRatingScaleMaxValue(options),
  };
}

export function FormRatingScalesEditor({
  scales,
  onChange,
  error,
}: FormRatingScalesEditorProps) {
  const updateScale = (
    clientId: string,
    updates: Partial<FormRatingScaleInput>,
  ) => {
    onChange(
      scales.map((scale) => {
        if (scale.clientId !== clientId) {
          return scale;
        }
        const next = { ...scale, ...updates };
        return withDerivedMax(next, next.options);
      }),
    );
  };

  const addScale = () => {
    onChange([...scales, createEmptyRatingScale(scales.length)]);
  };

  const removeScale = (clientId: string) => {
    onChange(scales.filter((scale) => scale.clientId !== clientId));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Rating dropdowns
        </label>
        <button
          type="button"
          onClick={addScale}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Plus className="h-3 w-3" />
          Add dropdown
        </button>
      </div>
      <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        Create one or more rating lists. Max is the highest rating value and cannot
        be edited. Every rating needs a label. Scored questions pick a list; the
        score is rating ÷ max × question marks.
      </p>
      {error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : null}
      <div className="space-y-3">
        {scales.map((scale) => {
          const maxValue = deriveRatingScaleMaxValue(scale.options);
          const highlightEmptyLabels = Boolean(error);
          return (
            <div
              key={scale.clientId}
              className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-500/30 dark:bg-violet-950/20"
            >
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="text"
                  value={scale.name}
                  onChange={(event) =>
                    updateScale(scale.clientId, { name: event.target.value })
                  }
                  placeholder="Dropdown name (e.g. Standard 5-point)"
                  className="h-8 flex-1 rounded border border-violet-200 bg-white px-2 text-xs outline-none focus:border-violet-400 dark:border-violet-600/40 dark:bg-slate-900"
                />
                <span
                  className="inline-flex h-8 items-center gap-1 rounded border border-violet-200 bg-violet-100/80 px-2 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:border-violet-600/40 dark:bg-violet-950/50 dark:text-violet-300"
                  title="Automatically set to the highest rating value"
                >
                  Max
                  <span className="min-w-[1.25rem] text-right text-xs font-bold tabular-nums">
                    {maxValue}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeScale(scale.clientId)}
                  className="rounded p-1 text-violet-400 hover:text-red-600"
                  title="Remove dropdown"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mb-1 grid grid-cols-[3.5rem_minmax(0,1fr)_1.25rem] items-center gap-2 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                <span>Rating</span>
                <span>
                  Label <span className="text-red-500">*</span>
                </span>
                <span className="sr-only">Remove</span>
              </div>
              <div className="space-y-1.5">
                {scale.options.map((option, optionIndex) => {
                  const labelEmpty = !option.optionLabel.trim();
                  return (
                    <div
                      key={option.clientId}
                      className="grid grid-cols-[3.5rem_minmax(0,1fr)_1.25rem] items-center gap-2"
                    >
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={option.ratingValue}
                        onChange={(event) => {
                          const nextOptions = [...scale.options];
                          nextOptions[optionIndex] = {
                            ...option,
                            ratingValue: Number(event.target.value || 0),
                          };
                          updateScale(scale.clientId, { options: nextOptions });
                        }}
                        className="h-7 w-full rounded border border-violet-200 bg-white px-1.5 text-right text-xs outline-none dark:border-violet-600/40 dark:bg-slate-900"
                        title="Rating value"
                        aria-label={`Rating value ${optionIndex + 1}`}
                      />
                      <input
                        type="text"
                        value={option.optionLabel}
                        onChange={(event) => {
                          const nextOptions = [...scale.options];
                          nextOptions[optionIndex] = {
                            ...option,
                            optionLabel: event.target.value,
                          };
                          updateScale(scale.clientId, { options: nextOptions });
                        }}
                        required
                        aria-required="true"
                        placeholder="Required label"
                        className={cn(
                          "h-7 flex-1 rounded border bg-white px-2 text-xs outline-none dark:bg-slate-900",
                          highlightEmptyLabels && labelEmpty
                            ? "border-red-400 focus:border-red-500 dark:border-red-700"
                            : "border-violet-200 focus:border-violet-400 dark:border-violet-600/40",
                        )}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateScale(scale.clientId, {
                            options: scale.options.filter(
                              (_, index) => index !== optionIndex,
                            ),
                          })
                        }
                        className="text-violet-400 hover:text-red-600"
                        aria-label={`Remove rating ${option.ratingValue}`}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    updateScale(scale.clientId, {
                      options: [
                        ...scale.options,
                        {
                          clientId: createClientId(),
                          optionLabel: "",
                          ratingValue: maxValue + 1,
                          sortOrder: scale.options.length,
                        },
                      ],
                    })
                  }
                  className="text-[11px] text-primary hover:underline"
                >
                  + Add rating option
                </button>
              </div>
            </div>
          );
        })}
        {scales.length === 0 ? (
          <p
            className={cn(
              "rounded-lg border border-dashed px-3 py-4 text-center text-xs",
              error
                ? "border-red-300 text-red-600"
                : "border-slate-200 text-slate-400 dark:border-slate-700",
            )}
          >
            No rating dropdowns yet. Add one, then assign it on each scored question.
          </p>
        ) : null}
      </div>
    </div>
  );
}
