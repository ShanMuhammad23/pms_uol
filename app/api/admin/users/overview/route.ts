import { NextResponse } from "next/server";
import { requireModuleViewApi } from "@/lib/auth/require-module-api";
import { listUsersOverview } from "@/lib/queries/users";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireModuleViewApi("USERS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const users = await listUsersOverview();
    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to load users overview:", error);
    return NextResponse.json(
      { error: "Failed to load users overview." },
      { status: 500 },
    );
  }
}
