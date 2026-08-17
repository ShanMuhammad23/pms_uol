import { NextResponse } from "next/server";
import {
  requireModuleEditApi,
  requireModuleViewApi,
} from "@/lib/auth/require-module-api";
import {
  listEmployeePerformanceMatrixAssignments,
  PerformanceLevelError,
  unassignPerformanceMatrixFromEmployees,
} from "@/lib/queries/performance-levels";

export async function GET(request: Request) {
  const auth = await requireModuleViewApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const financialYearId = Number(searchParams.get("financialYearId"));

  if (Number.isNaN(financialYearId) || financialYearId <= 0) {
    return NextResponse.json(
      { error: "financialYearId is required." },
      { status: 400 },
    );
  }

  try {
    const assignments =
      await listEmployeePerformanceMatrixAssignments(financialYearId);
    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Failed to list performance matrix assignments:", error);
    return NextResponse.json(
      { error: "Failed to load assignments." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireModuleEditApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      financialYearId?: unknown;
      employeeIds?: unknown;
      matrixLabel?: unknown;
    };

    const financialYearId = Number(body.financialYearId);
    if (Number.isNaN(financialYearId) || financialYearId <= 0) {
      return NextResponse.json(
        { error: "financialYearId is required." },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.employeeIds) || body.employeeIds.length === 0) {
      return NextResponse.json(
        { error: "employeeIds must be a non-empty array." },
        { status: 400 },
      );
    }

    if (
      !body.employeeIds.every((item) => typeof item === "string" && item.trim())
    ) {
      return NextResponse.json(
        { error: "Each employeeId must be a non-empty string." },
        { status: 400 },
      );
    }

    const matrixLabel =
      typeof body.matrixLabel === "string" ? body.matrixLabel : undefined;

    const result = await unassignPerformanceMatrixFromEmployees(
      financialYearId,
      body.employeeIds as string[],
      matrixLabel,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PerformanceLevelError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to unassign performance matrix:", error);
    return NextResponse.json(
      { error: "Failed to unassign performance matrix." },
      { status: 500 },
    );
  }
}
