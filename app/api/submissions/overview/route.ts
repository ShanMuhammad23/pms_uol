import { NextRequest, NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { isHeadRole } from "@/lib/auth/home-path";
import { submissionVisibleToHead } from "@/app/helpers/manager-review";
import { parseDashboardFilterParams } from "@/lib/dashboard/filter-params";
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
    let managedByUserId: number | undefined;
    const isHead = isHeadRole(auth.user?.role);

    if (isHead) {
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
        managedByUserId,
      }),
      listEntities(),
      getActiveFinancialYearQuartileBandsByMatrixLabel(),
    ]);
    const quartileBands = [...bandsByLabel.values()].flat();

    let scopedOverview = overview;
    if (isHead) {
      const viewerUserId = Number(auth.user!.id);
      scopedOverview = overview.filter((submission) =>
        submissionVisibleToHead(viewerUserId, submission),
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
