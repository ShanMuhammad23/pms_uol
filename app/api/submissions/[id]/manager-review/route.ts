import { NextResponse } from "next/server";
import {
  assertSubmissionAccessible,
  submissionAccessErrorResponse,
  SubmissionAccessError,
} from "@/lib/auth/submission-access";
import { isHeadRole } from "@/lib/auth/home-path";
import { canReviewSubmissions } from "@/lib/auth/submission-review-roles";
import { requireSubmissionAccessApi } from "@/lib/auth/require-submission-reviewer";
import {
  getReviewingManagerUserId,
  toEmployeeManagers,
} from "@/app/helpers/manager-review";
import {
  FormSubmissionError,
  approveManagerReview,
  getFormSubmissionById,
  getFormSubmissionSummaryById,
  saveManagerReviewAnswers,
} from "@/lib/queries/form-submissions";
import type { SaveManagerReviewInput } from "@/types/employee-forms";
import { apiHandler } from "@/lib/api-handler";

function filledByUserIdForManagerReview(
  reviewerUserId: number,
  isAdmin: boolean,
  summary: {
    managerLevel: number | null;
    manager1UserId: number | null;
    manager2UserId: number | null;
  },
): number {
  if (!isAdmin) {
    return reviewerUserId;
  }
  const assigned = getReviewingManagerUserId(
    toEmployeeManagers(summary),
    summary.managerLevel ?? 1,
  );
  return assigned ?? reviewerUserId;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PUT = apiHandler(async (request: Request, context: RouteContext) => {
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

    const filledByUserId = filledByUserIdForManagerReview(
      reviewerUserId,
      canReviewSubmissions(role),
      summary,
    );

    const managerAnswers = await saveManagerReviewAnswers(
      submissionId,
      filledByUserId,
      body.answers,
      detail.questions,
      {
        managerLevel: summary.managerLevel ?? 1,
        overallRemarks: body.overallRemarks,
      },
    );

    return NextResponse.json({
      managerAnswers,
      manager1OverallRemarks: detail.manager1OverallRemarks,
      manager2OverallRemarks: detail.manager2OverallRemarks,
    });
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

    console.error("[manager-review PUT] Failed to save manager review:", error);
    return NextResponse.json(
      { error: "Failed to save manager review." },
      { status: 500 },
    );
  }
});

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

    if (!summary.assessmentEligibility) {
      return NextResponse.json(
        { error: "Score editing is disabled: employee is not eligible for assessment." },
        { status: 403 },
      );
    }

    const result = await approveManagerReview(submissionId);

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

    console.error("[manager-review POST] Failed to approve manager review:", error);
    return NextResponse.json(
      { error: "Failed to approve manager review." },
      { status: 500 },
    );
  }
});
