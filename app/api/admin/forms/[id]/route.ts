import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import {
  deleteFormTemplate,
  FormTemplateError,
  getFormTemplateById,
  updateFormTemplate,
} from "@/lib/queries/forms";
import { validateFormTemplateInput } from "@/lib/validation/forms";
import type { FormTemplateInput } from "@/types/forms";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
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
    return auth;
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
    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof FormTemplateError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
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
    return auth;
  }

  const { id } = await context.params;
  const templateId = Number(id);

  if (Number.isNaN(templateId)) {
    return NextResponse.json({ error: "Invalid template id." }, { status: 400 });
  }

  try {
    const result = await deleteFormTemplate(templateId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FormTemplateError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to delete form template:", error);
    return NextResponse.json(
      { error: "Failed to delete form template." },
      { status: 500 },
    );
  }
}
