import type { FormTemplateInput } from "@/types/forms";
import { FIELD_TYPES } from "@/types/forms";

export function validateFormTemplateInput(
  input: Partial<FormTemplateInput>,
): string | null {
  if (!input.title?.trim()) {
    return "Form title is required.";
  }

  if (
    !input.staffCategoryId ||
    Number.isNaN(Number(input.staffCategoryId))
  ) {
    return "Staff category is required.";
  }

  if (
    !input.staffSubCategoryId ||
    Number.isNaN(Number(input.staffSubCategoryId))
  ) {
    return "Staff sub-category is required.";
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

    if (
      question.totalMarks === undefined ||
      question.totalMarks === null ||
      Number.isNaN(Number(question.totalMarks))
    ) {
      return `Question ${index + 1}: total marks is required.`;
    }

    if (Number(question.totalMarks) <= 0) {
      return `Question ${index + 1}: total marks must be greater than 0.`;
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

  return null;
}
