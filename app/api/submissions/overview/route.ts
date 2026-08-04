import { NextRequest, NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { isHeadRole } from "@/lib/auth/home-path";
import { submissionVisibleToHead } from "@/app/helpers/manager-review";
import { parseDashboardFilterParams } from "@/lib/dashboard/filter-params";
import { resolveEntitySubtreeIds } from "@/lib/queries/entity-scope";
import { listEntities } from "@/lib/queries/entities";
import { listDashboardOverview } from "@/lib/queries/dashboard-overview";
import { buildDashboardOverviewCounts } from "@/lib/queries/dashboard-overview-counts";
import { getActiveFinancialYearQuartileBands } from "@/lib/queries/performance-rating";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireDashboardSubmissionsApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    let scopedEntityIds: number[] | undefined;
    let managedByUserId: number | undefined;
    const isHead = isHeadRole(auth.user?.role);

    if (isHead) {
      const headEntityId = auth.user?.entityId;
      const viewerUserId = auth.user?.id ? Number(auth.user.id) : null;

      if (viewerUserId == null || !Number.isFinite(viewerUserId)) {
        return NextResponse.json(
          buildDashboardOverviewCounts(
            [],
            parseDashboardFilterParams(request.nextUrl.searchParams),
            [],
            [],
          ),
        );
      }

      managedByUserId = viewerUserId;
      scopedEntityIds =
        headEntityId != null && Number.isFinite(headEntityId)
          ? await resolveEntitySubtreeIds(headEntityId)
          : [];
    }

    const filters = parseDashboardFilterParams(request.nextUrl.searchParams);

    const [overview, entities, quartileBands] = await Promise.all([
      listDashboardOverview({
        scopedEntityIds,
        managedByUserId,
      }),
      listEntities(),
      getActiveFinancialYearQuartileBands(),
    ]);

    let scopedOverview = overview;
    if (isHead) {
      const headEntityId = auth.user?.entityId ?? null;
      const viewerUserId = Number(auth.user!.id);
      scopedOverview = overview.filter((submission) =>
        submissionVisibleToHead(
          viewerUserId,
          headEntityId,
          submission,
          entities,
        ),
      );
    }

    return NextResponse.json(
      buildDashboardOverviewCounts(
        scopedOverview,
        filters,
        entities,
        quartileBands,
      ),
    );
  } catch (error) {
    console.error("Failed to load dashboard overview:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard overview." },
      { status: 500 },
    );
  }
}
