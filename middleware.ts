import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Edge gate: requires a signed NextAuth session cookie for app/API surfaces.
 * Role / entity authorization MUST still run in route handlers via withAuth()
 * (edge middleware cannot safely re-query Postgres for every request here).
 *
 * Exclusions (matcher negative lookahead):
 * - /api/auth/*  — NextAuth handlers
 * - /api/cron/*  — machine cron jobs authenticated via CRON_SECRET Bearer token
 */
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    if (token?.error) {
      const signIn = new URL("/", req.url);
      return NextResponse.redirect(signIn);
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token?.id) && !token?.error,
    },
  },
);

export const config = {
  matcher: ["/dashboard/:path*", "/api/((?!auth|cron).*)"],
};
