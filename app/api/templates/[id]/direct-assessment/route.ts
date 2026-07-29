import { NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { isHeadRole } from "@/lib/auth/home-path";
import { getDirectAssessmentData } from "@/lib/queries/direct-assessment";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
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
  const headEntityId =
    isHead && auth.user?.entityId != null
      ? Number(auth.user.entityId)
      : null;

  try {
    const data = await getDirectAssessmentData(
      templateId,
      reviewerUserId,
      true,
      headEntityId,
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
}
