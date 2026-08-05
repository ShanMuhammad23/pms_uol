export interface EntityRecord {
  id: number;
  name: string;
  entityCategoryId: number;
  categoryCode: string;
  parentEntityId: number | null;
  parentName: string | null;
  /** Users assigned to this entity or any descendant in the org tree. */
  staffCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntityInput {
  name: string;
  entityCategoryId: number;
  parentEntityId?: number | null;
}

export interface UpdateEntityInput {
  name: string;
  entityCategoryId: number;
  parentEntityId?: number | null;
}
