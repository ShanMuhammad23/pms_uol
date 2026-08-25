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
  qualification: string | null;
  qualificationYear: string | null;
  qualificationSubject: string | null;
  qualificationInstitute: string | null;
  qualificationCountry: string | null;
  isActive: boolean;
  createdAt: string;
  /** Whether the user is eligible for assessment (defaults to true when column is absent). */
  assessmentEligibility: boolean;
  /** Whether a form template is assigned to this user in the active cycle. */
  formAssigned: boolean;
  /** The code of the assigned form template (if any), e.g. "FAC-2026". */
  formCode: string | null;
  /** Whether the user is marked for direct score entry in the active cycle. */
  directScoreEntry: boolean;
  /** Whether self-assessment is enabled for this user's form assignment. */
  selfAssessmentEnabled: boolean;
}

export interface CreateUserInput {
  employeeId: string;
  email: string;
  password: string;
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
  isActive?: boolean;
}

