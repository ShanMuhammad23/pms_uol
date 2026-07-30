import "server-only";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { authorizeFromSessionUser, AuthzError } from "@/lib/auth/authorize";
import { ROLE_PERMISSION_SETS } from "@/lib/auth/roles";
import { isAdminRole } from "@/lib/auth/submission-review-roles";

/**
 * @deprecated Name is misleading — allows SUPER_ADMIN | HR | BOARD (see isAdminRole).
 * Prefer authorizeFromSessionUser / withAuth({ roles: ROLE_PERMISSION_SETS.orgAdmins }).
 */
export async function requireSuperAdminSession() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  if (!isAdminRole(session.user?.role)) {
    redirect("/dashboard");
  }

  return session;
}

/**
 * @deprecated Name is misleading — allows SUPER_ADMIN | HR | BOARD.
 * Prefer withAuth({ roles: ROLE_PERMISSION_SETS.orgAdmins }).
 */
export async function requireSuperAdminApi() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(session.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return session;
}

/** True SUPER_ADMIN only (DB-verified). Redirects others. */
export async function requireTrueSuperAdminSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  try {
    await authorizeFromSessionUser(session.user, {
      roles: ROLE_PERMISSION_SETS.superAdminOnly,
    });
  } catch {
    redirect("/dashboard");
  }

  return session;
}

/** True SUPER_ADMIN only (DB-verified). */
export async function requireTrueSuperAdminApi() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return await authorizeFromSessionUser(session.user, {
      roles: ROLE_PERMISSION_SETS.superAdminOnly,
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
