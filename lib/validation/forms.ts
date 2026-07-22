import type { FormTemplateInput, QuestionInput } from "@/types/forms";
import {
  CATEGORY_SUB_MAP,
  countAllQuestions,
  EMPLOYEE_CATEGORIES,
  FIELD_TYPES,
  PERFORMANCE_RATINGS,
} from "@/types/forms";

function validateQuestion(
  question: QuestionInput,
  pathPrefix: string,
): string | null {
  if (!question.questionText?.trim()) {
    return `${pathPrefix}: question text is required.`;
  }

  if (!FIELD_TYPES.includes(question.inputType)) {
    return `${pathPrefix}: invalid input type.`;
  }

  if (question.noMarks) {
    if (Number(question.totalMarks) !== 0) {
      return `${pathPrefix}: total marks must be 0 when No Marks is enabled.`;
    }
  } else if (
    question.totalMarks === undefined ||
    question.totalMarks === null ||
    Number.isNaN(Number(question.totalMarks))
  ) {
    return `${pathPrefix}: total marks is required.`;
  } else if (Number(question.totalMarks) <= 0) {
    return `${pathPrefix}: total marks must be greater than 0.`;
  }

  if (["RADIO", "SELECT"].includes(question.inputType)) {
    if (!question.options || question.options.length < 2) {
      return `${pathPrefix}: requires at least two options.`;
    }
  }

  if (question.inputType === "CHECKBOX") {
    if (!question.options || question.options.length < 1) {
      return `${pathPrefix}: requires at least one option.`;
    }
  }

  if (question.options) {
    for (let optionIndex = 0; optionIndex < question.options.length; optionIndex += 1) {
      const option = question.options[optionIndex];

      if (!option.optionLabel?.trim()) {
        return `${pathPrefix}, option ${optionIndex + 1}: label is required.`;
      }

      if (Number.isNaN(Number(option.pointsAssigned))) {
        return `${pathPrefix}, option ${optionIndex + 1}: points must be a number.`;
      }
    }
  }

  return null;
}

export function validateFormTemplateInput(
  input: Partial<FormTemplateInput>,
): string | null {
  if (!input.title?.trim()) {
    return "Form title is required.";
  }

  if (
    input.targetCategory &&
    !EMPLOYEE_CATEGORIES.includes(input.targetCategory)
  ) {
    return "Invalid target category.";
  }

  if (
    input.targetCategory &&
    input.targetSubCategory &&
    !CATEGORY_SUB_MAP[input.targetCategory].includes(input.targetSubCategory)
  ) {
    return "Invalid target sub-category.";
  }

  const sections = input.sections ?? [];
  const rootQuestions = input.questions ?? [];

  if (countAllQuestions(sections, rootQuestions) === 0) {
    return "At least one question is required.";
  }

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex];

    if (!section.title?.trim()) {
      return `Section ${sectionIndex + 1}: title is required.`;
    }

    for (let questionIndex = 0; questionIndex < section.questions.length; questionIndex += 1) {
      const error = validateQuestion(
        section.questions[questionIndex],
        `Section ${sectionIndex + 1}, question ${questionIndex + 1}`,
      );
      if (error) {
        return error;
      }
    }

    for (
      let subsectionIndex = 0;
      subsectionIndex < section.subsections.length;
      subsectionIndex += 1
    ) {
      const subsection = section.subsections[subsectionIndex];

      if (!subsection.title?.trim()) {
        return `Section ${sectionIndex + 1}, subsection ${subsectionIndex + 1}: title is required.`;
      }

      for (
        let questionIndex = 0;
        questionIndex < subsection.questions.length;
        questionIndex += 1
      ) {
        const error = validateQuestion(
          subsection.questions[questionIndex],
          `Section ${sectionIndex + 1}, subsection ${subsectionIndex + 1}, question ${questionIndex + 1}`,
        );
        if (error) {
          return error;
        }
      }
    }
  }

  for (let index = 0; index < rootQuestions.length; index += 1) {
    const error = validateQuestion(rootQuestions[index], `Question ${index + 1}`);
    if (error) {
      return error;
    }
  }

  if (input.incrementMatrices && input.incrementMatrices.length > 0) {
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
  }

  return null;
}
