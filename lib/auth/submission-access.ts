import "server-only";

import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import {
  managerCanReviewSubmission,
  toEmployeeManagers,
} from "@/app/helpers/manager-review";
import { submissionInEntitySubtree } from "@/app/helpers/entity-scope";
import { isHeadRole } from "@/lib/auth/home-path";
import {
  canAccessDashboardSubmissions,
  canReviewSubmissions,
} from "@/lib/auth/submission-review-roles";
import { listEntities } from "@/lib/queries/entities";
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

  const managers = toEmployeeManagers(submission);
  const isAssignedManager =
    managers.manager1Id === viewerUserId ||
    managers.manager2Id === viewerUserId;

  const headEntityId = session.user?.entityId;
  const entities = await listEntities();
  const inOrgSubtree =
    headEntityId != null &&
    Number.isFinite(headEntityId) &&
    submissionInEntitySubtree(submission, headEntityId, entities);

  if (!isAssignedManager && !inOrgSubtree) {
    throw new SubmissionAccessError("Forbidden", 403);
  }

  if (
    submission.status === "PENDING_HEAD_REVIEW" &&
    !managerCanReviewSubmission(viewerUserId, submission)
  ) {
    throw new SubmissionAccessError("Forbidden", 403);
  }
}

export function submissionAccessErrorResponse(
  error: SubmissionAccessError,
): NextResponse {
  return NextResponse.json({ error: error.message }, { status: error.status });
}
