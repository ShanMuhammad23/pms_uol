import { NextResponse } from "next/server";
import {
  assertSubmissionAccessible,
  submissionAccessErrorResponse,
  SubmissionAccessError,
} from "@/lib/auth/submission-access";
import { isHeadRole } from "@/lib/auth/home-path";
import { requireSubmissionAccessApi } from "@/lib/auth/require-submission-reviewer";
import { headCanReviewSubmission } from "@/app/helpers/manager-review";
import { listEntities } from "@/lib/queries/entities";
import {
  FormSubmissionError,
  getFormSubmissionById,
  getFormSubmissionSummaryById,
  updateAppraisalRemarks,
  type AppraisalRemarksField,
} from "@/lib/queries/form-submissions";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const REMARKS_FIELDS = [
  "remarksEvaluation",
  "remarksCompensation",
] as const satisfies readonly AppraisalRemarksField[];

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSubmissionAccessApi();
  if (auth instanceof NextResponse) {
    return auth;
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

    await assertSubmissionAccessible(auth, summary);

    const role = auth.user?.role;
    const reviewerUserId = auth.user?.id ? Number(auth.user.id) : null;
    const headEntityId = auth.user?.entityId;
    const entities = await listEntities();
    const canEditManagerReview =
      summary.status === "PENDING_HEAD_REVIEW" &&
      (isHeadRole(role) || role === "SUPER_ADMIN") &&
      (role === "SUPER_ADMIN" ||
        (headEntityId != null &&
          Number.isFinite(headEntityId) &&
          headCanReviewSubmission(headEntityId, summary, entities)));

    const submission = await getFormSubmissionById(submissionId, {
      reviewerUserId,
      seedManagerAnswers: canEditManagerReview,
      canEditManagerReview,
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    return NextResponse.json(submission);
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

    console.error("Failed to load form submission:", error);
    return NextResponse.json(
      { error: "Failed to load form submission." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSubmissionAccessApi();
  if (auth instanceof NextResponse) {
    return auth;
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

    await assertSubmissionAccessible(auth, summary);

    const body = (await request.json()) as Record<string, unknown>;
    const field = REMARKS_FIELDS.find((candidate) => candidate in body);

    if (!field) {
      return NextResponse.json(
        {
          error:
            "One of remarksEvaluation or remarksCompensation is required.",
        },
        { status: 400 },
      );
    }

    const rawValue = body[field];
    if (rawValue !== null && typeof rawValue !== "string") {
      return NextResponse.json(
        { error: `${field} must be a string or null.` },
        { status: 400 },
      );
    }

    const value =
      typeof rawValue === "string" ? rawValue.trim() || null : null;

    const updated = await updateAppraisalRemarks(submissionId, field, value);

    return NextResponse.json(updated);
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

    console.error("Failed to update remarks:", error);
    return NextResponse.json(
      { error: "Failed to update remarks." },
      { status: 500 },
    );
  }
}
