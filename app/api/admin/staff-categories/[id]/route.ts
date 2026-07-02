import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import {
  deleteStaffCategory,
  listStaffCategories,
  StaffCategoryError,
  updateStaffCategory,
} from "@/lib/queries/staff-categories";
import { validateUpdateStaffCategoryInput } from "@/lib/validation/staff-categories";
import type { UpdateStaffCategoryInput } from "@/types/staff-categories";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const categoryId = Number(id);

  if (Number.isNaN(categoryId)) {
    return NextResponse.json({ error: "Invalid category id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as UpdateStaffCategoryInput;
    const validationError = validateUpdateStaffCategoryInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const category = await updateStaffCategory(categoryId, body);
    return NextResponse.json(category);
  } catch (error) {
    if (error instanceof StaffCategoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to update staff category:", error);
    return NextResponse.json(
      { error: "Failed to update staff category." },
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
  const categoryId = Number(id);

  if (Number.isNaN(categoryId)) {
    return NextResponse.json({ error: "Invalid category id." }, { status: 400 });
  }

  try {
    await deleteStaffCategory(categoryId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof StaffCategoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to delete staff category:", error);
    return NextResponse.json(
      { error: "Failed to delete staff category." },
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
  const categoryId = Number(id);

  if (Number.isNaN(categoryId)) {
    return NextResponse.json({ error: "Invalid category id." }, { status: 400 });
  }

  try {
    const category = (await listStaffCategories()).find((item) => item.id === categoryId);
    if (!category) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }
    return NextResponse.json(category);
  } catch (error) {
    if (error instanceof StaffCategoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to load staff category:", error);
    return NextResponse.json(
      { error: "Failed to load staff category." },
      { status: 500 },
    );
  }
}
