import "server-only";

import { db } from "../db";

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  systemRole: string;
  designation: string | null;
  entityId: number | null;
  isActive: boolean;
}

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const result = await db.query<{
    id: string;
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    system_role: string;
    designation: string | null;
    entity_id: string | null;
    is_active: boolean;
  }>(
    `
      SELECT
        id,
        email,
        password_hash,
        first_name,
        last_name,
        system_role,
        designation,
        entity_id,
        is_active
      FROM users
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    [email],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    firstName: row.first_name,
    lastName: row.last_name,
    systemRole: row.system_role,
    designation: row.designation,
    entityId: row.entity_id ? Number(row.entity_id) : null,
    isActive: row.is_active,
  };
}
