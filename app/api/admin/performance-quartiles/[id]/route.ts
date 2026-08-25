import { NextResponse } from "next/server";
import {
  requireModuleViewApi,
  requireModuleEditApi,
} from "@/lib/auth/require-module-api";
import {
  deletePerformanceQuartile,
  getPerformanceQuartileById,
  PerformanceQuartileError,
  updatePerformanceQuartile,
} from "@/lib/queries/performance-quartiles";
import { validateUpdatePerformanceQuartileInput } from "@/lib/validation/performance-matrices";
import type { UpdatePerformanceQuartileInput } from "@/types/performance-matrices";
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
  const quartileId = Number(id);

  if (Number.isNaN(quartileId)) {
    return NextResponse.json({ error: "Invalid performance quartile id." }, { status: 400 });
  }

  try {
    const quartile = await getPerformanceQuartileById(quartileId);

    if (!quartile) {
      return NextResponse.json(
        { error: "Performance quartile not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(quartile);
  } catch (error) {
    console.error("Failed to get performance quartile:", error);
    return NextResponse.json(
      { error: "Failed to load performance quartile." },
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
  const quartileId = Number(id);

  if (Number.isNaN(quartileId)) {
    return NextResponse.json({ error: "Invalid performance quartile id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as UpdatePerformanceQuartileInput;
    const validationError = validateUpdatePerformanceQuartileInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const quartile = await updatePerformanceQuartile(quartileId, body);
    return NextResponse.json(quartile);
  } catch (error) {
    if (error instanceof PerformanceQuartileError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to update performance quartile:", error);
    return NextResponse.json(
      { error: "Failed to update performance quartile." },
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
  const quartileId = Number(id);

  if (Number.isNaN(quartileId)) {
    return NextResponse.json({ error: "Invalid performance quartile id." }, { status: 400 });
  }

  try {
    await deletePerformanceQuartile(quartileId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PerformanceQuartileError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to delete performance quartile:", error);
    return NextResponse.json(
      { error: "Failed to delete performance quartile." },
      { status: 500 },
    );
  }
});
