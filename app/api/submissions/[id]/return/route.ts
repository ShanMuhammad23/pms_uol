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
  returnSubmission,
  type ReturnLevel,
} from "@/lib/queries/form-submissions";
import { notifySubmissionReturned } from "@/lib/mail/notifications";
import { apiHandler } from "@/lib/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VALID_RETURN_LEVELS: ReturnLevel[] = ["manager2", "manager1", "employee"];

/**
 * POST /api/submissions/[id]/return
 *
 * Returns a submission to a lower workflow level (Manager 2, Manager 1, or
 * Employee). Removes confidential manager data as appropriate for the
 * destination level, sets is_returned = TRUE, persists the return_reason,
 * and transitions the status to the existing workflow stage for the
 * destination.
 *
 * Authorization: HR, Board, and Super Admin only (canReviewSubmissions).
 */
export const POST = apiHandler(async (request: Request, context: RouteContext) => {
  const auth = await requireSubmissionAccessApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  // Backend RBAC: only HR / Board / Super Admin may return a submission.
  const role = auth.user?.role;
  if (!canReviewSubmissions(role)) {
    return NextResponse.json(
      { error: "Forbidden: only HR, Board, or Super Admin may return a submission." },
      { status: 403 },
    );
  }

  const returnByUserId = auth.user?.id ? Number(auth.user.id) : null;
  if (returnByUserId == null || !Number.isFinite(returnByUserId)) {
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

  let body: { returnLevel?: string; reason?: string };
  try {
    body = (await request.json()) as { returnLevel?: string; reason?: string };
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const returnLevel = body.returnLevel as ReturnLevel | undefined;
  if (!returnLevel || !VALID_RETURN_LEVELS.includes(returnLevel)) {
    return NextResponse.json(
      {
        error: `returnLevel must be one of: ${VALID_RETURN_LEVELS.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json(
      { error: "A non-empty return reason is required." },
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

    const result = await returnSubmission(
      submissionId,
      returnByUserId,
      returnLevel,
      reason,
    );

    // Fire-and-forget notification: return to employee sends 1 email;
    // return to manager1/manager2 sends 2 emails (manager + employee).
    void notifySubmissionReturned(submissionId, returnLevel, reason);

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

    console.error("[return POST] Failed to return submission:", error);
    return NextResponse.json(
      { error: "Failed to return submission." },
      { status: 500 },
    );
  }
});
