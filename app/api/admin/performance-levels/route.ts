import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import {
  createPerformanceLevel,
  getPerformanceMatrixByFinancialYearId,
  PerformanceLevelError,
} from "@/lib/queries/performance-levels";
import { validateCreatePerformanceLevelInput } from "@/lib/validation/performance-matrices";
import type { CreatePerformanceLevelInput } from "@/types/performance-matrices";

export async function GET(request: Request) {
  const auth = await requireSuperAdminApi();
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
    const matrix = await getPerformanceMatrixByFinancialYearId(financialYearId);
    return NextResponse.json(matrix);
  } catch (error) {
    console.error("Failed to load performance matrix:", error);
    return NextResponse.json(
      { error: "Failed to load performance matrix." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
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
