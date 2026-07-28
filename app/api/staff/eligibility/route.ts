import { NextResponse } from "next/server";
import { requireSubmissionReviewerApi } from "@/lib/auth/require-submission-reviewer";
import { db } from "@/lib/db";
import { FormSubmissionError } from "@/lib/queries/form-submissions";

async function ensureAssessmentEligibilityColumn(): Promise<void> {
  await db.query(
    `ALTER TABLE users
     ADD COLUMN IF NOT EXISTS assessment_eligibility BOOLEAN NOT NULL DEFAULT TRUE`,
  );
}

export async function PATCH(request: Request) {
  const auth = await requireSubmissionReviewerApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    await ensureAssessmentEligibilityColumn();

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

    if (typeof body.assessmentEligibility !== "boolean") {
      return NextResponse.json(
        { error: "assessmentEligibility must be a boolean." },
        { status: 400 },
      );
    }

    const employeeIds = body.employeeIds as string[];
    const eligibility = body.assessmentEligibility;

    const result = await db.query<{ employee_id: string }>(
      `UPDATE users
       SET assessment_eligibility = $2
       WHERE employee_id = ANY($1::text[])
       RETURNING employee_id`,
      [employeeIds, eligibility],
    );

    return NextResponse.json({
      updatedCount: result.rows.length,
      employeeIds: result.rows.map((r) => r.employee_id),
      assessmentEligibility: eligibility,
    });
  } catch (error) {
    if (error instanceof FormSubmissionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to update assessment eligibility:", error);
    return NextResponse.json(
      { error: "Failed to update assessment eligibility." },
      { status: 500 },
    );
  }
}
