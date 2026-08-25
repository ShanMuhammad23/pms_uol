import { NextRequest, NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { listAssignedFormsForEmployeeSap } from "@/lib/queries/employee-assigned-forms";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: NextRequest) => {
  const auth = await requireDashboardSubmissionsApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const employeeId = request.nextUrl.searchParams.get("employeeId")?.trim();
  if (!employeeId) {
    return NextResponse.json(
      { error: "employeeId is required." },
      { status: 400 },
    );
  }

  try {
    const forms = await listAssignedFormsForEmployeeSap(employeeId);
    return NextResponse.json({ employeeId, forms });
  } catch (error) {
    console.error("Failed to load assigned forms:", error);
    return NextResponse.json(
      { error: "Failed to load assigned forms." },
      { status: 500 },
    );
  }
});
