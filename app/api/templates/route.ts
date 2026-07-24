import { NextResponse } from "next/server";
import { requireDashboardSubmissionsApi } from "@/lib/auth/require-dashboard-submissions";
import { listFormTemplates } from "@/lib/queries/forms";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireDashboardSubmissionsApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const templates = await listFormTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to list form templates:", error);
    return NextResponse.json(
      { error: "Failed to load form templates." },
      { status: 500 },
    );
  }
}
