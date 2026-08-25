import { NextResponse } from "next/server";
import { ROLE_PERMISSION_SETS } from "@/lib/auth/roles";
import { withAuth } from "@/lib/auth/with-auth";
import {
  InstitutionalQuotaError,
  listInstitutionalQuotaChartRows,
  listInstitutionalQuotaChartRowsForActiveYear,
} from "@/lib/queries/institutional-quotas";
import { apiHandler } from "@/lib/api-handler";

/**
 * Dashboard chart endpoint: institutional quota rows.
 * Restricted to dashboard roles (not EMPLOYEE).
 */
export const GET = apiHandler(withAuth(
  async (request) => {
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
      console.error("Failed to load institutional quotas:", error);
      return NextResponse.json(
        { error: "Failed to load institutional quotas." },
        { status: 500 },
      );
    }
  },
  { roles: ROLE_PERMISSION_SETS.dashboard },
));
