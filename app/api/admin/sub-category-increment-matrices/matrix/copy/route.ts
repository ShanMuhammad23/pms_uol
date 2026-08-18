import { NextResponse } from "next/server";
import { requireModuleEditApi } from "@/lib/auth/require-module-api";
import {
  copyIncrementMatrix,
  SubCategoryIncrementMatrixError,
} from "@/lib/queries/sub-category-increment-matrices";

export async function POST(request: Request) {
  const auth = await requireModuleEditApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      sourceFinancialYearId?: unknown;
      sourceMatrixLabel?: unknown;
      targetFinancialYearId?: unknown;
      newMatrixLabel?: unknown;
      title?: unknown;
    };
    const sourceFinancialYearId = Number(body.sourceFinancialYearId);
    const targetFinancialYearId = Number(body.targetFinancialYearId);
    if (
      Number.isNaN(sourceFinancialYearId) ||
      sourceFinancialYearId <= 0 ||
      Number.isNaN(targetFinancialYearId) ||
      targetFinancialYearId <= 0
    ) {
      return NextResponse.json(
        { error: "sourceFinancialYearId and targetFinancialYearId are required." },
        { status: 400 },
      );
    }
    if (
      typeof body.sourceMatrixLabel !== "string" ||
      !body.sourceMatrixLabel.trim()
    ) {
      return NextResponse.json(
        { error: "sourceMatrixLabel is required." },
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

    const copied = await copyIncrementMatrix({
      sourceFinancialYearId,
      sourceMatrixLabel: body.sourceMatrixLabel,
      targetFinancialYearId,
      newMatrixLabel: body.newMatrixLabel,
      title: body.title,
    });
    return NextResponse.json(copied, { status: 201 });
  } catch (error) {
    if (error instanceof SubCategoryIncrementMatrixError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    console.error("Failed to copy increment matrix:", error);
    return NextResponse.json(
      { error: "Failed to copy increment matrix." },
      { status: 500 },
    );
  }
}
