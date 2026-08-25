import { NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { listFinancialYears } from "@/lib/queries/financial-years";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const auth = await requireDashboardSubmissionsApi();
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
});
