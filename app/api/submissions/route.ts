import { NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { isHeadRole } from "@/lib/auth/home-path";
import { submissionVisibleToHead } from "@/app/helpers/manager-review";
import { toHeadStaffListingItem } from "@/app/helpers/head-staff-listing";
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
    let managedByUserId: number | undefined;

    if (isHeadRole(auth.user?.role)) {
      const headEntityId = auth.user?.entityId;
      const viewerUserId = auth.user?.id ? Number(auth.user.id) : null;

      if (viewerUserId == null || !Number.isFinite(viewerUserId)) {
        return NextResponse.json([]);
      }

      managedByUserId = viewerUserId;
      scopedEntityIds =
        headEntityId != null && Number.isFinite(headEntityId)
          ? await resolveEntitySubtreeIds(headEntityId)
          : [];
    }

    const submissions = await listFormSubmissions({
      scopedEntityIds,
      managedByUserId,
    });

    if (isHeadRole(auth.user?.role)) {
      const headEntityId = auth.user?.entityId ?? null;
      const viewerUserId = Number(auth.user!.id);
      const entities = await listEntities();

      return NextResponse.json(
        submissions
          .filter((submission) =>
            submissionVisibleToHead(
              viewerUserId,
              headEntityId,
              submission,
              entities,
            ),
          )
          .map(toHeadStaffListingItem),
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
