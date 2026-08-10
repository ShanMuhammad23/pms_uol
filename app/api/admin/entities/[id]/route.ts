import { NextResponse } from "next/server";
import {
  requireModuleViewApi,
  requireModuleEditApi,
} from "@/lib/auth/require-module-api";
import {
  deleteEntity,
  EntityError,
  getEntityById,
  updateEntity,
} from "@/lib/queries/entities";
import { validateUpdateEntityInput } from "@/lib/validation/entities";
import type { UpdateEntityInput } from "@/types/entities";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireModuleViewApi("ORGANIZATION_LEVELS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const entityId = Number(id);

  if (Number.isNaN(entityId)) {
    return NextResponse.json({ error: "Invalid entity id." }, { status: 400 });
  }

  try {
    const entity = await getEntityById(entityId);

    if (!entity) {
      return NextResponse.json({ error: "Entity not found." }, { status: 404 });
    }

    return NextResponse.json(entity);
  } catch (error) {
    console.error("Failed to get entity:", error);
    return NextResponse.json(
      { error: "Failed to load entity." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireModuleEditApi("ORGANIZATION_LEVELS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const entityId = Number(id);

  if (Number.isNaN(entityId)) {
    return NextResponse.json({ error: "Invalid entity id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as UpdateEntityInput;
    const validationError = validateUpdateEntityInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const entity = await updateEntity(entityId, body);
    return NextResponse.json(entity);
  } catch (error) {
    if (error instanceof EntityError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to update entity:", error);
    return NextResponse.json(
      { error: "Failed to update entity." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireModuleEditApi("ORGANIZATION_LEVELS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const entityId = Number(id);

  if (Number.isNaN(entityId)) {
    return NextResponse.json({ error: "Invalid entity id." }, { status: 400 });
  }

  try {
    await deleteEntity(entityId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof EntityError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to delete entity:", error);
    return NextResponse.json(
      { error: "Failed to delete entity." },
      { status: 500 },
    );
  }
}
