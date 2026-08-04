export const ENTITY_CATEGORY_CODES = ["C1", "C2", "C3"] as const;

export type EntityCategoryCode = (typeof ENTITY_CATEGORY_CODES)[number];

export interface EntityCategoryRecord {
  id: number;
  code: EntityCategoryCode;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntityCategoryInput {
  code: EntityCategoryCode;
}

export interface UpdateEntityCategoryInput {
  code: EntityCategoryCode;
}
