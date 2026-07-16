import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import {
  assignFormTemplateToEmployees,
  FormTemplateError,
  listFormTemplateAssignedEmployees,
} from "@/lib/queries/forms";

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
    const assigned = await listFormTemplateAssignedEmployees(templateId);
    return NextResponse.json(assigned);
  } catch (error) {
    if (error instanceof FormTemplateError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to load form assignments:", error);
    return NextResponse.json(
      { error: "Failed to load form assignments." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
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
    const body = (await request.json()) as { employeeIds?: unknown };
    if (!Array.isArray(body.employeeIds) || body.employeeIds.length === 0) {
      return NextResponse.json(
        { error: "employeeIds must be a non-empty array." },
        { status: 400 },
      );
    }

    if (!body.employeeIds.every((item) => typeof item === "string" && item.trim())) {
      return NextResponse.json(
        { error: "Each employeeId must be a non-empty string." },
        { status: 400 },
      );
    }

    const result = await assignFormTemplateToEmployees(
      templateId,
      body.employeeIds as string[],
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FormTemplateError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to assign form to employees:", error);
    return NextResponse.json(
      { error: "Failed to assign form." },
      { status: 500 },
    );
  }
}

