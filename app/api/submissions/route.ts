import { NextRequest, NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { isHeadRole } from "@/lib/auth/home-path";
import { submissionVisibleToHead } from "@/app/helpers/manager-review";
import { toHeadStaffListingItem } from "@/app/helpers/head-staff-listing";
import { parseFormSubmissionsQueryParams } from "@/lib/dashboard/filter-params";
import { resolveEntitySubtreeIds } from "@/lib/queries/entity-scope";
import { listEntities } from "@/lib/queries/entities";
import { listFormSubmissionsPage } from "@/lib/queries/form-submissions-page";

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
    // When viewing as a different role (view-as feature), skip the entity
    // subtree scoping — only show employees directly assigned to the user as
    // Manager 1 or Manager 2. This prevents an HR/Board/Super Admin who is
    // also a manager from seeing the entire org subtree in manager view.
    const isViewingAs = Boolean(auth.user?.viewAsRole);

    if (isHead) {
      const headEntityId = auth.user?.entityId;
      const viewerUserId = auth.user?.id ? Number(auth.user.id) : null;

      if (viewerUserId == null || !Number.isFinite(viewerUserId)) {
        const query = parseFormSubmissionsQueryParams(
          request.nextUrl.searchParams,
        );
        return NextResponse.json({
          items: [],
          total: 0,
          page: query.page,
          pageSize: query.pageSize,
          matchingEmployeeIds: [],
          columnCounts: {},
        });
      }

      managedByUserId = viewerUserId;
      // Only use entity subtree scoping when NOT viewing as a different role.
      // In view-as mode, the user should only see their direct reports.
      scopedEntityIds =
        !isViewingAs && headEntityId != null && Number.isFinite(headEntityId)
          ? await resolveEntitySubtreeIds(headEntityId)
          : [];
    }

    const query = parseFormSubmissionsQueryParams(request.nextUrl.searchParams);
    const entities = await listEntities();

    const page = await listFormSubmissionsPage({
      scopedEntityIds,
      managedByUserId,
      page: query.page,
      pageSize: query.pageSize,
      filters: query.filters,
      masterFilters: query.masterFilters,
      entities,
      ...(isHead
        ? {
            filterRow: (submission) =>
              submissionVisibleToHead(
                Number(auth.user!.id),
                // When viewing as a different role, don't use entity subtree —
                // only show direct reports (Manager 1 / Manager 2).
                isViewingAs ? null : (auth.user?.entityId ?? null),
                submission,
                entities,
              ),
            mapRow: toHeadStaffListingItem,
          }
        : {}),
    });

    return NextResponse.json(page);
  } catch (error) {
    console.error("Failed to list form submissions:", error);
    return NextResponse.json(
      { error: "Failed to load form submissions." },
      { status: 500 },
    );
  }
}
