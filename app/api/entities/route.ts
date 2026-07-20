import { NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { isHeadRole } from "@/lib/auth/home-path";
import { listEntities } from "@/lib/queries/entities";
import { filterEntitiesForHeadDashboard } from "@/app/helpers/entity-scope";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireDashboardSubmissionsApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const entities = await listEntities();

    if (isHeadRole(auth.user?.role)) {
      const headEntityId = auth.user?.entityId;
      if (headEntityId == null || !Number.isFinite(headEntityId)) {
        return NextResponse.json([]);
      }

      return NextResponse.json(filterEntitiesForHeadDashboard(entities, headEntityId));
    }

    return NextResponse.json(entities);
  } catch (error) {
    console.error("Failed to list entities:", error);
    return NextResponse.json(
      { error: "Failed to load entities." },
      { status: 500 },
    );
  }
}
