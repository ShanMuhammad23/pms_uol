import { NextResponse } from "next/server";
import { requireModuleViewApi } from "@/lib/auth/require-module-api";
import { listEntitiesForUsers } from "@/lib/queries/users";

export async function GET() {
  const auth = await requireModuleViewApi("ORGANIZATION_LEVELS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const entities = await listEntitiesForUsers();
    return NextResponse.json(entities);
  } catch (error) {
    console.error("Failed to list entities:", error);
    return NextResponse.json(
      { error: "Failed to load entities." },
      { status: 500 },
    );
  }
}
