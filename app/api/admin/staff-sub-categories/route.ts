import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import {
  createStaffSubCategory,
  listStaffSubCategories,
  StaffCategoryError,
} from "@/lib/queries/staff-categories";
import { validateCreateStaffSubCategoryInput } from "@/lib/validation/staff-categories";
import type { CreateStaffSubCategoryInput } from "@/types/staff-categories";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const subCategories = await listStaffSubCategories();
    return NextResponse.json(subCategories);
  } catch (error) {
    if (error instanceof StaffCategoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to list staff sub-categories:", error);
    return NextResponse.json(
      { error: "Failed to load staff sub-categories." },
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
    const body = (await request.json()) as CreateStaffSubCategoryInput;
    const validationError = validateCreateStaffSubCategoryInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const subCategory = await createStaffSubCategory(body);
    return NextResponse.json(subCategory, { status: 201 });
  } catch (error) {
    if (error instanceof StaffCategoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to create staff sub-category:", error);
    return NextResponse.json(
      { error: "Failed to create staff sub-category." },
      { status: 500 },
    );
  }
}
