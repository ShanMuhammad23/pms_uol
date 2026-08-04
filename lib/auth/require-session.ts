import "server-only";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";

export async function requireSession() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  return session;
}

export async function requireSessionApi() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return session;
}
