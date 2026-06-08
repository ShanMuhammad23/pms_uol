import type { FormTemplateInput } from "@/types/forms";
import {
  CATEGORY_SUB_MAP,
  EMPLOYEE_CATEGORIES,
  FIELD_TYPES,
  PERFORMANCE_RATINGS,
} from "@/types/forms";

export function validateFormTemplateInput(
  input: Partial<FormTemplateInput>,
): string | null {
  if (!input.title?.trim()) {
    return "Form title is required.";
  }

  if (!input.cycleId || Number.isNaN(Number(input.cycleId))) {
    return "Appraisal cycle is required.";
  }

  if (
    !input.targetCategory ||
    !EMPLOYEE_CATEGORIES.includes(input.targetCategory)
  ) {
    return "Target category is required.";
  }

  if (
    !input.targetSubCategory ||
    !CATEGORY_SUB_MAP[input.targetCategory].includes(input.targetSubCategory)
  ) {
    return "Target sub-category is required.";
  }

  if (!input.questions || input.questions.length === 0) {
    return "At least one question is required.";
  }

  for (let index = 0; index < input.questions.length; index += 1) {
    const question = input.questions[index];

    if (!question.questionText?.trim()) {
      return `Question ${index + 1} text is required.`;
    }

    if (!FIELD_TYPES.includes(question.inputType)) {
      return `Question ${index + 1} has an invalid input type.`;
    }

    if (["RADIO", "SELECT"].includes(question.inputType)) {
      if (!question.options || question.options.length < 2) {
        return `Question ${index + 1} requires at least two options.`;
      }
    }

    if (question.inputType === "CHECKBOX") {
      if (!question.options || question.options.length < 1) {
        return `Question ${index + 1} requires at least one option.`;
      }
    }

    if (question.options) {
      for (let optionIndex = 0; optionIndex < question.options.length; optionIndex += 1) {
        const option = question.options[optionIndex];

        if (!option.optionLabel?.trim()) {
          return `Question ${index + 1}, option ${optionIndex + 1} label is required.`;
        }

        if (Number.isNaN(Number(option.pointsAssigned))) {
          return `Question ${index + 1}, option ${optionIndex + 1} points must be a number.`;
        }
      }
    }
  }

  if (!input.incrementMatrices || input.incrementMatrices.length === 0) {
    return "Increment matrix configuration is required.";
  }

  for (const entry of input.incrementMatrices) {
    if (!PERFORMANCE_RATINGS.includes(entry.rating)) {
      return "Increment matrix contains an invalid rating.";
    }

    if (entry.quartile < 1 || entry.quartile > 4) {
      return "Increment matrix quartile must be between 1 and 4.";
    }

    if (Number.isNaN(Number(entry.recommendedIncrementPercentage))) {
      return "Increment matrix percentage must be a number.";
    }
  }

  return null;
}
