import { NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { listDirectAssessmentStaffByEntity } from "@/lib/queries/direct-assessment-org-counts";
import { listFormTemplates, listDirectAssessmentTemplates } from "@/lib/queries/forms";
import { resolveEntitySubtreeIdsForRoots } from "@/lib/queries/entity-scope";
import { apiHandler } from "@/lib/api-handler";
import { isAdminRole } from "@/lib/auth/submission-review-roles";

export const dynamic = "force-dynamic";

function parseEntityIdList(value: string | null): number[] | null {
  if (value == null) {
    return null;
  }
  if (value === "") {
    return [];
  }
  return value
    .split(",")
    .map((part) => Number(part))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export const GET = apiHandler(async (request: Request) => {
  const auth = await requireDashboardSubmissionsApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const url = new URL(request.url);
    const directAssessment = url.searchParams.get("directAssessment") === "true";

    const reviewerUserId = auth.user?.id ? Number(auth.user.id) : null;
    const role = auth.user?.role;
    const isAdmin = isAdminRole(role);

    if (directAssessment) {
      if (reviewerUserId == null || !Number.isFinite(reviewerUserId)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      // Admin roles (SUPER_ADMIN, HR, BOARD) default to every direct
      // assessment template. `scope=managed` limits that list to forms
      // where the admin is Manager 1 or Manager 2. Managers always see
      // only the templates for employees they review.
      const managedOnly = url.searchParams.get("scope") === "managed";
      if (url.searchParams.get("orgCounts") === "true") {
        if (!isAdmin) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const staffByEntity = await listDirectAssessmentStaffByEntity();
        return NextResponse.json({ staffByEntity });
      }
      if (isAdmin && !managedOnly) {
        const category2Ids = parseEntityIdList(
          url.searchParams.get("category2"),
        );
        const category1Ids = parseEntityIdList(
          url.searchParams.get("category1"),
        );
        const selectedRoots =
          category2Ids != null ? category2Ids : category1Ids;
        const filterEntityIds =
          selectedRoots == null
            ? null
            : await resolveEntitySubtreeIdsForRoots(selectedRoots);

        const templates = await listDirectAssessmentTemplates({
          reviewerUserId: null,
          filterEntityIds,
        });
        return NextResponse.json(templates);
      }
      const templates = await listDirectAssessmentTemplates({
        reviewerUserId,
      });
      return NextResponse.json(templates);
    }

    const templates = await listFormTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to list form templates:", error);
    return NextResponse.json(
      { error: "Failed to load form templates." },
      { status: 500 },
    );
  }
});
