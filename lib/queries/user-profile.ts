import "server-only";

import { db } from "../db";
import type { UserProfile } from "../types/user-profile";

export type { UserProfile };

export class UserProfileError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UserProfileError";
    this.status = status;
  }
}

function formatEnumLabel(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile> {
  const result = await db.query<{
    employee_id: string;
    email: string;
    first_name: string;
    last_name: string;
    system_role: string;
    emp_category: string;
    emp_sub_category: string;
    department_name: string | null;
    is_active: boolean;
  }>(
    `
      SELECT
        u.employee_id,
        u.email,
        u.first_name,
        u.last_name,
        u.system_role,
        u.emp_category,
        u.emp_sub_category,
        d.name AS department_name,
        u.is_active
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE lower(u.email) = lower($1)
      LIMIT 1
    `,
    [email],
  );

  const row = result.rows[0];
  if (!row) {
    throw new UserProfileError(`No profile was found for ${email}.`, 404);
  }

  return {
    employeeId: row.employee_id,
    firstName: row.first_name,
    lastName: row.last_name,
    emailAddress: row.email,
    department: row.department_name,
    designation: formatEnumLabel(row.emp_sub_category),
    mobileNumber: null,
    employmentStatus: row.is_active ? "1" : "0",
    systemRole: formatEnumLabel(row.system_role),
    empCategory: formatEnumLabel(row.emp_category),
  };
}
