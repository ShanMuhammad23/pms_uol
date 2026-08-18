import { NextResponse } from "next/server";
import {
  requireModuleEditApi,
} from "@/lib/auth/require-module-api";
import {
  createPerformanceMatrix,
  PerformanceLevelError,
  updatePerformanceMatrixIdentity,
} from "@/lib/queries/performance-levels";

export async function POST(request: Request) {
  const auth = await requireModuleEditApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      financialYearId?: unknown;
      matrixLabel?: unknown;
      title?: unknown;
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

    const created = await createPerformanceMatrix({
      financialYearId,
      matrixLabel: body.matrixLabel,
      title: typeof body.title === "string" ? body.title : body.matrixLabel,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof PerformanceLevelError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    console.error("Failed to create performance matrix:", error);
    return NextResponse.json(
      { error: "Failed to create performance matrix." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireModuleEditApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      financialYearId?: unknown;
      matrixLabel?: unknown;
      newMatrixLabel?: unknown;
      title?: unknown;
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
    if (typeof body.newMatrixLabel !== "string" || !body.newMatrixLabel.trim()) {
      return NextResponse.json(
        { error: "newMatrixLabel is required." },
        { status: 400 },
      );
    }
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "title is required." }, { status: 400 });
    }

    const updated = await updatePerformanceMatrixIdentity({
      financialYearId,
      matrixLabel: body.matrixLabel,
      newMatrixLabel: body.newMatrixLabel,
      title: body.title,
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof PerformanceLevelError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    console.error("Failed to update performance matrix:", error);
    return NextResponse.json(
      { error: "Failed to update performance matrix." },
      { status: 500 },
    );
  }
}
