import "server-only";

import { db } from "@/lib/db";
import { isAdminRole } from "@/lib/auth/submission-review-roles";
import type {
  AdditionalAccessLevel,
  AdditionalAccessModule,
  AdditionalAccessPermission,
} from "@/types/additional-access";
import {
  isAdditionalAccessLevel,
  isAdditionalAccessModule,
} from "@/types/additional-access";

interface UserAdditionalAccessRow {
  module: string;
  access_level: string;
}

/**
 * Load all additional-access permissions for a user from the database.
 * Returns an empty array if the table doesn't exist or the user has none.
 */
export async function getUserAdditionalAccess(
  userId: number,
): Promise<AdditionalAccessPermission[]> {
  if (!Number.isInteger(userId) || userId <= 0) {
    return [];
  }

  try {
    const result = await db.query<UserAdditionalAccessRow>(
      `SELECT module, access_level
       FROM user_additional_access
       WHERE user_id = $1`,
      [userId],
    );

    return result.rows
      .filter(
        (row) =>
          isAdditionalAccessModule(row.module) &&
          isAdditionalAccessLevel(row.access_level),
      )
      .map((row) => ({
        module: row.module as AdditionalAccessModule,
        accessLevel: row.access_level as AdditionalAccessLevel,
      }));
  } catch {
    return [];
  }
}

/**
 * Replace the full set of additional-access permissions for a user.
 * Only call this from Super Admin contexts.
 */
export async function setUserAdditionalAccess(
  userId: number,
  permissions: AdditionalAccessPermission[],
  grantedByUserId: number,
): Promise<void> {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Invalid user id.");
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM user_additional_access WHERE user_id = $1`,
      [userId],
    );

    for (const perm of permissions) {
      if (
        !isAdditionalAccessModule(perm.module) ||
        !isAdditionalAccessLevel(perm.accessLevel)
      ) {
        continue;
      }

      await client.query(
        `INSERT INTO user_additional_access (user_id, module, access_level, granted_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, module) DO UPDATE SET
           access_level = EXCLUDED.access_level,
           granted_by = EXCLUDED.granted_by,
           updated_at = CURRENT_TIMESTAMP`,
        [userId, perm.module, perm.accessLevel, grantedByUserId],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Effective permission check for a specific module.
 *
 * RBAC remains primary: if the user's role already grants full access
 * (admin roles: SUPER_ADMIN, HR, BOARD), the user has EDIT access regardless
 * of additional-access settings.
 *
 * For non-admin roles (MANAGER, EMPLOYEE), additional-access permissions
 * grant supplementary access.
 *
 * Returns: "EDIT" | "VIEW_ONLY" | null (no access)
 */
export async function getEffectiveModuleAccess(
  userId: number,
  module: AdditionalAccessModule,
  userRole: string | null | undefined,
): Promise<AdditionalAccessLevel | null> {
  if (isAdminRole(userRole ?? undefined)) {
    return "EDIT";
  }

  const permissions = await getUserAdditionalAccess(userId);
  const match = permissions.find((p) => p.module === module);
  return match?.accessLevel ?? null;
}

/**
 * Check if a user can view a specific module.
 */
export async function canViewModule(
  userId: number,
  module: AdditionalAccessModule,
  userRole: string | null | undefined,
): Promise<boolean> {
  const access = await getEffectiveModuleAccess(userId, module, userRole);
  return access !== null;
}

/**
 * Check if a user can edit (create/update/delete) within a specific module.
 */
export async function canEditModule(
  userId: number,
  module: AdditionalAccessModule,
  userRole: string | null | undefined,
): Promise<boolean> {
  const access = await getEffectiveModuleAccess(userId, module, userRole);
  return access === "EDIT";
}
