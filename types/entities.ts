export interface EntityRecord {
  id: number;
  name: string;
  entityCategoryId: number;
  categoryCode: string;
  campusId: number | null;
  campusName: string | null;
  parentEntityId: number | null;
  parentName: string | null;
  /** Category code of the parent entity, when a parent exists. */
  parentCategoryCode: string | null;
  /** Users assigned to this entity or any descendant in the org tree. */
  staffCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntityInput {
  name: string;
  entityCategoryId: number;
  campusId?: number | null;
  parentEntityId?: number | null;
}

export interface UpdateEntityInput {
  name: string;
  entityCategoryId: number;
  campusId?: number | null;
  parentEntityId?: number | null;
}
