import type { UserRole } from "@/types/users";

export const SUBMISSION_REVIEW_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "HR",
  "BOARD",
];

/** Roles that can load dashboard submissions, stats, and filters. */
export const DASHBOARD_SUBMISSION_ROLES: UserRole[] = [
  ...SUBMISSION_REVIEW_ROLES,
  "MANAGER",
];

export function canReviewSubmissions(role: string | undefined): boolean {
  return SUBMISSION_REVIEW_ROLES.includes(role as UserRole);
}

export function canAccessDashboardSubmissions(role: string | undefined): boolean {
  return DASHBOARD_SUBMISSION_ROLES.includes(role as UserRole);
}

/** Roles with full system-wide access (Super Admin, HR, Board). */
export function isAdminRole(role: string | undefined): boolean {
  return SUBMISSION_REVIEW_ROLES.includes(role as UserRole);
}

/**
 * Quartile is confidential performance information.
 * Only HR, Board, and Super Admin may view quartile data.
 * Employees and Managers (Manager 1 / Manager 2) are excluded.
 */
export function canViewQuartile(role: string | undefined): boolean {
  return SUBMISSION_REVIEW_ROLES.includes(role as UserRole);
}
