import "server-only";

import type { Session } from "next-auth";
import { NextResponse } from "next/server";
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
  submission: Pick<FormSubmissionListItem, "entityId">,
): Promise<void> {
  const role = session.user?.role;

  if (canReviewSubmissions(role)) {
    return;
  }

  if (!isHeadRole(role)) {
    throw new SubmissionAccessError("Forbidden", 403);
  }

  const headEntityId = session.user?.entityId;
  if (headEntityId == null || !Number.isFinite(headEntityId)) {
    throw new SubmissionAccessError("Forbidden", 403);
  }

  const entities = await listEntities();
  if (!submissionInEntitySubtree(submission, headEntityId, entities)) {
    throw new SubmissionAccessError("Forbidden", 403);
  }
}

export function submissionAccessErrorResponse(
  error: SubmissionAccessError,
): NextResponse {
  return NextResponse.json({ error: error.message }, { status: error.status });
}
