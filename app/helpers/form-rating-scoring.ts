import { isScoredQuestion } from "@/app/helpers/form-questions";
import type {
  FormRatingScaleRecord,
  FormTemplateRecord,
  QuestionRecord,
} from "@/types/forms";

export const DEFAULT_RATING_MAX = 5;

export function deriveRatingScaleMaxValue(
  options: Array<{ ratingValue: number | string | null | undefined }>,
  fallback = DEFAULT_RATING_MAX,
): number {
  const values = options
    .map((option) => Number(option.ratingValue))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) {
    return fallback;
  }
  return Math.max(...values);
}

export function formatRatingOptionDisplay(option: {
  ratingValue: number | string;
  optionLabel?: string | null;
}): string {
  const value = formatScoreValue(Number(option.ratingValue));
  const label = option.optionLabel?.trim();
  return label ? `${value} — ${label}` : value;
}

export function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatScoreValue(value: number): string {
  const rounded = roundScore(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function getQuestionRatingScale(
  question: Pick<QuestionRecord, "ratingScaleId">,
  scales: FormRatingScaleRecord[] | undefined,
): FormRatingScaleRecord | null {
  if (question.ratingScaleId == null || !scales?.length) {
    return null;
  }
  return scales.find((scale) => scale.id === question.ratingScaleId) ?? null;
}

export function usesRatingScore(
  question: Pick<QuestionRecord, "totalMarks" | "ratingScaleId">,
  ratingBased: boolean | undefined,
  scales?: FormRatingScaleRecord[],
): boolean {
  if (!ratingBased || !isScoredQuestion(question)) {
    return false;
  }
  return getQuestionRatingScale(question, scales) != null;
}

/**
 * Score for a rating-based question: (rating / scale max) × question weight.
 * Scale max defaults to 5 when not configured.
 */
export function computeRatingPoints(
  ratingValue: number,
  weight: number,
  maxRating = DEFAULT_RATING_MAX,
): number {
  if (!Number.isFinite(ratingValue) || !Number.isFinite(weight) || maxRating <= 0) {
    return 0;
  }
  return roundScore((ratingValue / maxRating) * weight);
}

export function resolveRatingOption(
  scale: FormRatingScaleRecord,
  ratingValue: number,
) {
  return (
    scale.options.find(
      (option) => Number(option.ratingValue) === Number(ratingValue),
    ) ?? null
  );
}

export function computeQuestionRatingPoints(
  question: Pick<QuestionRecord, "totalMarks" | "ratingScaleId">,
  scales: FormRatingScaleRecord[] | undefined,
  ratingValue: number,
): number {
  const scale = getQuestionRatingScale(question, scales);
  const maxRating = scale
    ? deriveRatingScaleMaxValue(scale.options, Number(scale.maxValue) || DEFAULT_RATING_MAX)
    : DEFAULT_RATING_MAX;
  return computeRatingPoints(ratingValue, Number(question.totalMarks), maxRating);
}

export type ResolvedAnswerScore =
  | { ok: true; pointsEarned: number; ratingValue: number | null }
  | { ok: false; error: string };

export function resolveAnswerScore(
  question: QuestionRecord,
  template: Pick<FormTemplateRecord, "ratingBased" | "ratingScales">,
  input: { pointsEarned?: number | null; ratingValue?: number | null },
  questionLabel: string,
): ResolvedAnswerScore {
  const label = questionLabel.slice(0, 80);

  if (usesRatingScore(question, template.ratingBased, template.ratingScales)) {
    if (input.ratingValue === undefined || input.ratingValue === null || input.ratingValue === ("" as never)) {
      return { ok: true, pointsEarned: 0, ratingValue: null };
    }
    const rating = Number(input.ratingValue);
    if (Number.isNaN(rating)) {
      return { ok: false, error: `Select a valid rating for "${label}".` };
    }
    const scale = getQuestionRatingScale(question, template.ratingScales);
    if (!scale || !resolveRatingOption(scale, rating)) {
      return {
        ok: false,
        error: `Select a valid rating for "${label}".`,
      };
    }
    return {
      ok: true,
      pointsEarned: computeQuestionRatingPoints(
        question,
        template.ratingScales,
        rating,
      ),
      ratingValue: rating,
    };
  }

  if (input.pointsEarned === undefined || input.pointsEarned === null) {
    return { ok: true, pointsEarned: 0, ratingValue: null };
  }

  const points = Number(input.pointsEarned);
  if (Number.isNaN(points)) {
    return { ok: false, error: `Enter a valid score for "${label}".` };
  }
  if (points < 0 || points > Number(question.totalMarks)) {
    return {
      ok: false,
      error: `Score for "${label}" must be between 0 and ${question.totalMarks}.`,
    };
  }
  return { ok: true, pointsEarned: points, ratingValue: null };
}
