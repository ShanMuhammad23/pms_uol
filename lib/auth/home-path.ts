import type { UserRole } from "@/types/users";

export const EMPLOYEE_HOME_PATH = "/dashboard/my-forms";
export const DEFAULT_HOME_PATH = "/dashboard";

export function isEmployeeRole(role: string | null | undefined): boolean {
  return role === "EMPLOYEE";
}

export function isHeadRole(role: string | null | undefined): boolean {
  return role === "MANAGER";
}

export function getPostLoginPath(role: string | null | undefined): string {
  return isEmployeeRole(role) ? EMPLOYEE_HOME_PATH : DEFAULT_HOME_PATH;
}

/** Paths an EMPLOYEE may access under /dashboard. */
export function isEmployeeAllowedDashboardPath(pathname: string): boolean {
  if (
    pathname === EMPLOYEE_HOME_PATH ||
    pathname.startsWith(`${EMPLOYEE_HOME_PATH}/`)
  ) {
    return true;
  }

  // Allow employees through to /dashboard/forms paths.
  // Server-side page guards (requireModuleViewPage/requireModuleEditPage)
  // enforce actual authorization via additional-access permissions.
  if (
    pathname === "/dashboard/forms" ||
    pathname.startsWith("/dashboard/forms/")
  ) {
    return true;
  }

  return false;
}

export function assertEmployeeRole(
  role: string | null | undefined,
): role is Extract<UserRole, "EMPLOYEE"> {
  return isEmployeeRole(role);
}
