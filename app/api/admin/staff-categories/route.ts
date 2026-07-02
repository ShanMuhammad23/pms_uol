import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import {
  createStaffCategory,
  listStaffCategories,
  StaffCategoryError,
} from "@/lib/queries/staff-categories";
import { validateCreateStaffCategoryInput } from "@/lib/validation/staff-categories";
import type { CreateStaffCategoryInput } from "@/types/staff-categories";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const categories = await listStaffCategories();
    return NextResponse.json(categories);
  } catch (error) {
    if (error instanceof StaffCategoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to list staff categories:", error);
    return NextResponse.json(
      { error: "Failed to load staff categories." },
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
    const body = (await request.json()) as CreateStaffCategoryInput;
    const validationError = validateCreateStaffCategoryInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const category = await createStaffCategory(body);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (error instanceof StaffCategoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to create staff category:", error);
    return NextResponse.json(
      { error: "Failed to create staff category." },
      { status: 500 },
    );
  }
}
