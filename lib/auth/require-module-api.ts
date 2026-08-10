import "server-only";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import { canViewModule, canEditModule } from "@/lib/auth/additional-access";
import type { AdditionalAccessModule } from "@/types/additional-access";

/**
 * API guard: require admin role OR additional-access view permission for the
 * given module. Returns the session on success, or a NextResponse (401/403)
 * on failure — mirrors the `requireSuperAdminApi` return contract so it can
 * be used as a drop-in replacement.
 *
 * Usage:
 *   const auth = await requireModuleViewApi("USERS");
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireModuleViewApi(
  module: AdditionalAccessModule,
) {
  const auth = await requireSuperAdminApi();
  if (!(auth instanceof NextResponse)) {
    return auth;
  }

  // Not an admin role — check additional-access permission.
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return auth;
  }

  const allowed = await canViewModule(
    Number(session.user.id),
    module,
    session.user.role,
  );

  if (!allowed) {
    return auth;
  }

  return session;
}

/**
 * API guard: require admin role OR additional-access edit permission for the
 * given module. Returns the session on success, or a NextResponse (401/403)
 * on failure.
 *
 * Usage:
 *   const auth = await requireModuleEditApi("USERS");
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireModuleEditApi(
  module: AdditionalAccessModule,
) {
  const auth = await requireSuperAdminApi();
  if (!(auth instanceof NextResponse)) {
    return auth;
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return auth;
  }

  const allowed = await canEditModule(
    Number(session.user.id),
    module,
    session.user.role,
  );

  if (!allowed) {
    return auth;
  }

  return session;
}
