import type { UserRole } from "@/types/users";

export const SUBMISSION_REVIEW_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "HR",
  "BOARD",
];

/** Roles that can load dashboard submissions, stats, and filters. */
export const DASHBOARD_SUBMISSION_ROLES: UserRole[] = [
  ...SUBMISSION_REVIEW_ROLES,
  "HEAD",
];

export function canReviewSubmissions(role: string | undefined): boolean {
  return SUBMISSION_REVIEW_ROLES.includes(role as UserRole);
}

export function canAccessDashboardSubmissions(role: string | undefined): boolean {
  return DASHBOARD_SUBMISSION_ROLES.includes(role as UserRole);
}
