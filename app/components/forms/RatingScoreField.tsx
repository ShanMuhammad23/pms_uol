"use client";

import {
  computeRatingPoints,
  DEFAULT_RATING_MAX,
  deriveRatingScaleMaxValue,
  formatRatingOptionDisplay,
  formatScoreValue,
  getQuestionRatingScale,
  matchingScaleSelectValue,
  resolveDisplayedAnswerPoints,
  resolveDisplayedRatingValue,
  usesRatingScore,
} from "@/app/helpers/form-rating-scoring";
import type { FormRatingScaleRecord, QuestionRecord } from "@/types/forms";
import { cn } from "@/lib/utils";

type ScoreTone = "teal" | "violet" | "indigo" | "slate";

const TONE_SELECT: Record<ScoreTone, string> = {
  teal: "text-teal-700 focus-visible:ring-teal-400 dark:text-teal-300",
  violet: "text-violet-700 focus-visible:ring-violet-400 dark:text-violet-300",
  indigo: "text-indigo-700 focus-visible:ring-indigo-400 dark:text-indigo-300",
  slate: "text-slate-600 focus-visible:ring-slate-400 dark:text-slate-400",
};

interface RatingScoreFieldProps {
  scale: FormRatingScaleRecord;
  weight: number;
  ratingValue: string;
  onRatingChange: (ratingValue: string, pointsEarned: string) => void;
  disabled?: boolean;
  className?: string;
  tone?: ScoreTone;
  /** When no rating is selected, still show stored/calculated points. */
  fallbackPoints?: number | null;
  invalid?: boolean;
}

export function RatingScoreField({
  scale,
  weight,
  ratingValue,
  onRatingChange,
  disabled = false,
  className,
  tone = "teal",
  fallbackPoints = null,
  invalid = false,
}: RatingScoreFieldProps) {
  const storedMax = Number(scale.maxValue);
  const maxRating = deriveRatingScaleMaxValue(
    scale.options,
    Number.isFinite(storedMax) && storedMax > 0 ? storedMax : DEFAULT_RATING_MAX,
  );
  const selectValue = matchingScaleSelectValue(scale, ratingValue);
  const selected = selectValue === "" ? null : Number(selectValue);
  const selectedOption =
    selected == null || Number.isNaN(selected)
      ? null
      : scale.options.find((option) => Number(option.ratingValue) === selected) ??
        scale.options.find(
          (option) => Math.abs(Number(option.ratingValue) - selected) < 1e-6,
        );
  const pointsFromRating =
    selected == null || Number.isNaN(selected)
      ? null
      : computeRatingPoints(selected, weight, maxRating);
  const points =
    pointsFromRating ??
    (fallbackPoints != null && Number.isFinite(Number(fallbackPoints))
      ? Number(fallbackPoints)
      : null);
  const hasMatchingOption = Boolean(selectedOption);
  const orphanRatingLabel =
    !hasMatchingOption && selectValue !== ""
      ? formatScoreValue(Number(selectValue))
      : null;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 max-w-full flex-col items-stretch gap-0.5 overflow-hidden",
        className,
      )}
    >
      <select
        value={selectValue}
        disabled={disabled}
        title={
          selectedOption
            ? formatRatingOptionDisplay(selectedOption)
            : orphanRatingLabel
              ? orphanRatingLabel
              : "Select rating"
        }
        onChange={(event) => {
          const next = event.target.value;
          if (next === "") {
            onRatingChange("", "");
            return;
          }
          const rating = Number(next);
          const nextPoints = computeRatingPoints(rating, weight, maxRating);
          onRatingChange(String(rating), String(nextPoints));
        }}
        className={cn(
          "box-border h-8 w-full min-w-0 max-w-full [field-sizing:fixed] rounded border border-slate-300 bg-white px-1 text-xs focus-visible:outline-none focus-visible:ring-2 disabled:opacity-80 dark:border-white/15 dark:bg-slate-800",
          TONE_SELECT[tone],
          invalid &&
            "border-red-500 ring-2 ring-red-400/80 focus-visible:ring-red-500 dark:border-red-400 bg-red-500",
        )}
        aria-invalid={invalid || undefined}
        aria-label="Select rating"
      >
        <option value="">Select rating</option>
        {orphanRatingLabel ? (
          <option value={selectValue}>{orphanRatingLabel}</option>
        ) : null}
        {scale.options.map((option) => (
          <option key={option.id} value={String(option.ratingValue)}>
            {formatRatingOptionDisplay(option)}
          </option>
        ))}
      </select>
      <span className="truncate text-base tabular-nums  dark:text-slate-400">
        {points == null ? "—" : `${formatScoreValue(points)} / ${weight}`}
      </span>
    </div>
  );
}

/** Read-only score cell: rating + calculated points for rating forms, else numeric score. */
export function AnswerScoreReadout({
  question,
  ratingBased,
  ratingScales,
  answer,
  tone = "teal",
  emptyLabel = "—",
}: {
  question: Pick<QuestionRecord, "totalMarks" | "ratingScaleId">;
  ratingBased: boolean;
  ratingScales: FormRatingScaleRecord[];
  answer:
    | { pointsEarned?: number | null; ratingValue?: number | null | string }
    | undefined;
  tone?: ScoreTone;
  emptyLabel?: string;
}) {
  const scale = getQuestionRatingScale(question, ratingScales);
  if (usesRatingScore(question, ratingBased, ratingScales) && scale) {
    const rating = resolveDisplayedRatingValue(
      question,
      ratingBased,
      ratingScales,
      answer,
    );
    const points = resolveDisplayedAnswerPoints(
      question,
      ratingBased,
      ratingScales,
      answer,
    );
    const hasAnswer =
      rating != null ||
      (answer?.pointsEarned != null &&
        Number.isFinite(Number(answer.pointsEarned)) &&
        Number(answer.pointsEarned) >= 0);
    if (!hasAnswer) {
      return <span className="text-slate-400">{emptyLabel}</span>;
    }
    return (
      <RatingScoreField
        scale={scale}
        weight={question.totalMarks}
        ratingValue={rating == null ? "" : String(rating)}
        fallbackPoints={points}
        disabled
        tone={tone}
        onRatingChange={() => undefined}
      />
    );
  }

  if (answer?.pointsEarned == null) {
    return <span className="text-slate-400">{emptyLabel}</span>;
  }

  return (
    <span className={cn("font-bold tabular-nums", TONE_SELECT[tone])}>
      {formatScoreValue(Number(answer.pointsEarned) || 0)}
    </span>
  );
}
