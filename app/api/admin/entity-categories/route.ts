import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import {
  createEntityCategory,
  EntityCategoryError,
  listEntityCategories,
} from "@/lib/queries/entity-categories";
import { validateCreateEntityCategoryInput } from "@/lib/validation/entity-categories";
import type { CreateEntityCategoryInput } from "@/types/entity-categories";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const categories = await listEntityCategories();
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Failed to list entity categories:", error);
    return NextResponse.json(
      { error: "Failed to load entity categories." },
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
    const body = (await request.json()) as CreateEntityCategoryInput;
    const validationError = validateCreateEntityCategoryInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const category = await createEntityCategory(body);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (error instanceof EntityCategoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to create entity category:", error);
    return NextResponse.json(
      { error: "Failed to create entity category." },
      { status: 500 },
    );
  }
}
