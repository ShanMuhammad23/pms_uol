"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  EMPLOYEE_HOME_PATH,
  isEmployeeAllowedDashboardPath,
  isEmployeeRole,
} from "@/lib/auth/home-path";

/**
 * Keeps EMPLOYEE users on My Forms only. Other roles are unaffected.
 */
export function EmployeeAccessGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const role = session?.user?.role;
  const isEmployee = isEmployeeRole(role);
  const allowed =
    !isEmployee || isEmployeeAllowedDashboardPath(pathname ?? "");

  useEffect(() => {
    if (status !== "authenticated" || !isEmployee) {
      return;
    }

    if (!isEmployeeAllowedDashboardPath(pathname ?? "")) {
      router.replace(EMPLOYEE_HOME_PATH);
    }
  }, [isEmployee, pathname, router, status]);

  if (status === "loading") {
    return null;
  }

  if (isEmployee && !allowed) {
    return null;
  }

  return children;
}
