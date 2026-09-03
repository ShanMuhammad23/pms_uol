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
  if (!scales?.length) {
    return null;
  }
  if (question.ratingScaleId != null) {
    const requested = Number(question.ratingScaleId);
    return (
      scales.find((scale) => Number(scale.id) === requested) ?? scales[0]
    );
  }
  return scales[0];
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

function isPresentRating(rating: unknown): boolean {
  if (rating == null || rating === "") {
    return false;
  }
  return Number.isFinite(Number(rating));
}

/** True when a numeric score was entered. Zero is filled; empty is not. */
export function hasExplicitNumericScore(
  value: number | string | null | undefined,
): boolean {
  if (value === undefined || value === null || value === "") {
    return false;
  }
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

/**
 * Whether a manager/employee has actually marked a scored question.
 * A mark of 0 is valid. A missing rating or blank points field is not.
 */
export function hasProvidedAnswerScore(
  question: Pick<QuestionRecord, "totalMarks" | "ratingScaleId">,
  ratingBased: boolean | undefined,
  scales: FormRatingScaleRecord[] | undefined,
  answer:
    | { pointsEarned?: number | null; ratingValue?: number | null | string }
    | undefined,
): boolean {
  if (!answer) return false;
  if (usesRatingScore(question, ratingBased, scales)) {
    return isPresentRating(answer.ratingValue);
  }
  return hasExplicitNumericScore(answer.pointsEarned);
}

/** Select `value` that matches a scale option by numeric rating, not string equality. */
export function matchingScaleSelectValue(
  scale: FormRatingScaleRecord | null | undefined,
  ratingValue: unknown,
): string {
  if (!isPresentRating(ratingValue) || !scale?.options.length) {
    return isPresentRating(ratingValue) ? String(Number(ratingValue)) : "";
  }
  const n = Number(ratingValue);
  const option =
    scale.options.find((item) => Number(item.ratingValue) === n) ??
    scale.options.find(
      (item) => Math.abs(Number(item.ratingValue) - n) < 1e-6,
    );
  return option ? String(option.ratingValue) : String(n);
}

export function inferRatingValueFromPoints(
  question: Pick<QuestionRecord, "totalMarks" | "ratingScaleId">,
  scales: FormRatingScaleRecord[] | undefined,
  points: number,
): number | null {
  if (!Number.isFinite(points) || points <= 0) {
    return null;
  }
  const scale = getQuestionRatingScale(question, scales);
  if (!scale?.options.length) {
    return null;
  }
  for (const option of scale.options) {
    const expected = computeQuestionRatingPoints(
      question,
      scales,
      Number(option.ratingValue),
    );
    if (roundScore(expected) === roundScore(points)) {
      return Number(option.ratingValue);
    }
  }
  const maxRating = deriveRatingScaleMaxValue(
    scale.options,
    Number(scale.maxValue) || DEFAULT_RATING_MAX,
  );
  if (points <= maxRating) {
    const asRating = scale.options.find(
      (option) =>
        Number(option.ratingValue) === points ||
        Math.abs(Number(option.ratingValue) - points) < 1e-6,
    );
    if (asRating) {
      return Number(asRating.ratingValue);
    }
  }
  return null;
}

export function resolveDisplayedRatingValue(
  question: Pick<QuestionRecord, "totalMarks" | "ratingScaleId">,
  ratingBased: boolean | undefined,
  scales: FormRatingScaleRecord[] | undefined,
  answer:
    | { pointsEarned?: number | null; ratingValue?: number | null | string }
    | undefined,
): number | null {
  if (!answer || !usesRatingScore(question, ratingBased, scales)) {
    return isPresentRating(answer?.ratingValue)
      ? Number(answer!.ratingValue)
      : null;
  }
  if (isPresentRating(answer.ratingValue)) {
    return Number(answer.ratingValue);
  }
  const points = Number(answer.pointsEarned);
  if (!Number.isFinite(points) || points <= 0) {
    return null;
  }
  return inferRatingValueFromPoints(question, scales, points);
}

/**
 * Points to display/total for an answer. Rating-based questions always
 * recompute (rating / scale max) × weight so stored zeros or stale
 * points_earned cannot hide a given rating.
 */
export function resolveDisplayedAnswerPoints(
  question: Pick<QuestionRecord, "totalMarks" | "ratingScaleId">,
  ratingBased: boolean | undefined,
  scales: FormRatingScaleRecord[] | undefined,
  answer:
    | { pointsEarned?: number | null; ratingValue?: number | null | string }
    | undefined,
): number {
  if (!answer) return 0;
  if (
    usesRatingScore(question, ratingBased, scales) &&
    isPresentRating(answer.ratingValue)
  ) {
    return computeQuestionRatingPoints(
      question,
      scales,
      Number(answer.ratingValue),
    );
  }
  const points = Number(answer.pointsEarned);
  return Number.isFinite(points) ? points : 0;
}

export function parseDraftScoreAnswer(draft: {
  pointsEarned?: string;
  ratingValue?: string;
} | undefined): { pointsEarned: number | null; ratingValue: number | null } | undefined {
  if (!draft) return undefined;
  const pointsRaw = draft.pointsEarned;
  const ratingRaw = draft.ratingValue;
  const points =
    pointsRaw == null || pointsRaw === "" ? null : Number(pointsRaw);
  const rating =
    ratingRaw == null || ratingRaw === "" ? null : Number(ratingRaw);
  return {
    pointsEarned: points != null && Number.isFinite(points) ? points : null,
    ratingValue: rating != null && Number.isFinite(rating) ? rating : null,
  };
}

export function hydrateAnswerPoints<
  T extends {
    questionId: number;
    pointsEarned: number;
    ratingValue?: number | null;
  },
>(
  answers: T[],
  questions: Array<Pick<QuestionRecord, "id" | "totalMarks" | "ratingScaleId">>,
  ratingBased: boolean | undefined,
  scales: FormRatingScaleRecord[] | undefined,
): T[] {
  const byId = new Map(questions.map((question) => [question.id, question]));
  return answers.map((answer) => {
    const question = byId.get(answer.questionId);
    if (!question) return answer;
    const ratingValue = resolveDisplayedRatingValue(
      question,
      ratingBased,
      scales,
      answer,
    );
    return {
      ...answer,
      ratingValue,
      pointsEarned: resolveDisplayedAnswerPoints(
        question,
        ratingBased,
        scales,
        { ...answer, ratingValue },
      ),
    };
  });
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
    const hasRating =
      input.ratingValue !== undefined &&
      input.ratingValue !== null &&
      input.ratingValue !== ("" as never) &&
      Number.isFinite(Number(input.ratingValue));
    if (!hasRating) {
      const points = Number(input.pointsEarned);
      if (Number.isFinite(points) && points > 0) {
        const inferred = inferRatingValueFromPoints(
          question,
          template.ratingScales,
          points,
        );
        if (inferred != null) {
          return {
            ok: true,
            pointsEarned: computeQuestionRatingPoints(
              question,
              template.ratingScales,
              inferred,
            ),
            ratingValue: inferred,
          };
        }
        return { ok: true, pointsEarned: roundScore(points), ratingValue: null };
      }
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
