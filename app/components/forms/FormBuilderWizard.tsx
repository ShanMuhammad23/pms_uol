"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/app/components/auth/Button";
import CategoryAssignmentStep from "./steps/CategoryAssignmentStep";
import FormDesignStep from "./steps/FormDesignStep";
import ProcedureSetupStep from "./steps/ProcedureSetupStep";
import {
  createFormTemplate,
  fetchAppraisalCycles,
  fetchIncrementMatrices,
  updateFormTemplate,
} from "@/lib/queries/forms-client";
import type {
  AppraisalCycleRecord,
  EmployeeCategory,
  FormTemplateInput,
  FormTemplateRecord,
  IncrementMatrixInput,
  QuestionInput,
  SubCategory,
} from "@/types/forms";
import {
  CATEGORY_SUB_MAP,
  createDefaultIncrementMatrix,
  createEmptyQuestion,
} from "@/types/forms";
import { cn } from "@/lib/utils";

const STEPS = ["Design", "Category", "Procedure"] as const;

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
    questions: record.questions.map((question) => ({
      questionText: question.questionText,
      inputType: question.inputType,
      isRequired: question.isRequired,
      sortOrder: question.sortOrder,
      selfAssessmentEnabled: question.selfAssessmentEnabled,
      hodAssessmentEnabled: question.hodAssessmentEnabled,
      totalMarks: question.totalMarks,
      options: question.options.map((option) => ({
        optionLabel: option.optionLabel,
        pointsAssigned: option.pointsAssigned,
        sortOrder: option.sortOrder,
      })),
    })),
    incrementMatrices:
      record.incrementMatrices.length > 0
        ? record.incrementMatrices
        : createDefaultIncrementMatrix(),
  };
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
  const [questions, setQuestions] = useState<QuestionInput[]>(
    initialState?.questions ?? [createEmptyQuestion(0)],
  );
  const [targetCategory, setTargetCategory] = useState<EmployeeCategory | "">(
    initialState?.targetCategory ?? "",
  );
  const [targetSubCategory, setTargetSubCategory] = useState<SubCategory | "">(
    initialState?.targetSubCategory ?? "",
  );
  const [cycleId, setCycleId] = useState<number | null>(
    initialState?.cycleId ?? null,
  );
  const [matrixOverrides, setMatrixOverrides] = useState<
    IncrementMatrixInput[] | null
  >(null);
  const [addedCycles, setAddedCycles] = useState<AppraisalCycleRecord[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const cyclesQuery = useQuery({
    queryKey: ["appraisal-cycles"],
    queryFn: fetchAppraisalCycles,
  });

  const matricesQuery = useQuery({
    queryKey: ["increment-matrices", cycleId],
    queryFn: () => fetchIncrementMatrices(cycleId as number),
    enabled: Boolean(cycleId) && !initialData,
  });

  const cycles = useMemo(
    () => [...addedCycles, ...(cyclesQuery.data ?? [])],
    [addedCycles, cyclesQuery.data],
  );

  const incrementMatrices = useMemo(() => {
    if (matrixOverrides) return matrixOverrides;
    if (!initialData && matricesQuery.data && matricesQuery.data.length > 0) {
      return matricesQuery.data;
    }
    return initialState?.incrementMatrices ?? createDefaultIncrementMatrix();
  }, [matrixOverrides, initialData, matricesQuery.data, initialState]);

  const handleCycleChange = useCallback((nextCycleId: number) => {
    setCycleId(nextCycleId);
    setMatrixOverrides(null);
  }, []);

  const handleMatricesChange = useCallback((matrices: IncrementMatrixInput[]) => {
    setMatrixOverrides(matrices);
  }, []);

  const payload = useMemo<FormTemplateInput | null>(() => {
    if (!targetCategory || !targetSubCategory || !cycleId) {
      return null;
    }

    return {
      title: title.trim(),
      description: description.trim(),
      cycleId,
      targetCategory,
      targetSubCategory,
      questions,
      incrementMatrices,
    };
  }, [
    title,
    description,
    cycleId,
    targetCategory,
    targetSubCategory,
    questions,
    incrementMatrices,
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

    if (questions.length === 0) {
      nextErrors.questions = "At least one question is required.";
    }

    questions.forEach((question, index) => {
      if (!question.questionText.trim()) {
        nextErrors[`question-${index}`] = "Question text is required.";
      }

      if (
        question.totalMarks === undefined ||
        question.totalMarks === null ||
        Number.isNaN(Number(question.totalMarks)) ||
        Number(question.totalMarks) <= 0
      ) {
        nextErrors[`question-${index}-marks`] =
          "Total marks is required and must be greater than 0.";
      }

      if (["RADIO", "SELECT"].includes(question.inputType)) {
        if (question.options.length < 2) {
          nextErrors[`question-${index}`] =
            "Radio and dropdown questions need at least two options.";
        }
      }

      if (question.inputType === "CHECKBOX" && question.options.length < 1) {
        nextErrors[`question-${index}`] =
          "Checkbox questions need at least one option.";
      }

      question.options.forEach((option, optionIndex) => {
        if (!option.optionLabel.trim()) {
          nextErrors[`question-${index}`] =
            `Option ${optionIndex + 1} label is required.`;
        }
      });
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

  const validateProcedureStep = () => {
    const nextErrors: Record<string, string> = {};

    if (!cycleId) {
      nextErrors.cycleId = "Appraisal cycle is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    setSubmitError(null);

    if (step === 0 && !validateDesignStep()) {
      return;
    }

    if (step === 1 && !validateCategoryStep()) {
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

    if (!validateProcedureStep() || !payload) {
      return;
    }

    saveMutation.mutate(payload);
  };

  const handleCategoryChange = (category: EmployeeCategory) => {
    setTargetCategory(category);
    setTargetSubCategory("");
  };

  const handleCycleCreated = (cycle: AppraisalCycleRecord) => {
    setAddedCycles((current) => [cycle, ...current]);
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
            questions={questions}
            errors={errors}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            onQuestionsChange={setQuestions}
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

        {step === 2 ? (
          <ProcedureSetupStep
            cycles={cycles}
            cycleId={cycleId}
            incrementMatrices={incrementMatrices}
            errors={errors}
            onCycleChange={handleCycleChange}
            onMatricesChange={handleMatricesChange}
            onCycleCreated={handleCycleCreated}
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
