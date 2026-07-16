import { NextResponse } from "next/server";
import { requireSubmissionReviewerApi } from "@/lib/auth/require-submission-reviewer";
import {
  FormSubmissionError,
  updateEmployeeGradeGroup,
} from "@/lib/queries/form-submissions";

export async function PATCH(request: Request) {
  const auth = await requireSubmissionReviewerApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      employeeId?: unknown;
      gradeGroup?: unknown;
    };

    if (typeof body.employeeId !== "string" || !body.employeeId.trim()) {
      return NextResponse.json(
        { error: "employeeId is required." },
        { status: 400 },
      );
    }

    if (!("gradeGroup" in body)) {
      return NextResponse.json(
        { error: "gradeGroup is required." },
        { status: 400 },
      );
    }

    if (body.gradeGroup !== null && typeof body.gradeGroup !== "string") {
      return NextResponse.json(
        { error: "gradeGroup must be a string or null." },
        { status: 400 },
      );
    }

    const gradeGroup =
      typeof body.gradeGroup === "string"
        ? body.gradeGroup.trim() || null
        : null;

    const updated = await updateEmployeeGradeGroup(
      body.employeeId.trim(),
      gradeGroup,
    );

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof FormSubmissionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to update grade group:", error);
    return NextResponse.json(
      { error: "Failed to update grade group." },
      { status: 500 },
    );
  }
}
