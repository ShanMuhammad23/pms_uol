import { NextResponse } from "next/server";
import { ROLE_PERMISSION_SETS } from "@/lib/auth/roles";
import { listSecurityEvents } from "@/lib/auth/security-events";
import { withAuth } from "@/lib/auth/with-auth";
import { apiHandler } from "@/lib/api-handler";

/**
 * SUPER_ADMIN only — security activity feed for administrators.
 */
export const GET = withAuth(
  apiHandler(async (request: Request) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
      const pageSize = Math.min(
        Math.max(Number(searchParams.get("pageSize") ?? 50), 1),
        200,
      );
      const eventType = searchParams.get("eventType");

      const result = await listSecurityEvents({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        eventType,
      });

      return NextResponse.json({
        items: result.items,
        total: result.total,
        page,
        pageSize,
      });
    } catch (error) {
      console.error("Failed to list security events:", error);
      return NextResponse.json(
        {
          error:
            "Security events could not be loaded. Make sure the security_events table exists.",
        },
        { status: 500 },
      );
    }
  }),
  { roles: ROLE_PERMISSION_SETS.superAdminOnly },
);
