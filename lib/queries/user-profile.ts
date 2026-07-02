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
  const orgModeResult = await db.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'entity_id'
      ) AS exists
    `,
  );
  const useEntity = orgModeResult.rows[0]?.exists ?? false;
  const orgIdColumn = useEntity ? "u.entity_id" : "u.department_id";
  const orgTable = useEntity ? "entities" : "departments";

  const result = await db.query<{
    employee_id: string;
    email: string;
    first_name: string;
    last_name: string;
    system_role: string;
    emp_category: string;
    emp_sub_category: string;
    entity_name: string | null;
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
        org.name AS entity_name,
        u.is_active
      FROM users u
      LEFT JOIN ${orgTable} org ON org.id = ${orgIdColumn}
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
    entity: row.entity_name,
    designation: formatEnumLabel(row.emp_sub_category),
    mobileNumber: null,
    employmentStatus: row.is_active ? "1" : "0",
    systemRole: formatEnumLabel(row.system_role),
    empCategory: formatEnumLabel(row.emp_category),
  };
}
