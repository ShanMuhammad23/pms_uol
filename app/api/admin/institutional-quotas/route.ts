import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import {
  InstitutionalQuotaError,
  listInstitutionalQuotas,
  upsertInstitutionalQuotas,
} from "@/lib/queries/institutional-quotas";
import { validateUpsertInstitutionalQuotasInput } from "@/lib/validation/institutional-quotas";
import type { UpsertInstitutionalQuotasInput } from "@/types/institutional-quotas";

export async function GET(request: Request) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { searchParams } = new URL(request.url);
    const financialYearId = Number(searchParams.get("financialYearId"));

    if (!Number.isInteger(financialYearId) || financialYearId <= 0) {
      return NextResponse.json(
        { error: "financialYearId query parameter is required." },
        { status: 400 },
      );
    }

    const quotas = await listInstitutionalQuotas(financialYearId);
    return NextResponse.json(quotas);
  } catch (error) {
    if (error instanceof InstitutionalQuotaError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to list quotas:", error);
    return NextResponse.json(
      { error: "Failed to load quotas." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as UpsertInstitutionalQuotasInput;
    const validationError = validateUpsertInstitutionalQuotasInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const quotas = await upsertInstitutionalQuotas(body);
    return NextResponse.json(quotas);
  } catch (error) {
    if (error instanceof InstitutionalQuotaError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to save quotas:", error);
    return NextResponse.json(
      { error: "Failed to save quotas." },
      { status: 500 },
    );
  }
}
