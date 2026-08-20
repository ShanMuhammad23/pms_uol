import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { isHeadRole } from "@/lib/auth/home-path";
import { canReviewSubmissions } from "@/lib/auth/submission-review-roles";
import { getBulkReviewQuestionData } from "@/lib/queries/form-submissions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user?.role;
  if (!isHeadRole(role) && !canReviewSubmissions(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reviewerUserId = session.user?.id ? Number(session.user.id) : null;
  if (reviewerUserId == null || !Number.isFinite(reviewerUserId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const idsParam = url.searchParams.get("ids") ?? "";
    const submissionIds = idsParam
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (submissionIds.length === 0) {
      return NextResponse.json(
        { error: "At least one submission id is required." },
        { status: 400 },
      );
    }

    if (submissionIds.length > 200) {
      return NextResponse.json(
        { error: "Too many submissions selected (max 200)." },
        { status: 400 },
      );
    }

    const data = await getBulkReviewQuestionData(submissionIds, reviewerUserId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[bulk-review questions] Failed to load question data:", error);
    return NextResponse.json(
      { error: "Failed to load question data." },
      { status: 500 },
    );
  }
}
