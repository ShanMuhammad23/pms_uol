import { NextResponse } from "next/server";
import {
  requireModuleViewApi,
  requireModuleEditApi,
} from "@/lib/auth/require-module-api";
import {
  deletePerformanceLevel,
  getPerformanceLevelById,
  PerformanceLevelError,
  updatePerformanceLevel,
} from "@/lib/queries/performance-levels";
import { validateUpdatePerformanceLevelInput } from "@/lib/validation/performance-matrices";
import type { UpdatePerformanceLevelInput } from "@/types/performance-matrices";
import { apiHandler } from "@/lib/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = apiHandler(async (_request: Request, context: RouteContext) => {
  const auth = await requireModuleViewApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const levelId = Number(id);

  if (Number.isNaN(levelId)) {
    return NextResponse.json({ error: "Invalid performance level id." }, { status: 400 });
  }

  try {
    const level = await getPerformanceLevelById(levelId);

    if (!level) {
      return NextResponse.json(
        { error: "Performance level not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(level);
  } catch (error) {
    console.error("Failed to get performance level:", error);
    return NextResponse.json(
      { error: "Failed to load performance level." },
      { status: 500 },
    );
  }
});

export const PUT = apiHandler(async (request: Request, context: RouteContext) => {
  const auth = await requireModuleEditApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const levelId = Number(id);

  if (Number.isNaN(levelId)) {
    return NextResponse.json({ error: "Invalid performance level id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as UpdatePerformanceLevelInput;
    const validationError = validateUpdatePerformanceLevelInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const level = await updatePerformanceLevel(levelId, body);
    return NextResponse.json(level);
  } catch (error) {
    if (error instanceof PerformanceLevelError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to update performance level:", error);
    return NextResponse.json(
      { error: "Failed to update performance level." },
      { status: 500 },
    );
  }
});

export const DELETE = apiHandler(async (_request: Request, context: RouteContext) => {
  const auth = await requireModuleEditApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const levelId = Number(id);

  if (Number.isNaN(levelId)) {
    return NextResponse.json({ error: "Invalid performance level id." }, { status: 400 });
  }

  try {
    await deletePerformanceLevel(levelId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PerformanceLevelError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to delete performance level:", error);
    return NextResponse.json(
      { error: "Failed to delete performance level." },
      { status: 500 },
    );
  }
});
