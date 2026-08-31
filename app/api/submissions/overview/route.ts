import { NextRequest, NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { isHeadRole } from "@/lib/auth/home-path";
import { submissionVisibleToHead } from "@/app/helpers/manager-review";
import { parseDashboardFilterParams } from "@/lib/dashboard/filter-params";
import { resolveEntitySubtreeIds } from "@/lib/queries/entity-scope";
import { listEntities } from "@/lib/queries/entities";
import { listDashboardOverview } from "@/lib/queries/dashboard-overview";
import { buildDashboardOverviewCounts } from "@/lib/queries/dashboard-overview-counts";
import { getActiveFinancialYearQuartileBandsByMatrixLabel } from "@/lib/queries/performance-rating";
import type { MatrixScoreType } from "@/lib/performance-rating";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const VALID_SCORE_TYPES = new Set<MatrixScoreType>(["normalized", "scoreO", "adjusted"]);

export const GET = apiHandler(async (request: NextRequest) => {
  const auth = await requireDashboardSubmissionsApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    let scopedEntityIds: number[] | undefined;
    let managedByUserId: number | undefined;
    const isHead = isHeadRole(auth.user?.role);
    // When viewing as a different role (view-as feature), skip the entity
    // subtree scoping — only show employees directly assigned to the user as
    // Manager 1 or Manager 2.
    const isViewingAs = Boolean(auth.user?.viewAsRole);

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
        !isViewingAs && headEntityId != null && Number.isFinite(headEntityId)
          ? await resolveEntitySubtreeIds(headEntityId)
          : [];
    }

    const filters = parseDashboardFilterParams(request.nextUrl.searchParams);

    // Parse the optional scoreType query param for the Rating × Quartile
    // Matrix dropdown. Defaults to "normalized" (the original behavior).
    const scoreTypeParam = request.nextUrl.searchParams.get("scoreType");
    const scoreType: MatrixScoreType =
      scoreTypeParam && VALID_SCORE_TYPES.has(scoreTypeParam as MatrixScoreType)
        ? (scoreTypeParam as MatrixScoreType)
        : "normalized";

    const [overview, entities, bandsByLabel] = await Promise.all([
      listDashboardOverview({
        scopedEntityIds,
        managedByUserId,
      }),
      listEntities(),
      getActiveFinancialYearQuartileBandsByMatrixLabel(),
    ]);
    const quartileBands = [...bandsByLabel.values()].flat();

    let scopedOverview = overview;
    if (isHead) {
      const headEntityId = isViewingAs ? null : (auth.user?.entityId ?? null);
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
        scoreType,
        bandsByLabel,
      ),
    );
  } catch (error) {
    console.error("Failed to load dashboard overview:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard overview." },
      { status: 500 },
    );
  }
});
