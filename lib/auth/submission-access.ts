import "server-only";

import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { isAssignedReportingManager } from "@/app/helpers/manager-review";
import { isHeadRole } from "@/lib/auth/home-path";
import {
  canAccessDashboardSubmissions,
  canReviewSubmissions,
} from "@/lib/auth/submission-review-roles";
import type { FormSubmissionListItem } from "@/types/form-submissions";

export class SubmissionAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "SubmissionAccessError";
    this.status = status;
  }
}

export function canOpenSubmissionDetail(role: string | undefined): boolean {
  return canAccessDashboardSubmissions(role);
}

export async function assertSubmissionAccessible(
  session: Session,
  submission: Pick<
    FormSubmissionListItem,
    | "entityId"
    | "status"
    | "managerLevel"
    | "manager1UserId"
    | "manager2UserId"
  >,
): Promise<void> {
  const role = session.user?.role;

  if (canReviewSubmissions(role)) {
    return;
  }

  if (!isHeadRole(role)) {
    throw new SubmissionAccessError("Forbidden", 403);
  }

  const viewerUserId = session.user?.id ? Number(session.user.id) : null;
  if (viewerUserId == null || !Number.isFinite(viewerUserId)) {
    throw new SubmissionAccessError("Forbidden", 403);
  }

  if (!isAssignedReportingManager(viewerUserId, submission)) {
    throw new SubmissionAccessError("Forbidden", 403);
  }
}

export function submissionAccessErrorResponse(
  error: SubmissionAccessError,
): NextResponse {
  return NextResponse.json({ error: error.message }, { status: error.status });
}
