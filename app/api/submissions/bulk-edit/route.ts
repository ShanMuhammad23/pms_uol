import { NextResponse } from "next/server";
import { requireSubmissionReviewerApi } from "@/lib/auth/require-submission-reviewer";
import {
  FormSubmissionError,
  bulkUpdateEmployeeListingFields,
} from "@/lib/queries/form-submissions";

function parseOptionalTextField(
  body: Record<string, unknown>,
  key: string,
): { provided: boolean; value: string | null } {
  if (!(key in body)) {
    return { provided: false, value: null };
  }

  const raw = body[key];
  if (raw !== null && typeof raw !== "string") {
    throw new FormSubmissionError(`${key} must be a string or null.`, 400);
  }

  return {
    provided: true,
    value: typeof raw === "string" ? raw.trim() || null : null,
  };
}

export async function PATCH(request: Request) {
  const auth = await requireSubmissionReviewerApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (!Array.isArray(body.employeeIds) || body.employeeIds.length === 0) {
      return NextResponse.json(
        { error: "employeeIds must be a non-empty array." },
        { status: 400 },
      );
    }

    if (
      !body.employeeIds.every(
        (id) => typeof id === "string" && id.trim().length > 0,
      )
    ) {
      return NextResponse.json(
        { error: "Each employeeId must be a non-empty string." },
        { status: 400 },
      );
    }

    const roleCategory = parseOptionalTextField(body, "roleCategory");

    if (!roleCategory.provided) {
      return NextResponse.json(
        { error: "Provide roleCategory to update." },
        { status: 400 },
      );
    }

    const updated = await bulkUpdateEmployeeListingFields(
      body.employeeIds as string[],
      {
        ...(roleCategory.provided
          ? { roleCategory: roleCategory.value }
          : {}),
      },
    );

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof FormSubmissionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to bulk edit staff listing fields:", error);
    return NextResponse.json(
      { error: "Failed to bulk edit staff." },
      { status: 500 },
    );
  }
}
