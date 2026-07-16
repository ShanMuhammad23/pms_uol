import { NextResponse } from "next/server";
import { requireSubmissionReviewerApi } from "@/lib/auth/require-submission-reviewer";
import {
  FormSubmissionError,
  getFormSubmissionById,
  updateAppraisalRemarksEvaluation,
} from "@/lib/queries/form-submissions";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSubmissionReviewerApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const submissionId = Number(id);

  if (Number.isNaN(submissionId)) {
    return NextResponse.json({ error: "Invalid submission id." }, { status: 400 });
  }

  try {
    const submission = await getFormSubmissionById(submissionId);

    if (!submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    return NextResponse.json(submission);
  } catch (error) {
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
  const auth = await requireSubmissionReviewerApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const submissionId = Number(id);

  if (Number.isNaN(submissionId)) {
    return NextResponse.json({ error: "Invalid submission id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { remarksEvaluation?: unknown };

    if (!("remarksEvaluation" in body)) {
      return NextResponse.json(
        { error: "remarksEvaluation is required." },
        { status: 400 },
      );
    }

    if (
      body.remarksEvaluation !== null &&
      typeof body.remarksEvaluation !== "string"
    ) {
      return NextResponse.json(
        { error: "remarksEvaluation must be a string or null." },
        { status: 400 },
      );
    }

    const remarksEvaluation =
      typeof body.remarksEvaluation === "string"
        ? body.remarksEvaluation.trim() || null
        : null;

    const updated = await updateAppraisalRemarksEvaluation(
      submissionId,
      remarksEvaluation,
    );

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof FormSubmissionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to update evaluation remarks:", error);
    return NextResponse.json(
      { error: "Failed to update evaluation remarks." },
      { status: 500 },
    );
  }
}
