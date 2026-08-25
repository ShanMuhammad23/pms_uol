import { NextResponse } from "next/server";
import {
  requireModuleViewApi,
  requireModuleEditApi,
} from "@/lib/auth/require-module-api";
import {
  createEntity,
  EntityError,
  listEntities,
} from "@/lib/queries/entities";
import { validateCreateEntityInput } from "@/lib/validation/entities";
import type { CreateEntityInput } from "@/types/entities";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const GET = apiHandler(async () => {
  const auth = await requireModuleViewApi("ORGANIZATION_LEVELS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const entities = await listEntities();
    return NextResponse.json(entities);
  } catch (error) {
    console.error("Failed to list entities:", error);
    return NextResponse.json(
      { error: "Failed to load entities." },
      { status: 500 },
    );
  }
});

export const POST = apiHandler(async (request: Request) => {
  const auth = await requireModuleEditApi("ORGANIZATION_LEVELS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as CreateEntityInput;
    const validationError = validateCreateEntityInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const entity = await createEntity(body);
    return NextResponse.json(entity, { status: 201 });
  } catch (error) {
    if (error instanceof EntityError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to create entity:", error);
    return NextResponse.json(
      { error: "Failed to create entity." },
      { status: 500 },
    );
  }
});
