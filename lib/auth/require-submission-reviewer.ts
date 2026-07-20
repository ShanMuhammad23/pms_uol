import "server-only";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { canOpenSubmissionDetail } from "@/lib/auth/submission-access";
import { canReviewSubmissions } from "@/lib/auth/submission-review-roles";

export async function requireSubmissionReviewerSession() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  if (!canReviewSubmissions(session.user?.role)) {
    redirect("/dashboard");
  }

  return session;
}

/** Dashboard + HEAD: open submission detail within role scope. */
export async function requireSubmissionAccessSession() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  if (!canOpenSubmissionDetail(session.user?.role)) {
    redirect("/dashboard");
  }

  return session;
}

export async function requireSubmissionReviewerApi() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canReviewSubmissions(session.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return session;
}

export async function requireSubmissionAccessApi() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canOpenSubmissionDetail(session.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return session;
}
