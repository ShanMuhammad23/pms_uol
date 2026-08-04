import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import {
  deleteFormTemplate,
  FormTemplateError,
  getFormTemplateById,
  updateFormTemplate,
} from "@/lib/queries/forms";
import { validateFormTemplateInput } from "@/lib/validation/forms";
import type { FormTemplateInput } from "@/types/forms";
import { canViewModule, canEditModule } from "@/lib/auth/additional-access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const APPRAISAL_ANSWER_BLOCK_MESSAGE =
  "This form has appraisal answers linked to questions that would be removed. Delete or archive those answers first, or only edit question text/options in place.";

function isPostgresFkViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23503"
  );
}

function formTemplateErrorResponse(error: FormTemplateError) {
  return NextResponse.json(
    {
      error: error.message,
      ...(error.meta ?? {}),
    },
    { status: error.statusCode },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return auth;
    const allowed = await canViewModule(Number(session.user.id), "FORMS", session.user.role);
    if (!allowed) return auth;
  }

  const { id } = await context.params;
  const templateId = Number(id);

  if (Number.isNaN(templateId)) {
    return NextResponse.json({ error: "Invalid template id." }, { status: 400 });
  }

  try {
    const template = await getFormTemplateById(templateId);

    if (!template) {
      return NextResponse.json({ error: "Form template not found." }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Failed to get form template:", error);
    return NextResponse.json(
      { error: "Failed to load form template." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return auth;
    const allowed = await canEditModule(Number(session.user.id), "FORMS", session.user.role);
    if (!allowed) return auth;
  }

  const { id } = await context.params;
  const templateId = Number(id);

  if (Number.isNaN(templateId)) {
    return NextResponse.json({ error: "Invalid template id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as FormTemplateInput;
    const validationError = validateFormTemplateInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const template = await updateFormTemplate(templateId, body);
    revalidatePath(`/dashboard/forms/${templateId}/view`);
    revalidatePath(`/dashboard/forms/${templateId}`);
    revalidatePath("/dashboard/forms");
    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof FormTemplateError) {
      return formTemplateErrorResponse(error);
    }

    if (isPostgresFkViolation(error)) {
      console.error("Failed to update form template (FK violation):", error);
      return NextResponse.json(
        { error: APPRAISAL_ANSWER_BLOCK_MESSAGE },
        { status: 409 },
      );
    }

    console.error("Failed to update form template:", error);
    return NextResponse.json(
      { error: "Failed to update form template." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return auth;
    const allowed = await canEditModule(Number(session.user.id), "FORMS", session.user.role);
    if (!allowed) return auth;
  }

  const { id } = await context.params;
  const templateId = Number(id);

  if (Number.isNaN(templateId)) {
    return NextResponse.json({ error: "Invalid template id." }, { status: 400 });
  }

  try {
    const result = await deleteFormTemplate(templateId);
    revalidatePath("/dashboard/forms");
    revalidatePath(`/dashboard/forms/${templateId}/view`);
    revalidatePath(`/dashboard/forms/${templateId}`);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FormTemplateError) {
      return formTemplateErrorResponse(error);
    }

    console.error("Failed to delete form template:", error);
    return NextResponse.json(
      { error: "Failed to delete form template." },
      { status: 500 },
    );
  }
}
