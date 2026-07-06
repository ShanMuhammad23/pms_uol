"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/app/components/auth/Button";
import CategoryAssignmentStep from "./steps/CategoryAssignmentStep";
import FormDesignStep from "./steps/FormDesignStep";
import {
  createFormTemplate,
  updateFormTemplate,
} from "@/lib/queries/forms-client";
import type {
  EmployeeCategory,
  FormSectionInput,
  FormTemplateInput,
  FormTemplateRecord,
  QuestionInput,
  SubCategory,
} from "@/types/forms";
import {
  CATEGORY_SUB_MAP,
  countAllQuestions,
  createClientId,
  mapQuestionRecordToInput,
} from "@/types/forms";
import { cn } from "@/lib/utils";

const STEPS = ["Design", "Category"] as const;

interface FormBuilderWizardProps {
  templateId?: number;
  initialData?: FormTemplateRecord;
}

function mapRecordToState(record: FormTemplateRecord) {
  return {
    title: record.title,
    description: record.description ?? "",
    targetCategory: record.targetCategory,
    targetSubCategory: record.targetSubCategory,
    cycleId: record.cycleId,
    sections: record.sections.map((section) => ({
      clientId: createClientId(),
      title: section.title,
      sortOrder: section.sortOrder,
      questions: section.questions.map(mapQuestionRecordToInput),
      subsections: section.subsections.map((subsection) => ({
        clientId: createClientId(),
        title: subsection.title,
        sortOrder: subsection.sortOrder,
        questions: subsection.questions.map(mapQuestionRecordToInput),
      })),
    })),
    questions: record.questions.map(mapQuestionRecordToInput),
  };
}

function validateQuestionFields(
  question: QuestionInput,
  errorPrefix: string,
  nextErrors: Record<string, string>,
) {
  if (!question.questionText.trim()) {
    nextErrors[errorPrefix] = "Question text is required.";
  }

  if (
    question.totalMarks === undefined ||
    question.totalMarks === null ||
    Number.isNaN(Number(question.totalMarks)) ||
    Number(question.totalMarks) <= 0
  ) {
    nextErrors[`${errorPrefix}-marks`] =
      "Total marks is required and must be greater than 0.";
  }

  if (["RADIO", "SELECT"].includes(question.inputType)) {
    if (question.options.length < 2) {
      nextErrors[errorPrefix] =
        "Radio and dropdown questions need at least two options.";
    }
  }

  if (question.inputType === "CHECKBOX" && question.options.length < 1) {
    nextErrors[errorPrefix] =
      "Checkbox questions need at least one option.";
  }

  question.options.forEach((option, optionIndex) => {
    if (!option.optionLabel.trim()) {
      nextErrors[errorPrefix] = `Option ${optionIndex + 1} label is required.`;
    }
  });
}

export default function FormBuilderWizard({
  templateId,
  initialData,
}: FormBuilderWizardProps) {
  const router = useRouter();
  const initialState = initialData ? mapRecordToState(initialData) : null;

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(initialState?.title ?? "");
  const [description, setDescription] = useState(initialState?.description ?? "");
  const [sections, setSections] = useState<FormSectionInput[]>(
    initialState?.sections ?? [],
  );
  const [questions, setQuestions] = useState<QuestionInput[]>(
    initialState?.questions ?? [],
  );
  const [targetCategory, setTargetCategory] = useState<EmployeeCategory | "">(
    initialState?.targetCategory ?? "",
  );
  const [targetSubCategory, setTargetSubCategory] = useState<SubCategory | "">(
    initialState?.targetSubCategory ?? "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const payload = useMemo<FormTemplateInput | null>(() => {
    if (!targetCategory || !targetSubCategory) {
      return null;
    }

    return {
      title: title.trim(),
      description: description.trim(),
      targetCategory,
      targetSubCategory,
      sections,
      questions,
      ...(templateId && initialState?.cycleId
        ? { cycleId: initialState.cycleId }
        : {}),
    };
  }, [
    title,
    description,
    targetCategory,
    targetSubCategory,
    sections,
    questions,
    templateId,
    initialState?.cycleId,
  ]);

  const saveMutation = useMutation({
    mutationFn: async (input: FormTemplateInput) => {
      if (templateId) {
        return updateFormTemplate(templateId, input);
      }

      return createFormTemplate(input);
    },
    onSuccess: () => {
      router.push("/dashboard/forms");
      router.refresh();
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
    },
  });

  const validateDesignStep = () => {
    const nextErrors: Record<string, string> = {};

    if (!title.trim()) {
      nextErrors.title = "Form title is required.";
    }

    if (countAllQuestions(sections, questions) === 0) {
      nextErrors.questions = "At least one question is required.";
    }

    sections.forEach((section, sectionIndex) => {
      if (!section.title.trim()) {
        nextErrors[`section-${sectionIndex}-title`] = "Section title is required.";
      }

      section.questions.forEach((question, questionIndex) => {
        validateQuestionFields(
          question,
          `section-${sectionIndex}-question-${questionIndex}`,
          nextErrors,
        );
      });

      section.subsections.forEach((subsection, subsectionIndex) => {
        if (!subsection.title.trim()) {
          nextErrors[`section-${sectionIndex}-sub-${subsectionIndex}-title`] =
            "Subsection title is required.";
        }

        subsection.questions.forEach((question, questionIndex) => {
          validateQuestionFields(
            question,
            `section-${sectionIndex}-sub-${subsectionIndex}-question-${questionIndex}`,
            nextErrors,
          );
        });
      });
    });

    questions.forEach((question, index) => {
      validateQuestionFields(question, `question-${index}`, nextErrors);
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateCategoryStep = () => {
    const nextErrors: Record<string, string> = {};

    if (!targetCategory) {
      nextErrors.targetCategory = "Employee category is required.";
    }

    if (!targetSubCategory) {
      nextErrors.targetSubCategory = "Sub-category is required.";
    }

    if (
      targetCategory &&
      targetSubCategory &&
      !CATEGORY_SUB_MAP[targetCategory].includes(targetSubCategory)
    ) {
      nextErrors.targetSubCategory =
        "Selected sub-category does not belong to the chosen category.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    setSubmitError(null);

    if (step === 0 && !validateDesignStep()) {
      return;
    }

    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setSubmitError(null);
    setErrors({});
    setStep((current) => Math.max(current - 1, 0));
  };

  const handleSubmit = () => {
    setSubmitError(null);

    if (!validateCategoryStep() || !payload) {
      return;
    }

    saveMutation.mutate(payload);
  };

  const handleCategoryChange = (category: EmployeeCategory) => {
    setTargetCategory(category);
    setTargetSubCategory("");
  };

  const handleStructureChange = (
    nextSections: FormSectionInput[],
    nextQuestions: QuestionInput[],
  ) => {
    setSections(nextSections);
    setQuestions(nextQuestions);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {STEPS.map((label, index) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                index === step
                  ? "bg-primary text-white"
                  : index < step
                    ? "bg-primary/20 text-primary"
                    : "bg-slate-200 text-foreground/60 dark:bg-white/10",
              )}
            >
              {index + 1}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                index === step ? "text-text-primary" : "text-foreground/60",
              )}
            >
              {label}
            </span>
            {index < STEPS.length - 1 ? (
              <span className="mx-1 h-px w-8 bg-slate-300 dark:bg-white/15" />
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-300/80 bg-surface p-6 dark:border-white/15">
        {step === 0 ? (
          <FormDesignStep
            title={title}
            description={description}
            sections={sections}
            questions={questions}
            errors={errors}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            onStructureChange={handleStructureChange}
          />
        ) : null}

        {step === 1 ? (
          <CategoryAssignmentStep
            targetCategory={targetCategory}
            targetSubCategory={targetSubCategory}
            errors={errors}
            onCategoryChange={handleCategoryChange}
            onSubCategoryChange={setTargetSubCategory}
          />
        ) : null}
      </div>

      {submitError ? (
        <p className="text-sm text-red-600">{submitError}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className="!w-auto px-5"
          onClick={goBack}
          disabled={step === 0 || saveMutation.isPending}
        >
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button type="button" className="!w-auto px-5" onClick={goNext}>
            Next
          </Button>
        ) : (
          <Button
            type="button"
            className="!w-auto px-5"
            isLoading={saveMutation.isPending}
            onClick={handleSubmit}
          >
            {templateId ? "Update Form" : "Publish Form"}
          </Button>
        )}
      </div>
    </div>
  );
}
