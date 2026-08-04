import "server-only";

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import {
  AuthzError,
  authorizeFromSessionUser,
  type AuthPrincipal,
  type AuthorizeOptions,
} from "@/lib/auth/authorize";
import { logSecurityEvent } from "@/lib/auth/security-events";

export type AuthedHandlerContext<TParams = Record<string, string>> = {
  params: Promise<TParams> | TParams;
};

export type AuthedHandler<TParams = Record<string, string>> = (
  request: Request,
  context: AuthedHandlerContext<TParams>,
  principal: AuthPrincipal,
) => Promise<Response> | Response;

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthzError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  console.error("[withAuth] unexpected error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/**
 * App Router route-handler wrapper.
 *
 * Always re-loads the caller from PostgreSQL (role, is_active, entity_id).
 * JWT session is only used as a proof of login (id/email), never as authz truth.
 *
 * @example
 * export const GET = withAuth(
 *   async (_req, _ctx, principal) => NextResponse.json({ id: principal.id }),
 *   { roles: ROLE_PERMISSION_SETS.dashboard },
 * );
 */
export function withAuth<TParams = Record<string, string>>(
  handler: AuthedHandler<TParams>,
  options: AuthorizeOptions = {},
) {
  return async (
    request: Request,
    context: AuthedHandlerContext<TParams>,
  ): Promise<Response> => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        await logSecurityEvent({
          eventType: "AUTH_REQUIRED",
          path: new URL(request.url).pathname,
          method: request.method,
          meta: { reason: "missing_session" },
        });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const principal = await authorizeFromSessionUser(session.user, options);
      return await handler(request, context, principal);
    } catch (error) {
      if (error instanceof AuthzError) {
        await logSecurityEvent({
          eventType:
            error.code === "ROLE_DENIED" || error.code === "HORIZONTAL_DENY"
              ? "AUTHZ_DENIED"
              : "AUTH_REJECTED",
          path: new URL(request.url).pathname,
          method: request.method,
          meta: { code: error.code, message: error.message },
        });
      }
      return toErrorResponse(error);
    }
  };
}

/**
 * Convenience for pages/api style handlers (if any are added later).
 * Prefer App Router + withAuth in this codebase.
 */
export async function requireAuthorizedApi(
  options: AuthorizeOptions = {},
): Promise<AuthPrincipal | NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return await authorizeFromSessionUser(session.user, options);
  } catch (error) {
    return toErrorResponse(error);
  }
}
