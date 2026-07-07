import {
  CATEGORY_SUB_MAP,
  EMPLOYEE_CATEGORIES,
} from "@/types/forms";
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

function validateCategoryPair(
  targetCategory: CreateSubCategoryIncrementMatrixInput["targetCategory"] | undefined,
  targetSubCategory: CreateSubCategoryIncrementMatrixInput["targetSubCategory"] | undefined,
): string | null {
  if (!targetCategory || !EMPLOYEE_CATEGORIES.includes(targetCategory)) {
    return "Employee category is required.";
  }

  if (
    !targetSubCategory ||
    !CATEGORY_SUB_MAP[targetCategory].includes(targetSubCategory)
  ) {
    return "Sub-category is required and must belong to the selected category.";
  }

  return null;
}

export function validateCreateSubCategoryIncrementMatrixInput(
  input: Partial<CreateSubCategoryIncrementMatrixInput>,
): string | null {
  if (!input.financialYearId || Number.isNaN(Number(input.financialYearId))) {
    return "Financial year is required.";
  }

  const categoryError = validateCategoryPair(
    input.targetCategory,
    input.targetSubCategory,
  );
  if (categoryError) {
    return categoryError;
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
  const categoryError = validateCategoryPair(
    input.targetCategory,
    input.targetSubCategory,
  );
  if (categoryError) {
    return categoryError;
  }

  if (!input.performanceLevelId || Number.isNaN(Number(input.performanceLevelId))) {
    return "Performance level is required.";
  }

  if (!input.performanceQuartileId || Number.isNaN(Number(input.performanceQuartileId))) {
    return "Performance quartile is required.";
  }

  return validateIncrementPercentage(input.incrementPercentage);
}
