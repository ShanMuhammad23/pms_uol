export interface EntityRecord {
  id: number;
  name: string;
  entityCategoryId: number;
  categoryCode: string;
  parentEntityId: number | null;
  parentName: string | null;
  /** Users with users.entity_id pointing at this entity. */
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
