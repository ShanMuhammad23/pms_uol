import { deriveRatingScaleMaxValue } from "@/app/helpers/form-rating-scoring";
import type {
  FormRatingScaleInput,
  FormTemplateInput,
  QuestionInput,
} from "@/types/forms";
import {
  CATEGORY_SUB_MAP,
  countAllQuestions,
  EMPLOYEE_CATEGORIES,
  FIELD_TYPES,
  PERFORMANCE_RATINGS,
} from "@/types/forms";

/** Titles are free text (TEXT columns) — no length limit enforced. */

function validateOpenAssessmentSection(
  section: FormTemplateInput["sections"][number],
  pathPrefix: string,
): string | null {
  if (section.isOpenAssessment) {
    if (
      section.openAssessmentTotalMarks === undefined ||
      section.openAssessmentTotalMarks === null ||
      Number.isNaN(Number(section.openAssessmentTotalMarks))
    ) {
      return `${pathPrefix}: total marks budget is required for open-assessment sections.`;
    }
    if (Number(section.openAssessmentTotalMarks) <= 0) {
      return `${pathPrefix}: total marks budget must be greater than 0 for open-assessment sections.`;
    }
    if (section.questions.length > 0 || section.subsections.length > 0) {
      return `${pathPrefix}: open-assessment sections cannot contain pre-defined questions or subsections.`;
    }
    return null;
  }
  return null;
}

function validateQuestion(
  question: QuestionInput,
  pathPrefix: string,
  ratingBased: boolean,
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

  if (ratingBased && Number(question.totalMarks) > 0) {
    if (!question.ratingScaleId && !question.ratingScaleClientId) {
      return `${pathPrefix}: select a rating dropdown for this scored question.`;
    }
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

function validateRatingScale(
  scale: FormRatingScaleInput,
  pathPrefix: string,
): string | null {
  if (!scale.name?.trim()) {
    return `${pathPrefix}: name is required.`;
  }
  if (!scale.options || scale.options.length < 2) {
    return `${pathPrefix}: add at least two rating options.`;
  }
  for (let index = 0; index < scale.options.length; index += 1) {
    const option = scale.options[index];
    if (!option.optionLabel?.trim()) {
      return `${pathPrefix}, option ${index + 1}: label is required.`;
    }
    if (Number.isNaN(Number(option.ratingValue))) {
      return `${pathPrefix}, option ${index + 1}: rating value must be a number.`;
    }
  }
  if (deriveRatingScaleMaxValue(scale.options) <= 0) {
    return `${pathPrefix}: max rating must be greater than 0.`;
  }
  return null;
}

export function validateFormTemplateInput(
  input: Partial<FormTemplateInput>,
): string | null {
  if (!input.title?.trim()) {
    return "Form title is required.";
  }

  if (!input.code?.trim()) {
    return "Form code is required.";
  }

  if (input.code.length > 50) {
    return "Form code must be 50 characters or fewer.";
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

  const ratingBased = Boolean(input.ratingBased);

  if (ratingBased) {
    const scales = input.ratingScales ?? [];
    if (scales.length === 0) {
      return "Rating-based forms need at least one rating dropdown.";
    }
    for (let scaleIndex = 0; scaleIndex < scales.length; scaleIndex += 1) {
      const scaleError = validateRatingScale(
        scales[scaleIndex],
        `Rating dropdown ${scaleIndex + 1}`,
      );
      if (scaleError) {
        return scaleError;
      }
    }
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

    // Open-assessment sections: validate budget, skip question validation.
    if (section.isOpenAssessment) {
      const openError = validateOpenAssessmentSection(
        section,
        `Section ${sectionIndex + 1}`,
      );
      if (openError) {
        return openError;
      }
      continue;
    }

    for (let questionIndex = 0; questionIndex < section.questions.length; questionIndex += 1) {
        const error = validateQuestion(
          section.questions[questionIndex],
          `Section ${sectionIndex + 1}, question ${questionIndex + 1}`,
          ratingBased,
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
          ratingBased,
        );
        if (error) {
          return error;
        }
      }
    }
  }

  for (let index = 0; index < rootQuestions.length; index += 1) {
    const error = validateQuestion(rootQuestions[index], `Question ${index + 1}`, ratingBased);
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
