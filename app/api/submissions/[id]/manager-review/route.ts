import { NextResponse } from "next/server";
import {
  assertSubmissionAccessible,
  submissionAccessErrorResponse,
  SubmissionAccessError,
} from "@/lib/auth/submission-access";
import { isHeadRole } from "@/lib/auth/home-path";
import { requireSubmissionAccessApi } from "@/lib/auth/require-submission-reviewer";
import {
  FormSubmissionError,
  approveManagerReview,
  getFormSubmissionById,
  getFormSubmissionSummaryById,
  saveManagerReviewAnswers,
} from "@/lib/queries/form-submissions";
import { getReviewingEntityId } from "@/app/helpers/manager-review";
import { listEntities } from "@/lib/queries/entities";
import type { SaveManagerReviewInput } from "@/types/employee-forms";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireSubmissionAccessApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const role = auth.user?.role;
  if (!isHeadRole(role) && role !== "SUPER_ADMIN") {
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

    console.error("Failed to save manager review:", error);
    return NextResponse.json(
      { error: "Failed to save manager review." },
      { status: 500 },
    );
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireSubmissionAccessApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const role = auth.user?.role;
  if (!isHeadRole(role) && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const headEntityId = auth.user?.entityId;
  if (
    role !== "SUPER_ADMIN" &&
    (headEntityId == null || !Number.isFinite(headEntityId))
  ) {
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

    let reviewerEntityId = headEntityId;
    if (role === "SUPER_ADMIN") {
      const entities = await listEntities();
      if (summary.entityId == null) {
        return NextResponse.json(
          { error: "Submission has no assigned entity." },
          { status: 409 },
        );
      }

      const resolvedReviewerEntityId = getReviewingEntityId(
        summary.entityId,
        summary.managerLevel ?? 1,
        entities,
      );

      if (resolvedReviewerEntityId == null) {
        return NextResponse.json(
          { error: "No reviewing entity found for this submission." },
          { status: 409 },
        );
      }

      reviewerEntityId = resolvedReviewerEntityId;
    }

    const result = await approveManagerReview(submissionId, reviewerEntityId!);

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

    console.error("Failed to approve manager review:", error);
    return NextResponse.json(
      { error: "Failed to approve manager review." },
      { status: 500 },
    );
  }
}
