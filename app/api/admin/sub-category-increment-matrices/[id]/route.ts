import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import {
  deleteSubCategoryIncrementMatrix,
  SubCategoryIncrementMatrixError,
  updateSubCategoryIncrementMatrix,
} from "@/lib/queries/sub-category-increment-matrices";
import { validateUpdateSubCategoryIncrementMatrixInput } from "@/lib/validation/sub-category-increment-matrices";
import type { UpdateSubCategoryIncrementMatrixInput } from "@/types/sub-category-increment-matrices";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const entryId = Number(id);

  if (Number.isNaN(entryId)) {
    return NextResponse.json({ error: "Invalid entry id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as UpdateSubCategoryIncrementMatrixInput & {
      financialYearId?: number;
    };
    const validationError = validateUpdateSubCategoryIncrementMatrixInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (!body.financialYearId || Number.isNaN(Number(body.financialYearId))) {
      return NextResponse.json(
        { error: "financialYearId is required." },
        { status: 400 },
      );
    }

    const entry = await updateSubCategoryIncrementMatrix(
      entryId,
      body.financialYearId,
      body,
    );
    return NextResponse.json(entry);
  } catch (error) {
    if (error instanceof SubCategoryIncrementMatrixError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to update sub-category increment matrix:", error);
    return NextResponse.json(
      { error: "Failed to update increment matrix entry." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const entryId = Number(id);

  if (Number.isNaN(entryId)) {
    return NextResponse.json({ error: "Invalid entry id." }, { status: 400 });
  }

  try {
    await deleteSubCategoryIncrementMatrix(entryId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SubCategoryIncrementMatrixError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to delete sub-category increment matrix:", error);
    return NextResponse.json(
      { error: "Failed to delete increment matrix entry." },
      { status: 500 },
    );
  }
}
