import "server-only";

import { db } from "@/lib/db";
import { getDbClient } from "@/lib/db-context";
import {
  isSystemRole,
  roleSatisfies,
  type SystemRole,
} from "@/lib/auth/roles";

export class AuthzError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "AuthzError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Authoritative principal loaded from PostgreSQL — never trust JWT claims alone.
 */
export interface AuthPrincipal {
  id: number;
  email: string;
  role: SystemRole;
  entityId: number | null;
  designation: string | null;
  isActive: boolean;
  firstName: string;
  lastName: string;
}

export async function loadPrincipalById(
  userId: number,
): Promise<AuthPrincipal | null> {
  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  const result = await getDbClient().query<{
    id: string;
    email: string;
    system_role: string;
    entity_id: string | null;
    designation: string | null;
    is_active: boolean;
    first_name: string;
    last_name: string;
  }>(
    `SELECT
       id,
       email,
       system_role,
       entity_id,
       designation,
       is_active,
       first_name,
       last_name
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId],
  );

  const row = result.rows[0];
  if (!row || !isSystemRole(row.system_role)) {
    return null;
  }

  return {
    id: Number(row.id),
    email: row.email,
    role: row.system_role,
    entityId: row.entity_id ? Number(row.entity_id) : null,
    designation: row.designation,
    isActive: row.is_active,
    firstName: row.first_name,
    lastName: row.last_name,
  };
}

export async function loadPrincipalByEmail(
  email: string,
): Promise<AuthPrincipal | null> {
  const normalized = email.trim();
  if (!normalized) {
    return null;
  }

  const result = await getDbClient().query<{
    id: string;
    email: string;
    system_role: string;
    entity_id: string | null;
    designation: string | null;
    is_active: boolean;
    first_name: string;
    last_name: string;
  }>(
    `SELECT
       id,
       email,
       system_role,
       entity_id,
       designation,
       is_active,
       first_name,
       last_name
     FROM users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [normalized],
  );

  const row = result.rows[0];
  if (!row || !isSystemRole(row.system_role)) {
    return null;
  }

  return {
    id: Number(row.id),
    email: row.email,
    role: row.system_role,
    entityId: row.entity_id ? Number(row.entity_id) : null,
    designation: row.designation,
    isActive: row.is_active,
    firstName: row.first_name,
    lastName: row.last_name,
  };
}

export interface AuthorizeOptions {
  /** Allowed roles after DB refresh. Empty / omitted = any active user. */
  roles?: readonly SystemRole[];
  /** Require a non-null entity_id from DB. */
  requireEntity?: boolean;
}

/**
 * Resolve the caller from a session user id, re-fetching role/entity from DB.
 * Rejects inactive users and role mismatches (JWT role is ignored for authz).
 *
 * When `viewAsRole` is provided (set via the "View As" dropdown), the
 * principal's role is overridden with it so that all role-based authorization
 * checks use the view-as role instead of the real DB role. The real role is
 * still >= the view-as role in privilege, so the user can perform all actions
 * of the lower-privilege role.
 */
export async function authorizeFromSessionUser(
  sessionUser: {
    id?: string | null;
    email?: string | null;
    role?: string | null;
    viewAsRole?: string | null;
  } | null | undefined,
  options: AuthorizeOptions = {},
): Promise<AuthPrincipal> {
  const rawId = sessionUser?.id ? Number(sessionUser.id) : NaN;
  let principal =
    Number.isInteger(rawId) && rawId > 0
      ? await loadPrincipalById(rawId)
      : null;

  if (!principal && sessionUser?.email) {
    principal = await loadPrincipalByEmail(sessionUser.email);
  }

  if (!principal) {
    throw new AuthzError("Unauthorized", 401, "UNAUTHENTICATED");
  }

  if (!principal.isActive) {
    throw new AuthzError("Account disabled", 401, "INACTIVE");
  }

  // Apply view-as role override for authorization checks. The view-as role
  // is always <= the real role in privilege, validated at the API endpoint
  // that sets it.
  if (sessionUser?.viewAsRole && isSystemRole(sessionUser.viewAsRole)) {
    principal = { ...principal, role: sessionUser.viewAsRole };
  }

  if (options.roles && options.roles.length > 0) {
    if (!roleSatisfies(principal.role, options.roles)) {
      throw new AuthzError("Forbidden", 403, "ROLE_DENIED");
    }
  }

  if (options.requireEntity && principal.entityId == null) {
    throw new AuthzError(
      "Entity assignment required",
      403,
      "ENTITY_REQUIRED",
    );
  }

  return principal;
}

/**
 * Horizontal privilege check: target resource owner must match principal,
 * unless principal has an elevated role.
 */
export function assertSelfOrRoles(
  principal: AuthPrincipal,
  resourceOwnerUserId: number,
  elevatedRoles: readonly SystemRole[],
): void {
  if (principal.id === resourceOwnerUserId) {
    return;
  }

  if (roleSatisfies(principal.role, elevatedRoles)) {
    return;
  }

  throw new AuthzError("Forbidden", 403, "HORIZONTAL_DENY");
}
