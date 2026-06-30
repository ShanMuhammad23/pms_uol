import type { EmployeeCategory, SubCategory } from "@/types/forms";
import {
  CATEGORY_SUB_MAP,
  EMPLOYEE_CATEGORIES,
} from "@/types/forms";

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

export interface DepartmentRecord {
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
  empCategory: EmployeeCategory;
  empSubCategory: SubCategory;
  departmentId: number | null;
  departmentName: string | null;
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
  empCategory: EmployeeCategory;
  empSubCategory: SubCategory;
  departmentId?: number | null;
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
  empCategory: EmployeeCategory;
  empSubCategory: SubCategory;
  departmentId?: number | null;
  headId?: number | null;
  isActive?: boolean;
}

export function getSubCategoriesForCategory(
  category: EmployeeCategory,
): SubCategory[] {
  return CATEGORY_SUB_MAP[category];
}

export { EMPLOYEE_CATEGORIES, CATEGORY_SUB_MAP };
