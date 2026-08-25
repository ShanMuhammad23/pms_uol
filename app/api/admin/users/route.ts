import { NextRequest, NextResponse } from "next/server";
import {
  requireModuleViewApi,
  requireModuleEditApi,
} from "@/lib/auth/require-module-api";
import { createUser, listUsers, listUsersByEmployeeIds, UserError } from "@/lib/queries/users";
import { validateCreateUserInput } from "@/lib/validation/users";
import type { CreateUserInput } from "@/types/users";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_EMPLOYEE_IDS = 200;

export const GET = apiHandler(async (request: NextRequest) => {
  const auth = await requireModuleViewApi("USERS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const employeeIdsParam = request.nextUrl.searchParams.get("employeeIds");

    if (employeeIdsParam != null && employeeIdsParam.length > 0) {
      const employeeIds = employeeIdsParam
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, MAX_EMPLOYEE_IDS);

      const users = await listUsersByEmployeeIds(employeeIds);
      return NextResponse.json(users);
    }

    const users = await listUsers();
    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to list users:", error);
    return NextResponse.json(
      { error: "Failed to load users." },
      { status: 500 },
    );
  }
});

export const POST = apiHandler(async (request: Request) => {
  const auth = await requireModuleEditApi("USERS");
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as CreateUserInput;
    const validationError = validateCreateUserInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const user = await createUser(body);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to create user:", error);
    return NextResponse.json(
      { error: "Failed to create user." },
      { status: 500 },
    );
  }
});
