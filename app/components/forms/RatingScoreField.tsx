"use client";

import {
  computeRatingPoints,
  DEFAULT_RATING_MAX,
  deriveRatingScaleMaxValue,
  formatRatingOptionDisplay,
  formatScoreValue,
} from "@/app/helpers/form-rating-scoring";
import type { FormRatingScaleRecord } from "@/types/forms";
import { cn } from "@/lib/utils";

interface RatingScoreFieldProps {
  scale: FormRatingScaleRecord;
  weight: number;
  ratingValue: string;
  onRatingChange: (ratingValue: string, pointsEarned: string) => void;
  disabled?: boolean;
  className?: string;
}

export function RatingScoreField({
  scale,
  weight,
  ratingValue,
  onRatingChange,
  disabled = false,
  className,
}: RatingScoreFieldProps) {
  const storedMax = Number(scale.maxValue);
  const maxRating = deriveRatingScaleMaxValue(
    scale.options,
    Number.isFinite(storedMax) && storedMax > 0 ? storedMax : DEFAULT_RATING_MAX,
  );
  const selected = ratingValue === "" ? null : Number(ratingValue);
  const selectedOption =
    selected == null || Number.isNaN(selected)
      ? null
      : scale.options.find((option) => Number(option.ratingValue) === selected);
  const points =
    selected == null || Number.isNaN(selected)
      ? null
      : computeRatingPoints(selected, weight, maxRating);

  return (
    <div
      className={cn(
        "flex w-full min-w-0 max-w-full flex-col items-stretch gap-0.5 overflow-hidden",
        className,
      )}
    >
      <select
        value={ratingValue}
        disabled={disabled}
        title={
          selectedOption
            ? formatRatingOptionDisplay(selectedOption)
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
        className="box-border h-8 w-full min-w-0 max-w-full [field-sizing:fixed] rounded border border-slate-300 bg-white px-1 text-xs text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:opacity-60 dark:border-white/15 dark:bg-slate-800 dark:text-teal-300"
        aria-label="Select rating"
      >
        <option value="">Select rating</option>
        {scale.options.map((option) => (
          <option key={option.id} value={String(option.ratingValue)}>
            {formatRatingOptionDisplay(option)}
          </option>
        ))}
      </select>
      <span className="truncate text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
        {points == null ? "—" : `${formatScoreValue(points)} / ${weight}`}
      </span>
    </div>
  );
}
