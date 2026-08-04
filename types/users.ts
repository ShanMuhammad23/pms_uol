export type UserRole =
  | "EMPLOYEE"
  | "MANAGER"
  | "HR"
  | "BOARD"
  | "SUPER_ADMIN";

export const USER_ROLES: UserRole[] = [
  "EMPLOYEE",
  "MANAGER",
  "HR",
  "BOARD",
  "SUPER_ADMIN",
];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
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
  /** Designates whether this user can be assigned as Manager 1 or Manager 2. */
  isManagerEligible: boolean;
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
  isManagerEligible?: boolean;
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
  isManagerEligible?: boolean;
  isActive?: boolean;
}

