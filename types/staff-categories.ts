export interface StaffCategoryRecord {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffSubCategoryRecord {
  id: number;
  name: string;
  staffCategoryId: number;
  staffCategoryName: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffCategoryWithSubCategories extends StaffCategoryRecord {
  subCategories: Array<{ id: number; name: string }>;
}

export interface CreateStaffCategoryInput {
  name: string;
}

export interface UpdateStaffCategoryInput {
  name: string;
}

export interface CreateStaffSubCategoryInput {
  name: string;
  staffCategoryId: number;
}

export interface UpdateStaffSubCategoryInput {
  name: string;
  staffCategoryId: number;
}
