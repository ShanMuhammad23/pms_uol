import { NextResponse } from "next/server";
import {
  assertSubmissionAccessible,
  submissionAccessErrorResponse,
  SubmissionAccessError,
} from "@/lib/auth/submission-access";
import { canReviewSubmissions } from "@/lib/auth/submission-review-roles";
import { requireSubmissionAccessApi } from "@/lib/auth/require-submission-reviewer";
import {
  FormSubmissionError,
  getFormSubmissionSummaryById,
  resetFormSubmission,
} from "@/lib/queries/form-submissions";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/submissions/[id]/reset-form
 *
 * Permanently resets an assessment submission back to the Self Assessment
 * stage. Removes all answers, manager reviews, score adjustments,
 * calibration data, and HR/Board approval data.
 *
 * Authorization: HR, Board, and Super Admin only (canReviewSubmissions).
 * Manager and Employee roles are rejected with 403 at the API layer —
 * the frontend also hides the button, but the backend is the source of
 * truth.
 */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireSubmissionAccessApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  // Backend RBAC: only HR / Board / Super Admin may reset a form.
  const role = auth.user?.role;
  if (!canReviewSubmissions(role)) {
    return NextResponse.json(
      { error: "Forbidden: only HR, Board, or Super Admin may reset a form." },
      { status: 403 },
    );
  }

  const resetByUserId = auth.user?.id ? Number(auth.user.id) : null;
  if (resetByUserId == null || !Number.isFinite(resetByUserId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const submissionId = Number(id);
  if (Number.isNaN(submissionId)) {
    return NextResponse.json(
      { error: "Invalid submission id." },
      { status: 400 },
    );
  }

  try {
    const summary = await getFormSubmissionSummaryById(submissionId);
    if (!summary) {
      return NextResponse.json(
        { error: "Submission not found." },
        { status: 404 },
      );
    }

    // Verify the viewer can access this submission.
    await assertSubmissionAccessible(auth, summary);

    const result = await resetFormSubmission(submissionId, resetByUserId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SubmissionAccessError) {
      return submissionAccessErrorResponse(error);
    }

    if (error instanceof FormSubmissionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("[reset-form POST] Failed to reset form:", error);
    return NextResponse.json(
      { error: "Failed to reset form." },
      { status: 500 },
    );
  }
}
