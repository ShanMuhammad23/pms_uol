import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { isHeadRole } from "@/lib/auth/home-path";
import { canReviewSubmissions } from "@/lib/auth/submission-review-roles";
import { listBulkReviewQueue } from "@/lib/queries/form-submissions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user?.role;
  // Only Manager 1 / Manager 2 (system role MANAGER) and admin roles acting
  // as assigned managers can use the bulk review workspace.
  if (!isHeadRole(role) && !canReviewSubmissions(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reviewerUserId = session.user?.id ? Number(session.user.id) : null;
  if (reviewerUserId == null || !Number.isFinite(reviewerUserId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await listBulkReviewQueue(reviewerUserId);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[bulk-review queue] Failed to list queue:", error);
    return NextResponse.json(
      { error: "Failed to load bulk review queue." },
      { status: 500 },
    );
  }
}
