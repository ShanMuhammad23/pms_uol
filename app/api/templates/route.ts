import { NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { isHeadRole } from "@/lib/auth/home-path";
import { listFormTemplates, listDirectAssessmentTemplates } from "@/lib/queries/forms";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: Request) => {
  const auth = await requireDashboardSubmissionsApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const url = new URL(request.url);
    const directAssessment = url.searchParams.get("directAssessment") === "true";

    const reviewerUserId = auth.user?.id ? Number(auth.user.id) : null;
    const isHead = isHeadRole(auth.user?.role);
    const headEntityId =
      isHead && auth.user?.entityId != null
        ? Number(auth.user.entityId)
        : null;

    if (directAssessment) {
      if (reviewerUserId == null || !Number.isFinite(reviewerUserId)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const templates = await listDirectAssessmentTemplates({
        reviewerUserId,
        headEntityId,
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
