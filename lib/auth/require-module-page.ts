import "server-only";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { isAdminRole } from "@/lib/auth/submission-review-roles";
import { canViewModule, canEditModule } from "@/lib/auth/additional-access";
import type { AdditionalAccessModule } from "@/types/additional-access";

/**
 * Server-side page guard: require admin role OR additional-access view permission.
 * Redirects to /dashboard if not authorized.
 */
export async function requireModuleViewPage(module: AdditionalAccessModule) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }

  if (isAdminRole(session.user.role)) {
    return { session, canEdit: true };
  }

  const canView = await canViewModule(
    Number(session.user.id),
    module,
    session.user.role,
  );

  if (!canView) {
    redirect("/dashboard");
  }

  const canEdit = await canEditModule(
    Number(session.user.id),
    module,
    session.user.role,
  );

  return { session, canEdit };
}

/**
 * Server-side page guard: require admin role OR additional-access edit permission.
 * Redirects to /dashboard if not authorized.
 */
export async function requireModuleEditPage(module: AdditionalAccessModule) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }

  if (isAdminRole(session.user.role)) {
    return { session, canEdit: true };
  }

  const canEdit = await canEditModule(
    Number(session.user.id),
    module,
    session.user.role,
  );

  if (!canEdit) {
    redirect("/dashboard");
  }

  return { session, canEdit: true };
}
