import type { UserRole } from "@/types/users";

export const SUBMISSION_REVIEW_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "HR",
  "BOARD",
];

export function canReviewSubmissions(role: string | undefined): boolean {
  return SUBMISSION_REVIEW_ROLES.includes(role as UserRole);
}
