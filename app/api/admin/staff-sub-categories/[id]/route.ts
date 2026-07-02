import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import {
  deleteStaffSubCategory,
  listStaffSubCategories,
  StaffCategoryError,
  updateStaffSubCategory,
} from "@/lib/queries/staff-categories";
import { validateUpdateStaffSubCategoryInput } from "@/lib/validation/staff-categories";
import type { UpdateStaffSubCategoryInput } from "@/types/staff-categories";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const subCategoryId = Number(id);

  if (Number.isNaN(subCategoryId)) {
    return NextResponse.json({ error: "Invalid sub-category id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as UpdateStaffSubCategoryInput;
    const validationError = validateUpdateStaffSubCategoryInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const subCategory = await updateStaffSubCategory(subCategoryId, body);
    return NextResponse.json(subCategory);
  } catch (error) {
    if (error instanceof StaffCategoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to update staff sub-category:", error);
    return NextResponse.json(
      { error: "Failed to update staff sub-category." },
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
  const subCategoryId = Number(id);

  if (Number.isNaN(subCategoryId)) {
    return NextResponse.json({ error: "Invalid sub-category id." }, { status: 400 });
  }

  try {
    await deleteStaffSubCategory(subCategoryId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof StaffCategoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to delete staff sub-category:", error);
    return NextResponse.json(
      { error: "Failed to delete staff sub-category." },
      { status: 500 },
    );
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const subCategoryId = Number(id);

  if (Number.isNaN(subCategoryId)) {
    return NextResponse.json({ error: "Invalid sub-category id." }, { status: 400 });
  }

  try {
    const subCategory = (await listStaffSubCategories()).find((item) => item.id === subCategoryId);
    if (!subCategory) {
      return NextResponse.json({ error: "Sub-category not found." }, { status: 404 });
    }
    return NextResponse.json(subCategory);
  } catch (error) {
    if (error instanceof StaffCategoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to load staff sub-category:", error);
    return NextResponse.json(
      { error: "Failed to load staff sub-category." },
      { status: 500 },
    );
  }
}
