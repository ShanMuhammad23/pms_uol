import { NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth/require-session";
import {
  EmployeeFormError,
  getEmployeeFormDetail,
  saveEmployeeForm,
} from "@/lib/queries/employee-forms";
import { notifySelfAssessmentSubmitted } from "@/lib/mail/notifications";
import type { SaveEmployeeFormInput } from "@/types/employee-forms";

interface RouteContext {
  params: Promise<{ templateId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSessionApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const userId = Number(auth.user?.id);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId: templateIdParam } = await context.params;
  const templateId = Number(templateIdParam);

  if (Number.isNaN(templateId)) {
    return NextResponse.json({ error: "Invalid form id." }, { status: 400 });
  }

  try {
    const detail = await getEmployeeFormDetail(userId, templateId);
    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof EmployeeFormError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to load employee form:", error);
    return NextResponse.json(
      { error: "Failed to load form." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireSessionApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const userId = Number(auth.user?.id);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId: templateIdParam } = await context.params;
  const templateId = Number(templateIdParam);

  if (Number.isNaN(templateId)) {
    return NextResponse.json({ error: "Invalid form id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as SaveEmployeeFormInput;
    const detail = await saveEmployeeForm(userId, templateId, body);

    // Fire-and-forget notification: only when the employee actually submitted
    // (not a draft save) and self-assessment is enabled for this form.
    if (
      body.submit &&
      detail.appraisalId != null &&
      detail.status === "SUBMITTED" &&
      detail.selfAssessmentEnabled
    ) {
      void notifySelfAssessmentSubmitted(detail.appraisalId);
    }

    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof EmployeeFormError) {
      console.error("[my-forms PUT] EmployeeFormError:", error.message, {
        userId,
        templateId,
      });
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to save employee form:", error);
    return NextResponse.json(
      { error: "Failed to save form." },
      { status: 500 },
    );
  }
}
