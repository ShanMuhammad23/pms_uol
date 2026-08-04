import {
  ENTITY_CATEGORY_CODES,
  type CreateEntityCategoryInput,
  type EntityCategoryCode,
  type UpdateEntityCategoryInput,
} from "@/types/entity-categories";

function isValidCode(code: unknown): code is EntityCategoryCode {
  return (
    typeof code === "string" &&
    ENTITY_CATEGORY_CODES.includes(code as EntityCategoryCode)
  );
}

export function validateCreateEntityCategoryInput(
  body: unknown,
): string | null {
  if (!body || typeof body !== "object") {
    return "Request body is required.";
  }

  const input = body as CreateEntityCategoryInput;

  if (!input.code) {
    return "Category code is required.";
  }

  if (!isValidCode(input.code)) {
    return "Category code must be one of C1, C2, or C3.";
  }

  return null;
}

export function validateUpdateEntityCategoryInput(
  body: unknown,
): string | null {
  return validateCreateEntityCategoryInput(body);
}
