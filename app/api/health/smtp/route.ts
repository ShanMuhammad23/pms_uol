import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-auth";
import { ROLE_PERMISSION_SETS } from "@/lib/auth/roles";
import { verifySmtpConnection } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health/smtp
 *
 * Verifies that PMS can connect to and authenticate with the configured SMTP
 * server (Gmail via App Password). This endpoint does NOT send any email and
 * cannot be used to send arbitrary mail — it only runs nodemailer's
 * `transporter.verify()`.
 *
 * Restricted to SUPER_ADMIN to avoid exposing SMTP diagnostics broadly.
 *
 * Response shape:
 *   { ok: boolean, configured: boolean, message: string, code?: number, missingEnv?: string[] }
 */
export const GET = withAuth(
  async () => {
    try {
      const result = await verifySmtpConnection();
      return NextResponse.json(result, { status: result.ok ? 200 : 503 });
    } catch (error) {
      // Defensive: verifySmtpConnection already catches, but guard again so no
      // raw error (which could contain config) is leaked.
      console.error("[health/smtp] unexpected error:", error);
      return NextResponse.json(
        { ok: false, configured: true, message: "SMTP verification failed." },
        { status: 503 },
      );
    }
  },
  { roles: ROLE_PERMISSION_SETS.superAdminOnly },
);
