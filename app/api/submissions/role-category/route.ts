import { NextResponse } from "next/server";
import { requireSubmissionReviewerApi } from "@/lib/auth/require-submission-reviewer";
import {
  FormSubmissionError,
  updateEmployeeRoleCategory,
} from "@/lib/queries/form-submissions";

export async function PATCH(request: Request) {
  const auth = await requireSubmissionReviewerApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      employeeId?: unknown;
      roleCategory?: unknown;
    };

    if (typeof body.employeeId !== "string" || !body.employeeId.trim()) {
      return NextResponse.json(
        { error: "employeeId is required." },
        { status: 400 },
      );
    }

    if (!("roleCategory" in body)) {
      return NextResponse.json(
        { error: "roleCategory is required." },
        { status: 400 },
      );
    }

    if (body.roleCategory !== null && typeof body.roleCategory !== "string") {
      return NextResponse.json(
        { error: "roleCategory must be a string or null." },
        { status: 400 },
      );
    }

    const roleCategory =
      typeof body.roleCategory === "string"
        ? body.roleCategory.trim() || null
        : null;

    const updated = await updateEmployeeRoleCategory(
      body.employeeId.trim(),
      roleCategory,
    );

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof FormSubmissionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to update role category:", error);
    return NextResponse.json(
      { error: "Failed to update role category." },
      { status: 500 },
    );
  }
}
