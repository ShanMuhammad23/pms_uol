import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import {
  createFinancialYear,
  FinancialYearError,
  listFinancialYears,
} from "@/lib/queries/financial-years";
import { validateCreateFinancialYearInput } from "@/lib/validation/financial-years";
import type { CreateFinancialYearInput } from "@/types/financial-years";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const years = await listFinancialYears();
    return NextResponse.json(years);
  } catch (error) {
    console.error("Failed to list financial years:", error);
    return NextResponse.json(
      { error: "Failed to load financial years." },
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
    const body = (await request.json()) as CreateFinancialYearInput;
    const validationError = validateCreateFinancialYearInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const year = await createFinancialYear(body);
    return NextResponse.json(year, { status: 201 });
  } catch (error) {
    if (error instanceof FinancialYearError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to create financial year:", error);
    return NextResponse.json(
      { error: "Failed to create financial year." },
      { status: 500 },
    );
  }
}
