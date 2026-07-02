export type UserRole =
  | "EMPLOYEE"
  | "HEAD"
  | "HR"
  | "BOARD"
  | "SUPER_ADMIN";

export const USER_ROLES: UserRole[] = [
  "EMPLOYEE",
  "HEAD",
  "HR",
  "BOARD",
  "SUPER_ADMIN",
];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  EMPLOYEE: "Employee",
  HEAD: "Head",
  HR: "HR",
  BOARD: "Board",
  SUPER_ADMIN: "Super Admin",
};

export interface EntityOptionRecord {
  id: number;
  name: string;
}

export interface UserRecord {
  id: number;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  systemRole: UserRole;
  empCategory: string;
  empSubCategory: string;
  staffCategoryId: number | null;
  staffCategoryName: string | null;
  staffSubCategoryId: number | null;
  staffSubCategoryName: string | null;
  entityId: number | null;
  entityName: string | null;
  headId: number | null;
  headName: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserInput {
  employeeId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  systemRole: UserRole;
  empCategory: string;
  empSubCategory: string;
  staffCategoryId?: number | null;
  staffSubCategoryId?: number | null;
  entityId?: number | null;
  headId?: number | null;
  isActive?: boolean;
}

export interface UpdateUserInput {
  employeeId: string;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  systemRole: UserRole;
  empCategory: string;
  empSubCategory: string;
  staffCategoryId?: number | null;
  staffSubCategoryId?: number | null;
  entityId?: number | null;
  headId?: number | null;
  isActive?: boolean;
}

