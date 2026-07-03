import { NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth/require-session";
import {
  EmployeeFormError,
  listAssignedFormsForUser,
} from "@/lib/queries/employee-forms";

export async function GET() {
  const auth = await requireSessionApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const userId = Number(auth.user?.id);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const forms = await listAssignedFormsForUser(userId);
    return NextResponse.json(forms);
  } catch (error) {
    if (error instanceof EmployeeFormError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Failed to list assigned forms:", error);
    return NextResponse.json(
      { error: "Failed to load assigned forms." },
      { status: 500 },
    );
  }
}
