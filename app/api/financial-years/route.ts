import { NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { listFinancialYears } from "@/lib/queries/financial-years";

export const dynamic = "force-dynamic";

export async function GET() {
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
}
