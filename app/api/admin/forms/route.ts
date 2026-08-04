import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import {
  createFormTemplate,
  FormTemplateError,
  listFormTemplates,
} from "@/lib/queries/forms";
import { validateFormTemplateInput } from "@/lib/validation/forms";
import type { FormTemplateInput } from "@/types/forms";
import { canViewModule, canEditModule } from "@/lib/auth/additional-access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

function formTemplateErrorResponse(error: FormTemplateError) {
  return NextResponse.json(
    {
      error: error.message,
      ...(error.meta ?? {}),
    },
    { status: error.statusCode },
  );
}

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    // Check additional-access: FORMS module view permission
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return auth;
    }
    const allowed = await canViewModule(
      Number(session.user.id),
      "FORMS",
      session.user.role,
    );
    if (!allowed) {
      return auth;
    }
  }

  try {
    const templates = await listFormTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to list form templates:", error);
    return NextResponse.json(
      { error: "Failed to load form templates." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    // Check additional-access: FORMS module edit permission
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return auth;
    }
    const allowed = await canEditModule(
      Number(session.user.id),
      "FORMS",
      session.user.role,
    );
    if (!allowed) {
      return auth;
    }
  }

  try {
    const body = (await request.json()) as FormTemplateInput;
    const validationError = validateFormTemplateInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const createdById = session?.user?.id
      ? Number(session.user.id) || undefined
      : undefined;

    const template = await createFormTemplate(body, createdById);
    revalidatePath("/dashboard/forms");
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (error instanceof FormTemplateError) {
      return formTemplateErrorResponse(error);
    }

    console.error("Failed to create form template:", error);
    return NextResponse.json(
      { error: "Failed to create form template." },
      { status: 500 },
    );
  }
}
