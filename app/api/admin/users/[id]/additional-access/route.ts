import { NextResponse } from "next/server";
import { requireTrueSuperAdminApi } from "@/lib/auth/require-super-admin";
import {
  getUserAdditionalAccess,
  setUserAdditionalAccess,
} from "@/lib/auth/additional-access";
import {
  isAdditionalAccessLevel,
  isAdditionalAccessModule,
} from "@/types/additional-access";
import type { AdditionalAccessPermission } from "@/types/additional-access";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireTrueSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const userId = Number(id);

  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  try {
    const permissions = await getUserAdditionalAccess(userId);
    return NextResponse.json({ permissions });
  } catch (error) {
    console.error("Failed to load additional access:", error);
    return NextResponse.json(
      { error: "Failed to load additional access." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireTrueSuperAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const userId = Number(id);

  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { permissions: unknown };
    const rawPermissions = body?.permissions;

    if (!Array.isArray(rawPermissions)) {
      return NextResponse.json(
        { error: "permissions array is required." },
        { status: 400 },
      );
    }

    const permissions: AdditionalAccessPermission[] = [];
    for (const item of rawPermissions) {
      if (
        item &&
        typeof item === "object" &&
        "module" in item &&
        "accessLevel" in item &&
        isAdditionalAccessModule(item.module) &&
        isAdditionalAccessLevel(item.accessLevel)
      ) {
        permissions.push({
          module: item.module,
          accessLevel: item.accessLevel,
        });
      }
    }

    await setUserAdditionalAccess(userId, permissions, auth.id);

    return NextResponse.json({ permissions });
  } catch (error) {
    console.error("Failed to update additional access:", error);
    return NextResponse.json(
      { error: "Failed to update additional access." },
      { status: 500 },
    );
  }
}
