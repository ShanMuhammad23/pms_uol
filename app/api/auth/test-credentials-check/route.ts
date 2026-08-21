import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/queries/auth";
import { isSystemRole } from "@/lib/auth/roles";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

/**
 * Pre-check endpoint for the test-credentials login flow.
 *
 * NextAuth's Credentials provider always returns "CredentialsSignin" for any
 * authorize() failure, so the client cannot distinguish between "user not
 * found", "account inactive", "invalid role", and "wrong password". This
 * endpoint performs the same checks as authorize() (including the bcrypt
 * password comparison) and returns a specific error code so the UI can show
 * a clear, actionable message.
 */
export const POST = apiHandler(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const email = body?.email?.toString().trim() ?? "";
  const password = body?.password?.toString() ?? "";

  if (!email) {
    return NextResponse.json(
      { ok: false, error: "MissingEmail" },
      { status: 400 },
    );
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return NextResponse.json(
      { ok: false, error: "InvalidEmail" },
      { status: 400 },
    );
  }

  if (!password) {
    return NextResponse.json(
      { ok: false, error: "MissingPassword" },
      { status: 400 },
    );
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: "UserNotFound",
        message: `No account found with the email "${email}". Please check the email or contact HR to provision your account.`,
      },
      { status: 404 },
    );
  }

  if (!user.isActive) {
    return NextResponse.json(
      {
        ok: false,
        error: "AccountInactive",
        message: `Your account (${email}) is currently inactive. Please contact HR at pms@hrd.uol.edu.pk to reactivate it.`,
      },
      { status: 403 },
    );
  }

  if (!isSystemRole(user.systemRole)) {
    return NextResponse.json(
      {
        ok: false,
        error: "InvalidRole",
        message: `Your account has an unrecognized role ("${user.systemRole}"). Please contact HR to fix your account configuration.`,
      },
      { status: 403 },
    );
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return NextResponse.json(
      {
        ok: false,
        error: "InvalidPassword",
        message: "Incorrect password. Please check your password and try again.",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
});
