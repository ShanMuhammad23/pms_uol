import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { isHeadRole } from "@/lib/auth/home-path";
import { canReviewSubmissions } from "@/lib/auth/submission-review-roles";
import {
  FormSubmissionError,
  saveBulkAuthoredAnswers,
} from "@/lib/queries/form-submissions";
import { getFormTemplateById } from "@/lib/queries/forms";
import { db } from "@/lib/db";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface SaveAuthoredRequestBody {
  sectionId?: number;
  entries?: Array<{
    submissionId: number;
    authoredQuestions: Array<{
      authoredQuestionText: string | null;
      authoredTotalMarks: number;
      pointsEarned: number;
      ratingValue?: number | null;
      remarks?: string | null;
    }>;
  }>;
}

export const PUT = apiHandler(async (request: Request) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user?.role;
  if (!isHeadRole(role) && !canReviewSubmissions(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reviewerUserId = session.user?.id ? Number(session.user.id) : null;
  if (reviewerUserId == null || !Number.isFinite(reviewerUserId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as SaveAuthoredRequestBody;

    if (
      !body.sectionId ||
      !Number.isFinite(body.sectionId) ||
      !Array.isArray(body.entries) ||
      body.entries.length === 0
    ) {
      return NextResponse.json(
        { error: "sectionId and a non-empty entries array are required." },
        { status: 400 },
      );
    }

    if (body.entries.length > 200) {
      return NextResponse.json(
        { error: "Too many entries (max 200)." },
        { status: 400 },
      );
    }

    // Get the templateId from the first submission to validate the section.
    const firstSubmissionId = body.entries[0].submissionId;
    const tplResult = await db.query<{ template_id: string | null }>(
      `SELECT ap.template_id::text FROM appraisals ap WHERE ap.id = $1`,
      [firstSubmissionId],
    );
    const templateId = tplResult.rows[0]?.template_id
      ? Number(tplResult.rows[0].template_id)
      : null;

    if (!templateId) {
      return NextResponse.json(
        { error: "Submission not found or has no form template." },
        { status: 404 },
      );
    }

    const template = await getFormTemplateById(templateId);
    if (!template) {
      return NextResponse.json(
        { error: "Form template not found." },
        { status: 404 },
      );
    }

    // Validate that the section exists and is an open-assessment section.
    const section = template.sections.find(
      (s) => s.id === body.sectionId && s.isOpenAssessment,
    );
    if (!section) {
      return NextResponse.json(
        { error: "Open assessment section not found." },
        { status: 404 },
      );
    }

    const result = await saveBulkAuthoredAnswers(
      reviewerUserId,
      Number(body.sectionId),
      body.entries,
      {
        ratingBased: template.ratingBased,
        ratingScales: template.ratingScales,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FormSubmissionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("[bulk-review save-authored] Failed to save authored answers:", error);
    return NextResponse.json(
      { error: "Failed to save authored answers." },
      { status: 500 },
    );
  }
});
