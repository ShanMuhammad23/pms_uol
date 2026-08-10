import { NextResponse } from "next/server";
import {
  requireModuleViewApi,
  requireModuleEditApi,
} from "@/lib/auth/require-module-api";
import {
  assignIncrementMatrixToEmployees,
  listEmployeeIncrementMatrixAssignments,
  SubCategoryIncrementMatrixError,
  unassignIncrementMatrixFromEmployees,
} from "@/lib/queries/sub-category-increment-matrices";

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
    const assignments = await listEmployeeIncrementMatrixAssignments(
      financialYearId,
    );
    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Failed to list increment matrix assignments:", error);
    return NextResponse.json(
      { error: "Failed to load assignments." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireModuleEditApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      financialYearId: number;
      matrixLabel: string;
      employeeCodes: string[];
    };

    if (
      !body.financialYearId ||
      Number.isNaN(Number(body.financialYearId))
    ) {
      return NextResponse.json(
        { error: "financialYearId is required." },
        { status: 400 },
      );
    }

    if (!body.matrixLabel?.trim()) {
      return NextResponse.json(
        { error: "Matrix label is required." },
        { status: 400 },
      );
    }

    if (!body.employeeCodes || body.employeeCodes.length === 0) {
      return NextResponse.json(
        { error: "At least one employee is required." },
        { status: 400 },
      );
    }

    const result = await assignIncrementMatrixToEmployees(
      body.financialYearId,
      body.matrixLabel,
      body.employeeCodes,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SubCategoryIncrementMatrixError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to assign increment matrix:", error);
    return NextResponse.json(
      { error: "Failed to assign increment matrix." },
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
      financialYearId: number;
      employeeCodes: string[];
    };

    if (
      !body.financialYearId ||
      Number.isNaN(Number(body.financialYearId))
    ) {
      return NextResponse.json(
        { error: "financialYearId is required." },
        { status: 400 },
      );
    }

    if (!body.employeeCodes || body.employeeCodes.length === 0) {
      return NextResponse.json(
        { error: "At least one employee is required." },
        { status: 400 },
      );
    }

    const result = await unassignIncrementMatrixFromEmployees(
      body.financialYearId,
      body.employeeCodes,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SubCategoryIncrementMatrixError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to unassign increment matrix:", error);
    return NextResponse.json(
      { error: "Failed to unassign increment matrix." },
      { status: 500 },
    );
  }
}
