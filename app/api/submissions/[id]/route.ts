import { NextResponse } from "next/server";
import { requireSubmissionReviewerApi } from "@/lib/auth/require-submission-reviewer";
import {
  FormSubmissionError,
  getFormSubmissionById,
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
