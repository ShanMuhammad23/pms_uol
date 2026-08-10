import { NextResponse } from "next/server";
import {
  requireModuleViewApi,
  requireModuleEditApi,
} from "@/lib/auth/require-module-api";
import {
  deleteFinancialYear,
  FinancialYearError,
  getFinancialYearById,
  updateFinancialYear,
} from "@/lib/queries/financial-years";
import { validateUpdateFinancialYearInput } from "@/lib/validation/financial-years";
import type { UpdateFinancialYearInput } from "@/types/financial-years";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireModuleViewApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const yearId = Number(id);

  if (Number.isNaN(yearId)) {
    return NextResponse.json({ error: "Invalid financial year id." }, { status: 400 });
  }

  try {
    const year = await getFinancialYearById(yearId);

    if (!year) {
      return NextResponse.json(
        { error: "Financial year not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(year);
  } catch (error) {
    console.error("Failed to get financial year:", error);
    return NextResponse.json(
      { error: "Failed to load financial year." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireModuleEditApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const yearId = Number(id);

  if (Number.isNaN(yearId)) {
    return NextResponse.json({ error: "Invalid financial year id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as UpdateFinancialYearInput;
    const validationError = validateUpdateFinancialYearInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const year = await updateFinancialYear(yearId, body);
    return NextResponse.json(year);
  } catch (error) {
    if (error instanceof FinancialYearError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to update financial year:", error);
    return NextResponse.json(
      { error: "Failed to update financial year." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireModuleEditApi("MATRICES_AND_CYCLES");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const yearId = Number(id);

  if (Number.isNaN(yearId)) {
    return NextResponse.json({ error: "Invalid financial year id." }, { status: 400 });
  }

  try {
    await deleteFinancialYear(yearId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof FinancialYearError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to delete financial year:", error);
    return NextResponse.json(
      { error: "Failed to delete financial year." },
      { status: 500 },
    );
  }
}
