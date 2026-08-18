import { NextResponse } from "next/server";
import {
  requireModuleViewApi,
  requireModuleEditApi,
} from "@/lib/auth/require-module-api";
import {
  assignPerformanceMatrixToEmployees,
  createPerformanceLevel,
  deletePerformanceMatrix,
  getPerformanceMatrixByFinancialYearId,
  listPerformanceMatrixLabelsByFinancialYearId,
  listPerformanceMatrixSummaries,
  PerformanceLevelError,
} from "@/lib/queries/performance-levels";
import { validateCreatePerformanceLevelInput } from "@/lib/validation/performance-matrices";
import type { CreatePerformanceLevelInput } from "@/types/performance-matrices";

export async function GET(request: Request) {
  const auth = await requireModuleViewApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const summaries = searchParams.get("summaries") === "1";
  const financialYearId = Number(searchParams.get("financialYearId"));
  const matrixLabel = searchParams.get("matrixLabel")?.trim();
  const labelsOnly = searchParams.get("labelsOnly") === "1";

  try {
    if (summaries) {
      const items = await listPerformanceMatrixSummaries();
      return NextResponse.json(items);
    }

    if (Number.isNaN(financialYearId) || financialYearId <= 0) {
      return NextResponse.json(
        { error: "financialYearId is required." },
        { status: 400 },
      );
    }

    if (labelsOnly) {
      const labels = await listPerformanceMatrixLabelsByFinancialYearId(financialYearId);
      return NextResponse.json(labels);
    }
    const matrix = await getPerformanceMatrixByFinancialYearId(
      financialYearId,
      matrixLabel || undefined,
    );
    return NextResponse.json(matrix);
  } catch (error) {
    console.error("Failed to load performance matrix:", error);
    return NextResponse.json(
      { error: "Failed to load performance matrix." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireModuleEditApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      financialYearId?: unknown;
      matrixLabel?: unknown;
      employeeIds?: unknown;
    };
    const financialYearId = Number(body.financialYearId);
    if (Number.isNaN(financialYearId) || financialYearId <= 0) {
      return NextResponse.json({ error: "financialYearId is required." }, { status: 400 });
    }
    if (typeof body.matrixLabel !== "string" || !body.matrixLabel.trim()) {
      return NextResponse.json({ error: "matrixLabel is required." }, { status: 400 });
    }
    if (!Array.isArray(body.employeeIds) || body.employeeIds.length === 0) {
      return NextResponse.json({ error: "employeeIds must be a non-empty array." }, { status: 400 });
    }
    if (!body.employeeIds.every((item) => typeof item === "string" && item.trim())) {
      return NextResponse.json({ error: "Each employeeId must be a non-empty string." }, { status: 400 });
    }

    const result = await assignPerformanceMatrixToEmployees(
      financialYearId,
      body.matrixLabel,
      body.employeeIds as string[],
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PerformanceLevelError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to assign performance matrix:", error);
    return NextResponse.json(
      { error: "Failed to assign performance matrix." },
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
    const body = (await request.json()) as CreatePerformanceLevelInput;
    const validationError = validateCreatePerformanceLevelInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const level = await createPerformanceLevel(body);
    return NextResponse.json(level, { status: 201 });
  } catch (error) {
    if (error instanceof PerformanceLevelError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to create performance level:", error);
    return NextResponse.json(
      { error: "Failed to create performance level." },
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
      matrixLabel?: unknown;
    };
    const financialYearId = Number(body.financialYearId);
    if (Number.isNaN(financialYearId) || financialYearId <= 0) {
      return NextResponse.json(
        { error: "financialYearId is required." },
        { status: 400 },
      );
    }
    if (typeof body.matrixLabel !== "string" || !body.matrixLabel.trim()) {
      return NextResponse.json(
        { error: "matrixLabel is required." },
        { status: 400 },
      );
    }

    await deletePerformanceMatrix(financialYearId, body.matrixLabel);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PerformanceLevelError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to delete performance matrix:", error);
    return NextResponse.json(
      { error: "Failed to delete performance matrix." },
      { status: 500 },
    );
  }
}
