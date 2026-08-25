import { NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import {
  getPerformanceMatrixByFinancialYearId,
  listPerformanceMatrixLabelsByFinancialYearId,
} from "@/lib/queries/performance-levels";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: Request) => {
  const auth = await requireDashboardSubmissionsApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const financialYearId = Number(searchParams.get("financialYearId"));
  const matrixLabel = searchParams.get("matrixLabel")?.trim();
  const labelsOnly = searchParams.get("labelsOnly") === "1";

  if (Number.isNaN(financialYearId) || financialYearId <= 0) {
    return NextResponse.json(
      { error: "financialYearId is required." },
      { status: 400 },
    );
  }

  try {
    if (labelsOnly) {
      const labels =
        await listPerformanceMatrixLabelsByFinancialYearId(financialYearId);
      return NextResponse.json(labels);
    }

    const matrix = await getPerformanceMatrixByFinancialYearId(
      financialYearId,
      matrixLabel || undefined,
    );
    return NextResponse.json(matrix);
  } catch (error) {
    console.error("Failed to load performance matrix:", error);
    return NextResponse.json(
      { error: "Failed to load performance matrix." },
      { status: 500 },
    );
  }
});
