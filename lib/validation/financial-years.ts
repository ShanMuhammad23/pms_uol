import type {
  CreateFinancialYearInput,
  UpdateFinancialYearInput,
} from "@/types/financial-years";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDateParts(value: string): {
  year: number;
  month: number;
  day: number;
} | null {
  if (!ISO_DATE_RE.test(value)) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const asDate = new Date(year, month - 1, day);
  if (
    asDate.getFullYear() !== year ||
    asDate.getMonth() !== month - 1 ||
    asDate.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function compareIsoDates(a: string, b: string): number {
  return a.localeCompare(b);
}

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

  if (
    !input.cycleStartDate ||
    typeof input.cycleStartDate !== "string" ||
    !parseIsoDateParts(input.cycleStartDate.trim())
  ) {
    return "Cycle start date is required (YYYY-MM-DD).";
  }

  if (
    !input.ineligibilityDate ||
    typeof input.ineligibilityDate !== "string" ||
    !parseIsoDateParts(input.ineligibilityDate.trim())
  ) {
    return "Ineligibility date is required (YYYY-MM-DD).";
  }

  const cycleStartDate = input.cycleStartDate.trim();
  const ineligibilityDate = input.ineligibilityDate.trim();

  if (compareIsoDates(ineligibilityDate, cycleStartDate) < 0) {
    return "Ineligibility date cannot be earlier than cycle start date.";
  }

  return null;
}

export function validateCreateFinancialYearInput(body: unknown): string | null {
  return validateFields(body);
}

export function validateUpdateFinancialYearInput(body: unknown): string | null {
  return validateFields(body);
}
