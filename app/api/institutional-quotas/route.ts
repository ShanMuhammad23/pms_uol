import { NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth/require-session";
import {
  InstitutionalQuotaError,
  listInstitutionalQuotaChartRows,
  listInstitutionalQuotaChartRowsForActiveYear,
} from "@/lib/queries/institutional-quotas";

/**
 * Dashboard chart endpoint: returns institutional quota rows from DB.
 * GET /api/institutional-quotas?financialYearId=123
 * GET /api/institutional-quotas   (active financial year)
 */
export async function GET(request: Request) {
  const auth = await requireSessionApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { searchParams } = new URL(request.url);
    const financialYearIdParam = searchParams.get("financialYearId");

    if (!financialYearIdParam) {
      const result = await listInstitutionalQuotaChartRowsForActiveYear();
      return NextResponse.json(result.rows);
    }

    const financialYearId = Number(financialYearIdParam);
    if (!Number.isInteger(financialYearId) || financialYearId <= 0) {
      return NextResponse.json(
        { error: "financialYearId must be a positive integer." },
        { status: 400 },
      );
    }

    const rows = await listInstitutionalQuotaChartRows(financialYearId);
    return NextResponse.json(rows);
  } catch (error) {
    if (error instanceof InstitutionalQuotaError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to load institutional quota chart rows:", error);
    return NextResponse.json(
      { error: "Failed to load institutional quotas." },
      { status: 500 },
    );
  }
}
