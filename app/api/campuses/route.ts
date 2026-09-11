import { NextRequest, NextResponse } from "next/server";
import { requireModuleViewApi } from "@/lib/auth/require-module-api";
import { listActiveCampuses, createCampus, CampusError } from "@/lib/queries/campuses";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const auth = await requireModuleViewApi("USERS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const campuses = await listActiveCampuses();
    return NextResponse.json(campuses);
  } catch (error) {
    console.error("Failed to list campuses:", error);
    return NextResponse.json(
      { error: "Failed to load campuses." },
      { status: 500 },
    );
  }
});

export const POST = apiHandler(async (request: NextRequest) => {
  const auth = await requireModuleViewApi("ORGANIZATION_LEVELS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "Campus name is required." },
        { status: 400 },
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: "Campus code is required." },
        { status: 400 },
      );
    }

    const campus = await createCampus({ name, code, isActive: true });
    return NextResponse.json(campus, { status: 201 });
  } catch (error) {
    if (error instanceof CampusError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    console.error("Failed to create campus:", error);
    return NextResponse.json(
      { error: "Failed to create campus." },
      { status: 500 },
    );
  }
});
