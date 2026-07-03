import { NextResponse } from "next/server";
import { requireSubmissionReviewerApi } from "@/lib/auth/require-submission-reviewer";
import { listFormSubmissions } from "@/lib/queries/form-submissions";

export async function GET() {
  const auth = await requireSubmissionReviewerApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const submissions = await listFormSubmissions();
    return NextResponse.json(submissions);
  } catch (error) {
    console.error("Failed to list form submissions:", error);
    return NextResponse.json(
      { error: "Failed to load form submissions." },
      { status: 500 },
    );
  }
}
