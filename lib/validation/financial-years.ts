import type {
  CreateFinancialYearInput,
  UpdateFinancialYearInput,
} from "@/types/financial-years";

function validateFields(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return "Request body is required.";
  }

  const input = body as CreateFinancialYearInput | UpdateFinancialYearInput;

  if (input.year === undefined || input.year === null) {
    return "Year is required.";
  }

  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    return "Year must be a valid integer between 2000 and 2100.";
  }

  if (!input.label || typeof input.label !== "string" || !input.label.trim()) {
    return "Label is required.";
  }

  if (input.label.trim().length > 20) {
    return "Label must be 20 characters or fewer.";
  }

  if (
    input.isActive !== undefined &&
    typeof input.isActive !== "boolean"
  ) {
    return "isActive must be a boolean.";
  }

  return null;
}

export function validateCreateFinancialYearInput(body: unknown): string | null {
  return validateFields(body);
}

export function validateUpdateFinancialYearInput(body: unknown): string | null {
  return validateFields(body);
}
