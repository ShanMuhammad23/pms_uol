import type { EmployeeCategory, SubCategory } from "@/types/forms";
import {
  CATEGORY_SUB_MAP,
  EMPLOYEE_CATEGORIES,
} from "@/types/forms";
import type { CreateUserInput, UpdateUserInput, UserRole } from "@/types/users";
import { USER_ROLES } from "@/types/users";

const MAX_EMPLOYEE_ID = 30;
const MAX_EMAIL = 150;
const MAX_NAME = 50;
const MIN_PASSWORD = 8;

function isValidEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function parseOptionalId(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return Number.NaN;
  }

  return id;
}

function validateSubCategory(
  empCategory: EmployeeCategory,
  empSubCategory: SubCategory,
): string | null {
  const allowed = CATEGORY_SUB_MAP[empCategory];

  if (!allowed.includes(empSubCategory)) {
    return "Sub-category does not match the selected employee category.";
  }

  return null;
}

function validateSharedFields(body: CreateUserInput | UpdateUserInput): string | null {
  if (!body.employeeId || typeof body.employeeId !== "string" || !body.employeeId.trim()) {
    return "Employee ID is required.";
  }

  if (body.employeeId.trim().length > MAX_EMPLOYEE_ID) {
    return `Employee ID must be ${MAX_EMPLOYEE_ID} characters or fewer.`;
  }

  if (!body.email || typeof body.email !== "string" || !body.email.trim()) {
    return "Email is required.";
  }

  if (body.email.trim().length > MAX_EMAIL) {
    return `Email must be ${MAX_EMAIL} characters or fewer.`;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return "Enter a valid email address.";
  }

  if (!body.firstName || typeof body.firstName !== "string" || !body.firstName.trim()) {
    return "First name is required.";
  }

  if (body.firstName.trim().length > MAX_NAME) {
    return `First name must be ${MAX_NAME} characters or fewer.`;
  }

  if (!body.lastName || typeof body.lastName !== "string" || !body.lastName.trim()) {
    return "Last name is required.";
  }

  if (body.lastName.trim().length > MAX_NAME) {
    return `Last name must be ${MAX_NAME} characters or fewer.`;
  }

  if (!isValidEnumValue(body.systemRole, USER_ROLES)) {
    return "A valid system role is required.";
  }

  if (!isValidEnumValue(body.empCategory, EMPLOYEE_CATEGORIES)) {
    return "A valid employee category is required.";
  }

  if (!isValidEnumValue(body.empSubCategory, CATEGORY_SUB_MAP[body.empCategory])) {
    return "A valid sub-category is required.";
  }

  const subCategoryError = validateSubCategory(body.empCategory, body.empSubCategory);
  if (subCategoryError) {
    return subCategoryError;
  }

  const entityId = parseOptionalId(body.entityId);
  if (entityId !== undefined && Number.isNaN(entityId)) {
    return "Entity id must be a positive integer or null.";
  }

  const headId = parseOptionalId(body.headId);
  if (headId !== undefined && Number.isNaN(headId)) {
    return "Head id must be a positive integer or null.";
  }

  return null;
}

export function validateCreateUserInput(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return "Request body is required.";
  }

  const input = body as CreateUserInput;
  const sharedError = validateSharedFields(input);

  if (sharedError) {
    return sharedError;
  }

  if (!input.password || typeof input.password !== "string") {
    return "Password is required.";
  }

  if (input.password.length < MIN_PASSWORD) {
    return `Password must be at least ${MIN_PASSWORD} characters.`;
  }

  return null;
}

export function validateUpdateUserInput(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return "Request body is required.";
  }

  const input = body as UpdateUserInput;
  const sharedError = validateSharedFields(input);

  if (sharedError) {
    return sharedError;
  }

  if (input.password !== undefined) {
    if (typeof input.password !== "string" || input.password.length === 0) {
      return "Password must be a non-empty string when provided.";
    }

    if (input.password.length < MIN_PASSWORD) {
      return `Password must be at least ${MIN_PASSWORD} characters.`;
    }
  }

  return null;
}

export function normalizeUserInput(
  body: CreateUserInput | UpdateUserInput,
): {
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  systemRole: UserRole;
  empCategory: EmployeeCategory;
  empSubCategory: SubCategory;
  entityId: number | null;
  headId: number | null;
  isActive: boolean;
} {
  const entityId = parseOptionalId(body.entityId);
  const headId = parseOptionalId(body.headId);

  return {
    employeeId: body.employeeId.trim(),
    email: body.email.trim().toLowerCase(),
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    systemRole: body.systemRole,
    empCategory: body.empCategory,
    empSubCategory: body.empSubCategory,
    entityId: entityId ?? null,
    headId: headId ?? null,
    isActive: body.isActive ?? true,
  };
}
