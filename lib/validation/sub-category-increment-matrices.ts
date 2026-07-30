import type {
  CreateSubCategoryIncrementMatrixInput,
  UpdateSubCategoryIncrementMatrixInput,
} from "@/types/sub-category-increment-matrices";

function validateIncrementPercentage(value: unknown): string | null {
  const percentage = Number(value);

  if (
    value === undefined ||
    value === null ||
    Number.isNaN(percentage)
  ) {
    return "Increment percentage is required.";
  }

  if (percentage < 1 || percentage > 100) {
    return "Increment percentage must be between 1 and 100.";
  }

  return null;
}

export function validateCreateSubCategoryIncrementMatrixInput(
  input: Partial<CreateSubCategoryIncrementMatrixInput>,
): string | null {
  if (!input.matrixLabel?.trim()) {
    return "Matrix label is required.";
  }

  if (!input.financialYearId || Number.isNaN(Number(input.financialYearId))) {
    return "Financial year is required.";
  }

  if (!input.performanceLevelId || Number.isNaN(Number(input.performanceLevelId))) {
    return "Performance level is required.";
  }

  if (!input.performanceQuartileId || Number.isNaN(Number(input.performanceQuartileId))) {
    return "Performance quartile is required.";
  }

  return validateIncrementPercentage(input.incrementPercentage);
}

export function validateUpdateSubCategoryIncrementMatrixInput(
  input: Partial<UpdateSubCategoryIncrementMatrixInput>,
): string | null {
  if (!input.matrixLabel?.trim()) {
    return "Matrix label is required.";
  }

  if (!input.performanceLevelId || Number.isNaN(Number(input.performanceLevelId))) {
    return "Performance level is required.";
  }

  if (!input.performanceQuartileId || Number.isNaN(Number(input.performanceQuartileId))) {
    return "Performance quartile is required.";
  }

  return validateIncrementPercentage(input.incrementPercentage);
}
