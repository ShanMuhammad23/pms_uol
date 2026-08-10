import { NextResponse } from "next/server";
import {
  requireModuleViewApi,
  requireModuleEditApi,
} from "@/lib/auth/require-module-api";
import {
  assignFormTemplateToEmployees,
  FormTemplateError,
  listFormTemplateAssignedEmployees,
  unassignFormTemplateFromEmployees,
  updateAssignmentSelfAssessmentDisabled,
} from "@/lib/queries/forms";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function parseEmployeeIds(body: { employeeIds?: unknown }): string[] | NextResponse {
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

  return body.employeeIds as string[];
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireModuleViewApi("FORMS");
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
  const auth = await requireModuleEditApi("FORMS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const templateId = Number(id);
  if (Number.isNaN(templateId)) {
    return NextResponse.json({ error: "Invalid template id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { employeeIds?: unknown; selfAssessmentDisabledMap?: Record<string, boolean> };
    const employeeIds = parseEmployeeIds(body);
    if (employeeIds instanceof NextResponse) {
      return employeeIds;
    }

    const result = await assignFormTemplateToEmployees(templateId, employeeIds, body.selfAssessmentDisabledMap);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FormTemplateError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to assign form to employees:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to assign form.", detail },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireModuleEditApi("FORMS");
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
    const employeeIds = parseEmployeeIds(body);
    if (employeeIds instanceof NextResponse) {
      return employeeIds;
    }

    const result = await unassignFormTemplateFromEmployees(
      templateId,
      employeeIds,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FormTemplateError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to unassign form from employees:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to unassign form.", detail },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireModuleEditApi("FORMS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const templateId = Number(id);
  if (Number.isNaN(templateId)) {
    return NextResponse.json({ error: "Invalid template id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { employeeId?: unknown; selfAssessmentDisabled?: unknown };
    if (typeof body.employeeId !== "string" || !body.employeeId.trim()) {
      return NextResponse.json(
        { error: "employeeId must be a non-empty string." },
        { status: 400 },
      );
    }
    if (typeof body.selfAssessmentDisabled !== "boolean") {
      return NextResponse.json(
        { error: "selfAssessmentDisabled must be a boolean." },
        { status: 400 },
      );
    }

    const result = await updateAssignmentSelfAssessmentDisabled(
      templateId,
      body.employeeId,
      body.selfAssessmentDisabled,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FormTemplateError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to update self-assessment flag:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to update self-assessment flag.", detail },
      { status: 500 },
    );
  }
}
