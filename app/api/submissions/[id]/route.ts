import { NextResponse } from "next/server";
import { requireSubmissionReviewerApi } from "@/lib/auth/require-submission-reviewer";
import {
  FormSubmissionError,
  getFormSubmissionById,
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
