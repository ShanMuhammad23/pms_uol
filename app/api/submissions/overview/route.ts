import { NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { isHeadRole } from "@/lib/auth/home-path";
import { submissionVisibleToHead } from "@/app/helpers/manager-review";
import { resolveEntitySubtreeIds } from "@/lib/queries/entity-scope";
import { listEntities } from "@/lib/queries/entities";
import { listDashboardOverview } from "@/lib/queries/dashboard-overview";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireDashboardSubmissionsApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    let scopedEntityIds: number[] | undefined;

    if (isHeadRole(auth.user?.role)) {
      const headEntityId = auth.user?.entityId;
      if (headEntityId == null || !Number.isFinite(headEntityId)) {
        return NextResponse.json([]);
      }

      scopedEntityIds = await resolveEntitySubtreeIds(headEntityId);
    }

    const overview = await listDashboardOverview({ scopedEntityIds });

    if (isHeadRole(auth.user?.role)) {
      const headEntityId = auth.user?.entityId;
      if (headEntityId == null || !Number.isFinite(headEntityId)) {
        return NextResponse.json([]);
      }

      const entities = await listEntities();
      return NextResponse.json(
        overview.filter((submission) =>
          submissionVisibleToHead(headEntityId, submission, entities),
        ),
      );
    }

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Failed to load dashboard overview:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard overview." },
      { status: 500 },
    );
  }
}
