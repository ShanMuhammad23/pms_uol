import "server-only";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { isAdminRole } from "@/lib/auth/submission-review-roles";

export async function requireSuperAdminSession() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  if (!isAdminRole(session.user?.role)) {
    redirect("/dashboard");
  }

  return session;
}

export async function requireSuperAdminApi() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(session.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return session;
}
