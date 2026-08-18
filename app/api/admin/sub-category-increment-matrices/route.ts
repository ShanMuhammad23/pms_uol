import { NextResponse } from "next/server";
import {
  requireModuleViewApi,
  requireModuleEditApi,
} from "@/lib/auth/require-module-api";
import {
  createSubCategoryIncrementMatrix,
  deleteIncrementMatrix,
  listIncrementMatrixSummaries,
  listSubCategoryIncrementMatrices,
  SubCategoryIncrementMatrixError,
} from "@/lib/queries/sub-category-increment-matrices";
import { validateCreateSubCategoryIncrementMatrixInput } from "@/lib/validation/sub-category-increment-matrices";
import type { CreateSubCategoryIncrementMatrixInput } from "@/types/sub-category-increment-matrices";

export async function GET(request: Request) {
  const auth = await requireModuleViewApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const summaries = searchParams.get("summaries") === "1";
  const financialYearId = Number(searchParams.get("financialYearId"));

  try {
    if (summaries) {
      const items = await listIncrementMatrixSummaries();
      return NextResponse.json(items);
    }

    if (Number.isNaN(financialYearId) || financialYearId <= 0) {
      return NextResponse.json(
        { error: "financialYearId is required." },
        { status: 400 },
      );
    }

    const entries = await listSubCategoryIncrementMatrices(financialYearId);
    return NextResponse.json(entries);
  } catch (error) {
    console.error("Failed to load sub-category increment matrices:", error);
    return NextResponse.json(
      { error: "Failed to load increment matrix entries." },
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
    const body = (await request.json()) as CreateSubCategoryIncrementMatrixInput;
    const validationError = validateCreateSubCategoryIncrementMatrixInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const entry = await createSubCategoryIncrementMatrix(body);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof SubCategoryIncrementMatrixError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to create sub-category increment matrix:", error);
    return NextResponse.json(
      { error: "Failed to create increment matrix entry." },
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

    await deleteIncrementMatrix(financialYearId, body.matrixLabel);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SubCategoryIncrementMatrixError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to delete increment matrix:", error);
    return NextResponse.json(
      { error: "Failed to delete increment matrix." },
      { status: 500 },
    );
  }
}
