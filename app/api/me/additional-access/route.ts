import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { getUserAdditionalAccess } from "@/lib/auth/additional-access";

// This route reads the session (cookies) to identify the current user.
// Without force-dynamic, Next.js may statically cache the response at
// build time, causing all users to receive the same stale permissions.
export const dynamic = "force-dynamic";

/**
 * Self-service endpoint: returns the current user's own additional-access
 * permissions. No Super Admin required — a user can always read their own
 * permissions.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  try {
    const permissions = await getUserAdditionalAccess(userId);
    return NextResponse.json({ permissions });
  } catch (error) {
    console.error("Failed to load self additional-access:", error);
    return NextResponse.json(
      { error: "Failed to load permissions." },
      { status: 500 },
    );
  }
}
