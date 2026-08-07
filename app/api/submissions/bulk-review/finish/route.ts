import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { isHeadRole } from "@/lib/auth/home-path";
import { canReviewSubmissions } from "@/lib/auth/submission-review-roles";
import {
  FormSubmissionError,
  finishBulkReview,
} from "@/lib/queries/form-submissions";

export const dynamic = "force-dynamic";

interface FinishRequestBody {
  submissionIds?: number[];
}

export async function POST(request: Request) {
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
    const body = (await request.json()) as FinishRequestBody;

    if (
      !Array.isArray(body.submissionIds) ||
      body.submissionIds.length === 0
    ) {
      return NextResponse.json(
        { error: "submissionIds must be a non-empty array." },
        { status: 400 },
      );
    }

    const ids = body.submissionIds.filter(
      (id) => Number.isFinite(id) && id > 0,
    );

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "At least one valid submission id is required." },
        { status: 400 },
      );
    }

    const result = await finishBulkReview(reviewerUserId, ids);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FormSubmissionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("[bulk-review finish] Failed to finish review:", error);
    return NextResponse.json(
      { error: "Failed to finish bulk review." },
      { status: 500 },
    );
  }
}
