import { NextResponse } from "next/server";
import {
  assertSubmissionAccessible,
  submissionAccessErrorResponse,
  SubmissionAccessError,
} from "@/lib/auth/submission-access";
import { isHeadRole } from "@/lib/auth/home-path";
import { canReviewSubmissions } from "@/lib/auth/submission-review-roles";
import { requireSubmissionAccessApi } from "@/lib/auth/require-submission-reviewer";
import { getDbClient } from "@/lib/db-context";
import { getFormSubmissionSummaryById } from "@/lib/queries/form-submissions";
import { apiHandler } from "@/lib/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export const POST = apiHandler(async (_request: Request, context: RouteContext) => {
  const auth = await requireSubmissionAccessApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const role = auth.user?.role;
  if (!isHeadRole(role) && !canReviewSubmissions(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reviewerUserId = auth.user?.id ? Number(auth.user.id) : null;
  if (reviewerUserId == null || !Number.isFinite(reviewerUserId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const submissionId = Number(id);

  if (Number.isNaN(submissionId)) {
    return NextResponse.json({ error: "Invalid submission id." }, { status: 400 });
  }

  try {
    const summary = await getFormSubmissionSummaryById(submissionId);

    if (!summary) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    if (summary.status !== "PENDING_HEAD_REVIEW") {
      return NextResponse.json(
        { error: "Manager review is not open for this submission." },
        { status: 409 },
      );
    }

    await assertSubmissionAccessible(auth, summary);

    // Only Manager 2 (or an admin acting on behalf of Manager 2) should be
    // confirming the open assessment. Manager 1 does not need this action.
    const managerLevel = summary.managerLevel ?? 1;
    if (managerLevel !== 2) {
      return NextResponse.json(
        { error: "Open assessment confirmation is only available at Manager 2 review stage." },
        { status: 403 },
      );
    }

    const client = getDbClient();

    const result = await client.query<{ confirmed_at: string }>(
      `UPDATE appraisals
          SET manager2_open_assessment_confirmed_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING manager2_open_assessment_confirmed_at::text AS confirmed_at`,
      [submissionId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Appraisal not found." }, { status: 404 });
    }

    return NextResponse.json({ confirmedAt: result.rows[0].confirmed_at });
  } catch (error) {
    if (error instanceof SubmissionAccessError) {
      return submissionAccessErrorResponse(error);
    }

    console.error("[confirm-open-assessment POST] Failed:", error);
    return NextResponse.json(
      { error: "Failed to confirm open assessment." },
      { status: 500 },
    );
  }
});
