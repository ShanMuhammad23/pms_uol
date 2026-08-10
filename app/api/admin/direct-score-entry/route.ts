import { NextResponse } from "next/server";
import {
  requireModuleViewApi,
  requireModuleEditApi,
} from "@/lib/auth/require-module-api";
import {
  assignDirectScoreEntryToEmployees,
  FormTemplateError,
  listDirectScoreEntryEmployees,
  unassignDirectScoreEntryFromEmployees,
} from "@/lib/queries/forms";

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

export async function GET() {
  const auth = await requireModuleViewApi("FORMS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const employees = await listDirectScoreEntryEmployees();
    return NextResponse.json(employees);
  } catch (error) {
    if (error instanceof FormTemplateError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to load direct score entry employees:", error);
    return NextResponse.json(
      { error: "Failed to load direct score entry employees." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireModuleEditApi("FORMS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as { employeeIds?: unknown };
    const employeeIds = parseEmployeeIds(body);
    if (employeeIds instanceof NextResponse) {
      return employeeIds;
    }

    const result = await assignDirectScoreEntryToEmployees(employeeIds);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FormTemplateError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to assign direct score entry:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to assign direct score entry.", detail },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireModuleEditApi("FORMS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as { employeeIds?: unknown };
    const employeeIds = parseEmployeeIds(body);
    if (employeeIds instanceof NextResponse) {
      return employeeIds;
    }

    const result = await unassignDirectScoreEntryFromEmployees(employeeIds);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FormTemplateError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to unassign direct score entry:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to unassign direct score entry.", detail },
      { status: 500 },
    );
  }
}
