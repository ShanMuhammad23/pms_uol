import { NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth/require-session";
import {
  deleteEntityCategory,
  EntityCategoryError,
  getEntityCategoryById,
  updateEntityCategory,
} from "@/lib/queries/entity-categories";
import { validateUpdateEntityCategoryInput } from "@/lib/validation/entity-categories";
import type { UpdateEntityCategoryInput } from "@/types/entity-categories";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSessionApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const categoryId = Number(id);

  if (Number.isNaN(categoryId)) {
    return NextResponse.json({ error: "Invalid category id." }, { status: 400 });
  }

  try {
    const category = await getEntityCategoryById(categoryId);

    if (!category) {
      return NextResponse.json(
        { error: "Entity category not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Failed to get entity category:", error);
    return NextResponse.json(
      { error: "Failed to load entity category." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireSessionApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const categoryId = Number(id);

  if (Number.isNaN(categoryId)) {
    return NextResponse.json({ error: "Invalid category id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as UpdateEntityCategoryInput;
    const validationError = validateUpdateEntityCategoryInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const category = await updateEntityCategory(categoryId, body);
    return NextResponse.json(category);
  } catch (error) {
    if (error instanceof EntityCategoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to update entity category:", error);
    return NextResponse.json(
      { error: "Failed to update entity category." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireSessionApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const categoryId = Number(id);

  if (Number.isNaN(categoryId)) {
    return NextResponse.json({ error: "Invalid category id." }, { status: 400 });
  }

  try {
    await deleteEntityCategory(categoryId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof EntityCategoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to delete entity category:", error);
    return NextResponse.json(
      { error: "Failed to delete entity category." },
      { status: 500 },
    );
  }
}
