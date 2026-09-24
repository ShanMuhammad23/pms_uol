import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-auth";
import { ROLE_PERMISSION_SETS } from "@/lib/auth/roles";
import {
  getOrganizationReportRecords,
  type OrgReportRecordColumnId,
} from "@/lib/queries/organization-report";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const VALID_COLUMNS = new Set<OrgReportRecordColumnId>([
  "total",
  "eligible",
  "formsAssigned",
  "formsNotAssigned",
  "directScoreEntry",
  "managerDirectAssessment",
  "performanceMatrixAssigned",
  "incrementMatrixAssigned",
  "selfAssessed",
  "manager1Assigned",
  "assessedByManager1",
  "manager2Assigned",
  "assessedByManager2",
  "hrAlignment",
  "boardApproval",
]);

/**
 * GET /api/reports/organization-hierarchy/records?entityId=<id>&column=<id>
 *
 * Returns the employee records behind a process-status count cell. entityId
 * scopes to that entity's subtree; omit it for organization-wide records.
 */
export const GET = apiHandler(withAuth(
  async (request: Request) => {
    try {
      const { searchParams } = new URL(request.url);
      const entityIdParam = searchParams.get("entityId");
      const column = searchParams.get("column") ?? "";

      if (!VALID_COLUMNS.has(column as OrgReportRecordColumnId)) {
        return NextResponse.json(
          { error: "Invalid column." },
          { status: 400 },
        );
      }

      const entityId =
        entityIdParam != null && entityIdParam !== ""
          ? Number(entityIdParam)
          : null;
      if (entityIdParam != null && entityIdParam !== "" && Number.isNaN(entityId)) {
        return NextResponse.json(
          { error: "Invalid entityId." },
          { status: 400 },
        );
      }

      const records = await getOrganizationReportRecords(
        entityId,
        column as OrgReportRecordColumnId,
      );
      return NextResponse.json({ records });
    } catch (error) {
      console.error("[reports/organization-hierarchy/records] Failed:", error);
      return NextResponse.json(
        { error: "Failed to load report records." },
        { status: 500 },
      );
    }
  },
  { roles: ROLE_PERMISSION_SETS.dashboard },
));
