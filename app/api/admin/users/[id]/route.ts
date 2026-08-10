import { NextResponse } from "next/server";
import {
  requireModuleViewApi,
  requireModuleEditApi,
} from "@/lib/auth/require-module-api";
import {
  deleteUser,
  getUserById,
  updateUser,
  UserError,
} from "@/lib/queries/users";
import { validateUpdateUserInput } from "@/lib/validation/users";
import type { UpdateUserInput } from "@/types/users";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireModuleViewApi("USERS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const userId = Number(id);

  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  try {
    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Failed to get user:", error);
    return NextResponse.json(
      { error: "Failed to load user." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireModuleEditApi("USERS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const userId = Number(id);

  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as UpdateUserInput;
    const validationError = validateUpdateUserInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const user = await updateUser(userId, body);
    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to update user:", error);
    return NextResponse.json(
      { error: "Failed to update user." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireModuleEditApi("USERS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const userId = Number(id);

  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  if (auth.user?.id && Number(auth.user.id) === userId) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 },
    );
  }

  try {
    await deleteUser(userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to delete user:", error);
    return NextResponse.json(
      { error: "Failed to delete user." },
      { status: 500 },
    );
  }
}
