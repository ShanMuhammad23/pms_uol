import { NextResponse } from "next/server";
import {
  assertSubmissionAccessible,
  submissionAccessErrorResponse,
  SubmissionAccessError,
} from "@/lib/auth/submission-access";
import { isHeadRole } from "@/lib/auth/home-path";
import { canReviewSubmissions } from "@/lib/auth/submission-review-roles";
import { requireSubmissionAccessApi } from "@/lib/auth/require-submission-reviewer";
import { managerCanReviewSubmission } from "@/app/helpers/manager-review";
import { canEditModule } from "@/lib/auth/additional-access";
import type { AdditionalAccessModule } from "@/types/additional-access";
import {
  FormSubmissionError,
  getFormSubmissionById,
  getFormSubmissionSummaryById,
  updateAppraisalOverallRemarks,
  updateAppraisalRemarks,
  updateAppraisalScoreAdjustments,
  type AppraisalRemarksField,
  type AppraisalScoreAdjustmentField,
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
    const canEditManagerReview =
      summary.status === "PENDING_HEAD_REVIEW" &&
      (canReviewSubmissions(role) ||
        (isHeadRole(role) &&
          reviewerUserId != null &&
          Number.isFinite(reviewerUserId) &&
          managerCanReviewSubmission(reviewerUserId, summary)));

    const canEditHrReview =
      canReviewSubmissions(role) &&
      summary.status !== "PENDING_SELF_ASSESSMENT";

    const canEditScoreAdjustments = canReviewSubmissions(role);

    const submission = await getFormSubmissionById(submissionId, {
      reviewerUserId,
      seedManagerAnswers: canEditManagerReview || canEditHrReview,
      canEditManagerReview,
      canEditHrReview,
      canEditScoreAdjustments,
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    // RBAC: Score Adjustments & Calibration is a confidential administrative
    // section. Only HR, Board, and Super Admin (canReviewSubmissions) may view
    // these fields. Strip them from the response for all other roles
    // (Employee, Manager 1, Manager 2) even if they can otherwise access the
    // submission. The frontend additionally does not render the section, but
    // the backend is the source of truth so these fields never leak.
    if (!canReviewSubmissions(role)) {
      return NextResponse.json({
        ...submission,
        creditHrsErpScoreAdj: null,
        pubOricScoreAdj: null,
        qecScoreAdj: null,
        calibrationFactor: null,
        calibratedScoreNumeric: null,
        initialScoreNumeric: null,
        canEditScoreAdjustments: false,
        performanceLevelName: null,
        quartileName: null,
        quartileScoreMin: null,
        quartileScoreMax: null,
      });
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

    // Handle score adjustment fields (admin-only)
    const SCORE_ADJ_FIELDS: AppraisalScoreAdjustmentField[] = [
      "creditHrsErpScoreAdj",
      "pubOricScoreAdj",
      "qecScoreAdj",
      "calibrationFactor",
      "calibratedScoreNumeric",
      "initialScoreNumeric",
    ];
    const scoreAdjField = SCORE_ADJ_FIELDS.find((f) => f in body);

    if (scoreAdjField) {
      // Map score adjustment fields to their additional-access modules.
      // calibrationFactor, calibratedScoreNumeric, and initialScoreNumeric
      // remain admin-only (no additional-access module mapping).
      const FIELD_MODULE_MAP: Partial<
        Record<typeof scoreAdjField, AdditionalAccessModule>
      > = {
        creditHrsErpScoreAdj: "CREDIT_HOURS",
        pubOricScoreAdj: "ORIC_ADJUSTMENTS",
        qecScoreAdj: "QEC_ADJUSTMENTS",
      };
      const requiredModule = FIELD_MODULE_MAP[scoreAdjField];

      // RBAC check: admin roles always pass.
      // Additional-access: non-admin users need EDIT permission on the mapped module.
      const isAdmin = canReviewSubmissions(auth.user?.role);
      const hasModuleAccess = requiredModule
        ? await canEditModule(
            Number(auth.user?.id),
            requiredModule,
            auth.user?.role,
          )
        : false;

      if (!isAdmin && !hasModuleAccess) {
        return NextResponse.json(
          { error: "Forbidden: admin role or additional-access permission required to edit score adjustments." },
          { status: 403 },
        );
      }

      if (!summary.assessmentEligibility) {
        return NextResponse.json(
          { error: "Score editing is disabled: employee is not eligible for assessment." },
          { status: 403 },
        );
      }

      const rawValue = body[scoreAdjField];
      const numValue =
        rawValue === null || rawValue === undefined || rawValue === ""
          ? null
          : typeof rawValue === "number"
            ? rawValue
            : Number(rawValue);

      if (numValue !== null && !Number.isFinite(numValue)) {
        return NextResponse.json(
          { error: `${scoreAdjField} must be a valid number or null.` },
          { status: 400 },
        );
      }

      const updated = await updateAppraisalScoreAdjustments(submissionId, {
        [scoreAdjField]: numValue,
      });

      return NextResponse.json(updated);
    }

    // Handle overall remarks fields (Manager 1 / Manager 2)
    const OVERALL_REMARKS_FIELDS = [
      "manager1OverallRemarks",
      "manager2OverallRemarks",
    ] as const;

    const overallField = OVERALL_REMARKS_FIELDS.find((f) => f in body);

    if (overallField) {
      const rawOverallValue = body[overallField];
      if (rawOverallValue !== null && typeof rawOverallValue !== "string") {
        return NextResponse.json(
          { error: `${overallField} must be a string or null.` },
          { status: 400 },
        );
      }

      const overallValue =
        typeof rawOverallValue === "string"
          ? rawOverallValue.trim() || null
          : null;

      const managerLevel: 1 | 2 =
        overallField === "manager2OverallRemarks" ? 2 : 1;

      const updated = await updateAppraisalOverallRemarks(
        submissionId,
        managerLevel,
        overallValue,
      );

      return NextResponse.json(updated);
    }

    // Handle remarks fields
    const field = REMARKS_FIELDS.find((candidate) => candidate in body);

    if (!field) {
      return NextResponse.json(
        {
          error:
            "One of remarksEvaluation, remarksCompensation, manager1OverallRemarks, manager2OverallRemarks, creditHrsErpScoreAdj, pubOricScoreAdj, qecScoreAdj, calibrationFactor, or calibratedScoreNumeric is required.",
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
