import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-auth";
import { ROLE_PERMISSION_SETS } from "@/lib/auth/roles";
import { getOrganizationReport } from "@/lib/queries/organization-report";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/reports/organization-hierarchy
 *
 * Returns the full organization hierarchy with aggregated appraisal workflow
 * counts per entity (forms assigned, self assessed, manager assessed,
 * HR alignment, board approval). Accessible by admin roles (SUPER_ADMIN, HR,
 * BOARD) and MANAGER.
 */
export const GET = apiHandler(withAuth(
  async () => {
    try {
      const tree = await getOrganizationReport();
      return NextResponse.json({ tree });
    } catch (error) {
      console.error("[reports/organization-hierarchy] Failed:", error);
      return NextResponse.json(
        { error: "Failed to load organization report." },
        { status: 500 },
      );
    }
  },
  { roles: ROLE_PERMISSION_SETS.dashboard },
));
