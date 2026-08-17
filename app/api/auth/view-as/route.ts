import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@/lib/db";
import { isSystemRole } from "@/lib/auth/roles";

/**
 * GET /api/auth/view-as
 * Returns the available roles the current user can view as, based on their
 * real system role and whether they are a manager (head_id or manager_2_id)
 * of any employee.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const realRole = session.user.realRole ?? session.user.role;

  if (!isSystemRole(realRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 403 });
  }

  // Employees cannot view as anything else.
  if (realRole === "EMPLOYEE") {
    return NextResponse.json({
      options: [],
      currentViewAsRole: session.user.viewAsRole ?? null,
    });
  }

  // Check if the user is a manager (head_id or manager_2_id) of any employee.
  const managerCheck = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM users
     WHERE (head_id = $1 OR manager_2_id = $1)
       AND is_active = true
       AND id != $1`,
    [userId],
  );
  const isManagerOfSomeone = Number(managerCheck.rows[0]?.count ?? 0) > 0;

  // Build the options list.
  type ViewAsOption = { value: string; label: string };

  const options: ViewAsOption[] = [];

  // "Employee" is available to all non-employees.
  options.push({ value: "EMPLOYEE", label: "Employee" });

  // "Manager" is available to:
  // - MANAGER (it's their default role)
  // - HR / BOARD / SUPER_ADMIN (only if they are actually a manager of someone)
  if (realRole === "MANAGER") {
    options.push({ value: "MANAGER", label: "Manager (default)" });
  } else if (isManagerOfSomeone) {
    options.push({ value: "MANAGER", label: "Manager" });
  }

  // The "default" option (return to original role) for admin roles.
  if (realRole === "HR" || realRole === "BOARD" || realRole === "SUPER_ADMIN") {
    options.push({ value: "", label: "HR (default)" });
  }

  return NextResponse.json({
    options,
    currentViewAsRole: session.user.viewAsRole ?? null,
    realRole,
  });
}
