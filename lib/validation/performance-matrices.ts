import type {
  CreatePerformanceLevelInput,
  CreatePerformanceQuartileInput,
  UpdatePerformanceLevelInput,
  UpdatePerformanceQuartileInput,
} from "@/types/performance-matrices";

export function validateCreatePerformanceLevelInput(
  body: unknown,
): string | null {
  if (!body || typeof body !== "object") {
    return "Request body is required.";
  }

  const input = body as CreatePerformanceLevelInput;

  if (
    input.financialYearId === undefined ||
    !Number.isInteger(input.financialYearId) ||
    input.financialYearId <= 0
  ) {
    return "A valid financial year is required.";
  }

  if (!input.name || typeof input.name !== "string" || !input.name.trim()) {
    return "Level name is required.";
  }

  if (input.name.trim().length > 100) {
    return "Level name must be 100 characters or fewer.";
  }

  if (
    input.sortOrder !== undefined &&
    (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)
  ) {
    return "Sort order must be a non-negative integer.";
  }

  return null;
}

export function validateUpdatePerformanceLevelInput(
  body: unknown,
): string | null {
  if (!body || typeof body !== "object") {
    return "Request body is required.";
  }

  const input = body as UpdatePerformanceLevelInput;

  if (!input.name || typeof input.name !== "string" || !input.name.trim()) {
    return "Level name is required.";
  }

  if (input.name.trim().length > 100) {
    return "Level name must be 100 characters or fewer.";
  }

  if (
    input.sortOrder !== undefined &&
    (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)
  ) {
    return "Sort order must be a non-negative integer.";
  }

  return null;
}

function validateQuartileFields(
  input: CreatePerformanceQuartileInput | UpdatePerformanceQuartileInput,
  requireLevelId: boolean,
): string | null {
  if (
    requireLevelId &&
    "performanceLevelId" in input &&
    (input.performanceLevelId === undefined ||
      !Number.isInteger(input.performanceLevelId) ||
      input.performanceLevelId <= 0)
  ) {
    return "A valid performance level is required.";
  }

  if (!input.name || typeof input.name !== "string" || !input.name.trim()) {
    return "Quartile name is required.";
  }

  if (input.name.trim().length > 100) {
    return "Quartile name must be 100 characters or fewer.";
  }

  if (!Number.isInteger(input.scoreMin)) {
    return "Minimum score must be an integer.";
  }

  if (!Number.isInteger(input.scoreMax)) {
    return "Maximum score must be an integer.";
  }

  if (input.scoreMin >= input.scoreMax) {
    return "Minimum score must be less than maximum score.";
  }

  if (
    input.sortOrder !== undefined &&
    (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)
  ) {
    return "Sort order must be a non-negative integer.";
  }

  return null;
}

export function validateCreatePerformanceQuartileInput(
  body: unknown,
): string | null {
  if (!body || typeof body !== "object") {
    return "Request body is required.";
  }

  return validateQuartileFields(body as CreatePerformanceQuartileInput, true);
}

export function validateUpdatePerformanceQuartileInput(
  body: unknown,
): string | null {
  if (!body || typeof body !== "object") {
    return "Request body is required.";
  }

  return validateQuartileFields(body as UpdatePerformanceQuartileInput, false);
}
