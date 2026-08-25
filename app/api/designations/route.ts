import { NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { listUniqueDesignations } from "@/lib/queries/designations";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const auth = await requireDashboardSubmissionsApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const designations = await listUniqueDesignations();
    return NextResponse.json(designations);
  } catch (error) {
    console.error("Failed to list designations:", error);
    return NextResponse.json(
      { error: "Failed to load designations." },
      { status: 500 },
    );
  }
});
