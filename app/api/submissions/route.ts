import { NextRequest, NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { isHeadRole } from "@/lib/auth/home-path";
import { submissionVisibleToHead } from "@/app/helpers/manager-review";
import { toHeadStaffListingItem } from "@/app/helpers/head-staff-listing";
import { parseFormSubmissionsQueryParams } from "@/lib/dashboard/filter-params";
import { listEntities } from "@/lib/queries/entities";
import { listFormSubmissionsPage } from "@/lib/queries/form-submissions-page";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
    }

    const query = parseFormSubmissionsQueryParams(request.nextUrl.searchParams);
    const entities = await listEntities();

    const page = await listFormSubmissionsPage({
      managedByUserId,
      page: query.page,
      pageSize: query.pageSize,
      filters: query.filters,
      masterFilters: query.masterFilters,
      entities,
      ...(isHead
        ? {
            filterRow: (submission) =>
              submissionVisibleToHead(Number(auth.user!.id), submission),
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
});
