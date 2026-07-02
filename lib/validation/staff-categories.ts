import type {
  CreateStaffCategoryInput,
  CreateStaffSubCategoryInput,
  UpdateStaffCategoryInput,
  UpdateStaffSubCategoryInput,
} from "@/types/staff-categories";

const MAX_NAME_LENGTH = 100;

function validateName(name: unknown, label: string): string | null {
  if (typeof name !== "string" || !name.trim()) {
    return `${label} name is required.`;
  }

  if (name.trim().length > MAX_NAME_LENGTH) {
    return `${label} name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  return null;
}

function validatePositiveId(value: unknown, label: string): string | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return `${label} must be a positive integer.`;
  }
  return null;
}

export function validateCreateStaffCategoryInput(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return "Request body is required.";
  }
  return validateName((body as CreateStaffCategoryInput).name, "Category");
}

export function validateUpdateStaffCategoryInput(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return "Request body is required.";
  }
  return validateName((body as UpdateStaffCategoryInput).name, "Category");
}

export function validateCreateStaffSubCategoryInput(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return "Request body is required.";
  }

  const input = body as CreateStaffSubCategoryInput;
  const nameError = validateName(input.name, "Sub-category");
  if (nameError) {
    return nameError;
  }

  return validatePositiveId(input.staffCategoryId, "staffCategoryId");
}

export function validateUpdateStaffSubCategoryInput(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return "Request body is required.";
  }

  const input = body as UpdateStaffSubCategoryInput;
  const nameError = validateName(input.name, "Sub-category");
  if (nameError) {
    return nameError;
  }

  return validatePositiveId(input.staffCategoryId, "staffCategoryId");
}
