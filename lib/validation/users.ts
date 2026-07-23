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

function parseOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalYear(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const year = Number(value);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return Number.NaN;
  }

  return year;
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

  if (!body.empCategory || typeof body.empCategory !== "string" || !body.empCategory.trim()) {
    return "A valid employee category is required.";
  }

  if (!body.empSubCategory || typeof body.empSubCategory !== "string" || !body.empSubCategory.trim()) {
    return "A valid sub-category is required.";
  }

  const entityId = parseOptionalId(body.entityId);
  if (entityId !== undefined && Number.isNaN(entityId)) {
    return "Entity id must be a positive integer or null.";
  }

  const headId = parseOptionalId(body.headId);
  if (headId !== undefined && Number.isNaN(headId)) {
    return "Head id must be a positive integer or null.";
  }

  const manager2Id = parseOptionalId(body.manager2Id);
  if (manager2Id !== undefined && Number.isNaN(manager2Id)) {
    return "Manager 2 id must be a positive integer or null.";
  }

  if ("dateOfJoining" in body && body.dateOfJoining != null && body.dateOfJoining !== "") {
    if (typeof body.dateOfJoining !== "string" || Number.isNaN(Date.parse(body.dateOfJoining))) {
      return "Date of joining must be a valid date.";
    }
  }

  if ("qualificationYear" in body) {
    const year = parseOptionalYear(body.qualificationYear);
    if (year !== undefined && Number.isNaN(year)) {
      return "Qualification year must be a valid year.";
    }
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
  designation: string | null | undefined;
  roleCategory: string | null | undefined;
  gradeGroup: string | null | undefined;
  dateOfJoining: string | null | undefined;
  systemRole: UserRole;
  empCategory: string;
  empSubCategory: string;
  entityId: number | null;
  headId: number | null;
  manager2Id: number | null;
  qualification: string | null | undefined;
  qualificationYear: number | null | undefined;
  qualificationSubject: string | null | undefined;
  qualificationInstitute: string | null | undefined;
  qualificationCountry: string | null | undefined;
  isActive: boolean;
} {
  const entityId = parseOptionalId(body.entityId);
  const headId = parseOptionalId(body.headId);
  const manager2Id = parseOptionalId(body.manager2Id);
  const updateBody = body as UpdateUserInput;

  const dateOfJoining =
    updateBody.dateOfJoining === undefined
      ? undefined
      : updateBody.dateOfJoining === null || updateBody.dateOfJoining === ""
        ? null
        : updateBody.dateOfJoining.slice(0, 10);

  return {
    employeeId: body.employeeId.trim(),
    email: body.email.trim().toLowerCase(),
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    designation: parseOptionalString(updateBody.designation),
    roleCategory: parseOptionalString(updateBody.roleCategory),
    gradeGroup: parseOptionalString(updateBody.gradeGroup),
    dateOfJoining,
    systemRole: body.systemRole,
    empCategory: body.empCategory.trim(),
    empSubCategory: body.empSubCategory.trim(),
    entityId: entityId ?? null,
    headId: headId ?? null,
    manager2Id: manager2Id ?? null,
    qualification: parseOptionalString(updateBody.qualification),
    qualificationYear: parseOptionalYear(updateBody.qualificationYear),
    qualificationSubject: parseOptionalString(updateBody.qualificationSubject),
    qualificationInstitute: parseOptionalString(updateBody.qualificationInstitute),
    qualificationCountry: parseOptionalString(updateBody.qualificationCountry),
    isActive: body.isActive ?? true,
  };
}
