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
  designation: string | null;
  roleCategory: string | null;
  gradeGroup: string | null;
  dateOfJoining: string | null;
  systemRole: UserRole;
  empCategory: string;
  empSubCategory: string;
  entityId: number | null;
  entityName: string | null;
  parentEntityName: string | null;
  headId: number | null;
  headName: string | null;
  /** Manager 2 — second-level appraisal reviewer (editable per user). */
  manager2Id: number | null;
  manager2Name: string | null;
  qualification: string | null;
  qualificationYear: string | null;
  qualificationSubject: string | null;
  qualificationInstitute: string | null;
  qualificationCountry: string | null;
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
  entityId?: number | null;
  headId?: number | null;
  manager2Id?: number | null;
  isActive?: boolean;
}

export interface UpdateUserInput {
  employeeId: string;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  designation?: string | null;
  roleCategory?: string | null;
  gradeGroup?: string | null;
  dateOfJoining?: string | null;
  systemRole: UserRole;
  empCategory: string;
  empSubCategory: string;
  entityId?: number | null;
  headId?: number | null;
  manager2Id?: number | null;
  qualification?: string | null;
  qualificationYear?: number | null;
  qualificationSubject?: string | null;
  qualificationInstitute?: string | null;
  qualificationCountry?: string | null;
  isActive?: boolean;
}

