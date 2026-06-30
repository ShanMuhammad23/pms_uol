import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin";
import { listDepartments } from "@/lib/queries/users";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const departments = await listDepartments();
    return NextResponse.json(departments);
  } catch (error) {
    console.error("Failed to list departments:", error);
    return NextResponse.json(
      { error: "Failed to load departments." },
      { status: 500 },
    );
  }
}
