import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import {
  createPerformanceQuartile,
  listPerformanceQuartilesByLevelId,
  PerformanceQuartileError,
} from "@/lib/queries/performance-quartiles";
import { validateCreatePerformanceQuartileInput } from "@/lib/validation/performance-matrices";
import type { CreatePerformanceQuartileInput } from "@/types/performance-matrices";

export async function GET(request: Request) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const performanceLevelId = Number(searchParams.get("performanceLevelId"));

  if (Number.isNaN(performanceLevelId) || performanceLevelId <= 0) {
    return NextResponse.json(
      { error: "performanceLevelId is required." },
      { status: 400 },
    );
  }

  try {
    const quartiles = await listPerformanceQuartilesByLevelId(performanceLevelId);
    return NextResponse.json(quartiles);
  } catch (error) {
    console.error("Failed to list performance quartiles:", error);
    return NextResponse.json(
      { error: "Failed to load performance quartiles." },
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
    const body = (await request.json()) as CreatePerformanceQuartileInput;
    const validationError = validateCreatePerformanceQuartileInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const quartile = await createPerformanceQuartile(body);
    return NextResponse.json(quartile, { status: 201 });
  } catch (error) {
    if (error instanceof PerformanceQuartileError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to create performance quartile:", error);
    return NextResponse.json(
      { error: "Failed to create performance quartile." },
      { status: 500 },
    );
  }
}
