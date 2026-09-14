import { NextResponse } from "next/server";
import {
  requireModuleViewApi,
  requireModuleEditApi,
} from "@/lib/auth/require-module-api";
import {
  CampusError,
  deleteCampus,
  getCampusById,
  updateCampus,
} from "@/lib/queries/campuses";
import type { UpdateCampusInput } from "@/types/campuses";
import { apiHandler } from "@/lib/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = apiHandler(async (_request: Request, context: RouteContext) => {
  const auth = await requireModuleViewApi("ORGANIZATION_LEVELS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const campusId = Number(id);

  if (Number.isNaN(campusId)) {
    return NextResponse.json({ error: "Invalid site id." }, { status: 400 });
  }

  try {
    const campus = await getCampusById(campusId);
    if (!campus) {
      return NextResponse.json({ error: "Site not found." }, { status: 404 });
    }
    return NextResponse.json(campus);
  } catch (error) {
    console.error("Failed to get site:", error);
    return NextResponse.json(
      { error: "Failed to load site." },
      { status: 500 },
    );
  }
});

export const PUT = apiHandler(async (request: Request, context: RouteContext) => {
  const auth = await requireModuleEditApi("ORGANIZATION_LEVELS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const campusId = Number(id);

  if (Number.isNaN(campusId)) {
    return NextResponse.json({ error: "Invalid site id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as UpdateCampusInput;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "Site name is required." },
        { status: 400 },
      );
    }
    if (!code) {
      return NextResponse.json(
        { error: "Site code is required." },
        { status: 400 },
      );
    }

    const campus = await updateCampus(campusId, {
      name,
      code,
      isActive: typeof body.isActive === "boolean" ? body.isActive : true,
    });
    return NextResponse.json(campus);
  } catch (error) {
    if (error instanceof CampusError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    console.error("Failed to update site:", error);
    return NextResponse.json(
      { error: "Failed to update site." },
      { status: 500 },
    );
  }
});

export const DELETE = apiHandler(async (_request: Request, context: RouteContext) => {
  const auth = await requireModuleEditApi("ORGANIZATION_LEVELS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const campusId = Number(id);

  if (Number.isNaN(campusId)) {
    return NextResponse.json({ error: "Invalid site id." }, { status: 400 });
  }

  try {
    await deleteCampus(campusId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CampusError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    console.error("Failed to delete site:", error);
    return NextResponse.json(
      { error: "Failed to delete site." },
      { status: 500 },
    );
  }
});
