import "server-only";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { canEditModule, canViewModule } from "@/lib/auth/additional-access";
import type { AdditionalAccessModule } from "@/types/additional-access";

/**
 * API guard: require at least VIEW_ONLY access to a module.
 * Returns the session if authorized, or a NextResponse error if not.
 *
 * RBAC is primary: admin roles (SUPER_ADMIN, HR, BOARD) always pass.
 */
export async function requireModuleViewApi(
  module: AdditionalAccessModule,
): Promise<Response | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const role = session.user.role;

  const allowed = await canViewModule(userId, module, role);
  if (!allowed) {
    return NextResponse.json(
      { error: "Forbidden: insufficient module access." },
      { status: 403 },
    );
  }

  return null;
}

/**
 * API guard: require EDIT access to a module.
 * Returns the session if authorized, or a NextResponse error if not.
 *
 * RBAC is primary: admin roles (SUPER_ADMIN, HR, BOARD) always pass.
 */
export async function requireModuleEditApi(
  module: AdditionalAccessModule,
): Promise<Response | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const role = session.user.role;

  const allowed = await canEditModule(userId, module, role);
  if (!allowed) {
    return NextResponse.json(
      { error: "Forbidden: edit access required for this module." },
      { status: 403 },
    );
  }

  return null;
}

/**
 * Check if the current session user can edit a specific module.
 * Throws nothing — returns boolean. Useful for conditional logic inside handlers.
 */
export async function checkModuleEditAccess(
  module: AdditionalAccessModule,
): Promise<{ allowed: boolean; userId: number; role: string | undefined }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { allowed: false, userId: 0, role: undefined };
  }

  const userId = Number(session.user.id);
  const role = session.user.role;
  const allowed = await canEditModule(userId, module, role);
  return { allowed, userId, role };
}
