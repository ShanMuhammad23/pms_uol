import type { CreateEntityInput } from "@/types/entities";

const MAX_NAME_LENGTH = 150;

function parseOptionalParentId(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const parentId = Number(value);

  if (!Number.isInteger(parentId) || parentId <= 0) {
    return Number.NaN;
  }

  return parentId;
}

function parseOptionalCampusId(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const campusId = Number(value);

  if (!Number.isInteger(campusId) || campusId <= 0) {
    return Number.NaN;
  }

  return campusId;
}

export function validateCreateEntityInput(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return "Request body is required.";
  }

  const input = body as CreateEntityInput;

  if (!input.name || typeof input.name !== "string" || !input.name.trim()) {
    return "Entity name is required.";
  }

  if (input.name.trim().length > MAX_NAME_LENGTH) {
    return `Entity name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  const categoryId = Number(input.entityCategoryId);

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return "A valid entity category is required.";
  }

  const parentEntityId = parseOptionalParentId(input.parentEntityId);

  if (parentEntityId !== undefined && Number.isNaN(parentEntityId)) {
    return "Parent entity id must be a positive integer or null.";
  }

  const campusId = parseOptionalCampusId(input.campusId);

  if (campusId !== undefined && Number.isNaN(campusId)) {
    return "Campus id must be a positive integer or null.";
  }

  return null;
}

export function validateUpdateEntityInput(body: unknown): string | null {
  return validateCreateEntityInput(body);
}

export function normalizeEntityInput(body: CreateEntityInput): {
  name: string;
  entityCategoryId: number;
  campusId: number | null;
  parentEntityId: number | null;
} {
  const parentEntityId = parseOptionalParentId(body.parentEntityId);
  const campusId = parseOptionalCampusId(body.campusId);

  return {
    name: body.name.trim(),
    entityCategoryId: Number(body.entityCategoryId),
    campusId: campusId ?? null,
    parentEntityId: parentEntityId ?? null,
  };
}
