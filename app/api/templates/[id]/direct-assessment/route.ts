import { NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { isHeadRole } from "@/lib/auth/home-path";
import { isAdminRole } from "@/lib/auth/submission-review-roles";
import { getDirectAssessmentData } from "@/lib/queries/direct-assessment";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = apiHandler(async (request: Request, context: RouteContext) => {
  const auth = await requireDashboardSubmissionsApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const templateId = Number(id);

  if (Number.isNaN(templateId)) {
    return NextResponse.json(
      { error: "Invalid template id." },
      { status: 400 },
    );
  }

  const reviewerUserId = auth.user?.id ? Number(auth.user.id) : null;
  if (reviewerUserId == null || !Number.isFinite(reviewerUserId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isHead = isHeadRole(auth.user?.role);
  const isAdmin = isAdminRole(auth.user?.role);
  const headEntityId =
    isHead && auth.user?.entityId != null
      ? Number(auth.user.entityId)
      : null;
  const url = new URL(request.url);
  // Admins may request only employees they personally manage. Managers
  // always receive the head-scoped list; `scope=managed` is ignored.
  const managedOnly =
    isAdmin && url.searchParams.get("scope") === "managed";

  try {
    const data = await getDirectAssessmentData(
      templateId,
      reviewerUserId,
      isHead,
      headEntityId,
      managedOnly,
      isAdmin,
    );

    if (!data) {
      return NextResponse.json(
        { error: "Template not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[direct-assessment GET] Failed:", error);
    return NextResponse.json(
      { error: "Failed to load direct assessment data." },
      { status: 500 },
    );
  }
});
