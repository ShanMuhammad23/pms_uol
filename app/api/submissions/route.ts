import { NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { isHeadRole } from "@/lib/auth/home-path";
import { submissionVisibleToHead } from "@/app/helpers/manager-review";
import { resolveEntitySubtreeIds } from "@/lib/queries/entity-scope";
import { listEntities } from "@/lib/queries/entities";
import { listFormSubmissions } from "@/lib/queries/form-submissions";

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

    const submissions = await listFormSubmissions({ scopedEntityIds });

    if (isHeadRole(auth.user?.role)) {
      const headEntityId = auth.user?.entityId;
      if (headEntityId == null || !Number.isFinite(headEntityId)) {
        return NextResponse.json([]);
      }

      const entities = await listEntities();
      return NextResponse.json(
        submissions.filter((submission) =>
          submissionVisibleToHead(headEntityId, submission, entities),
        ),
      );
    }

    return NextResponse.json(submissions);
  } catch (error) {
    console.error("Failed to list form submissions:", error);
    return NextResponse.json(
      { error: "Failed to load form submissions." },
      { status: 500 },
    );
  }
}
