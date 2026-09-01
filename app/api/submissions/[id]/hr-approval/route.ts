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
  approveHrCalibration,
  setHrReviewRequired,
  getFormSubmissionById,
  getFormSubmissionSummaryById,
  saveManagerReviewAnswers,
} from "@/lib/queries/form-submissions";
import { notifyBoardApproved } from "@/lib/mail/notifications";
import type { SaveManagerReviewInput } from "@/types/employee-forms";
import { apiHandler } from "@/lib/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const HR_REVIEW_STATUSES = ["PENDING_HR_CALIBRATION", "PENDING_BOARD_APPROVAL"] as const;

export const PUT = apiHandler(async (request: Request, context: RouteContext) => {
  const auth = await requireSubmissionAccessApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const role = auth.user?.role;
  if (!canReviewSubmissions(role)) {
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

    if (summary.status === "PENDING_SELF_ASSESSMENT") {
      return NextResponse.json(
        { error: "Scores cannot be edited before self-assessment is submitted." },
        { status: 409 },
      );
    }

    await assertSubmissionAccessible(auth, summary);

    if (!summary.assessmentEligibility) {
      return NextResponse.json(
        { error: "Score editing is disabled: employee is not eligible for assessment." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as SaveManagerReviewInput;
    if (!Array.isArray(body.answers)) {
      return NextResponse.json(
        { error: "answers array is required." },
        { status: 400 },
      );
    }

    const detail = await getFormSubmissionById(submissionId, { reviewerUserId });
    if (!detail?.templateId) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    const managerAnswers = await saveManagerReviewAnswers(
      submissionId,
      reviewerUserId,
      body.answers,
      detail.questions,
      {
        ratingBased: detail.ratingBased,
        ratingScales: detail.ratingScales,
      },
    );

    return NextResponse.json({ managerAnswers });
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

    console.error("[hr-approval PUT] Failed to save HR review:", error);
    return NextResponse.json(
      { error: "Failed to save HR review." },
      { status: 500 },
    );
  }
});

export const POST = apiHandler(async (request: Request, context: RouteContext) => {
  const auth = await requireSubmissionAccessApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const role = auth.user?.role;
  if (!canReviewSubmissions(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    if (!HR_REVIEW_STATUSES.includes(summary.status as (typeof HR_REVIEW_STATUSES)[number])) {
      return NextResponse.json(
        { error: "HR/Board review is not open for this submission." },
        { status: 409 },
      );
    }

    await assertSubmissionAccessible(auth, summary);

    if (!summary.assessmentEligibility) {
      return NextResponse.json(
        { error: "Score editing is disabled: employee is not eligible for assessment." },
        { status: 403 },
      );
    }

    let body: { action?: string } = {};
    try {
      body = (await request.json()) as { action?: string };
    } catch {
      // Body is optional — default to approve for backward compatibility
    }
    const action = body.action ?? "approve";

    if (action === "review_required") {
      const result = await setHrReviewRequired(submissionId);
      return NextResponse.json(result);
    }

    const result = await approveHrCalibration(submissionId);

    // Only send a notification on Board approval (final approval).
    // HR calibration approval does not trigger an email notification.
    if (summary.status === "PENDING_BOARD_APPROVAL") {
      void notifyBoardApproved(submissionId);
    }

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

    console.error("[hr-approval POST] Failed to process HR review:", error);
    return NextResponse.json(
      { error: "Failed to process HR review." },
      { status: 500 },
    );
  }
});
