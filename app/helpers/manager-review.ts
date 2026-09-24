import type { EntityRecord } from "@/types/entities";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { AppraisalStatus } from "@/types/forms";

export const MAX_MANAGER_LEVEL = 2;

/** Per-employee manager assignment used for appraisal review routing. */
export type EmployeeManagers = {
  manager1Id: number | null;
  manager2Id: number | null;
};

export function toEmployeeManagers(input: {
  manager1UserId?: number | null;
  manager2UserId?: number | null;
  headId?: number | null;
  manager2Id?: number | null;
}): EmployeeManagers {
  return {
    manager1Id: input.manager1UserId ?? input.headId ?? null,
    manager2Id: input.manager2UserId ?? input.manager2Id ?? null,
  };
}

/** Manager user id responsible for the given appraisal manager_level. */
export function getReviewingManagerUserId(
  managers: EmployeeManagers,
  managerLevel: number,
): number | null {
  if (managerLevel <= 1) {
    return managers.manager1Id;
  }
  if (managerLevel === 2) {
    return managers.manager2Id;
  }
  return null;
}

export function hasSecondManagerReview(managers: EmployeeManagers): boolean {
  return managers.manager2Id != null;
}

/**
 * Decide the next workflow status after an employee submits their
 * self-assessment.
 *
 * Always PENDING_HEAD_REVIEW at level 1 — the Manager Review stage is never
 * bypassed. When the employee has no Manager 1 assigned, the submission is
 * held at level 1 with no eligible reviewer (flagged "Awaiting Manager" only
 * when both managers are missing — see isAwaitingManagerAssignment); it
 * self-heals the moment HR assigns a Manager 1, appearing in that manager's
 * queue without a Return action.
 *
 * This is the SINGLE SOURCE OF TRUTH for the self-assessment → next stage
 * transition. All callers must use this function instead of hardcoding the
 * status.
 */
export function resolveSelfAssessmentAdvance(): {
  managerLevel: number;
  status: AppraisalStatus;
} {
  return {
    managerLevel: 1,
    status: "PENDING_HEAD_REVIEW",
  };
}

/**
 * True when a submission is parked at Manager Review but the employee has no
 * managers assigned at all — neither Manager 1 nor Manager 2 — so nobody can
 * review it until HR assigns one. Used to flag "awaiting manager assignment"
 * rows in the staff listing. Rows in this state self-heal once a manager is
 * assigned.
 *
 * Only the both-missing case is flagged: a missing reviewer for the current
 * level alone does not mark the row (e.g. level-2 submissions release to HR
 * Alignment when Manager 2 is removed — see releaseAwaitingManager2Reviews).
 */
export function isAwaitingManagerAssignment(
  submission: Pick<
    FormSubmissionListItem,
    "status" | "managerLevel" | "manager1UserId" | "manager2UserId"
  >,
): boolean {
  if (submission.status !== "PENDING_HEAD_REVIEW") {
    return false;
  }
  const managers = toEmployeeManagers(submission);
  return managers.manager1Id == null && managers.manager2Id == null;
}

/**
 * After a manager approves at `currentManagerLevel`, decide next status/level.
 * Level 2 is used only when the employee has an assigned Manager 2.
 */
export function resolveManagerApprovalAdvance(
  currentManagerLevel: number,
  managers: EmployeeManagers,
): { managerLevel: number; status: AppraisalStatus } {
  if (currentManagerLevel >= MAX_MANAGER_LEVEL) {
    return {
      managerLevel: currentManagerLevel,
      status: "PENDING_HR_CALIBRATION",
    };
  }

  if (currentManagerLevel === 1 && managers.manager2Id != null) {
    return {
      managerLevel: 2,
      status: "PENDING_HEAD_REVIEW",
    };
  }

  return {
    managerLevel: currentManagerLevel,
    status: "PENDING_HR_CALIBRATION",
  };
}

export function managerCanReviewSubmission(
  reviewerUserId: number,
  submission: Pick<
    FormSubmissionListItem,
    "status" | "managerLevel" | "manager1UserId" | "manager2UserId"
  >,
): boolean {
  if (submission.status !== "PENDING_HEAD_REVIEW") {
    return false;
  }

  return isAssignedManagerAtLevel(
    reviewerUserId,
    submission,
    submission.managerLevel ?? 1,
  );
}

/**
 * Check if a user is the assigned manager for a specific manager level,
 * regardless of their system role. This separates "system role permission"
 * from "assessment assignment permission" — an HR/Board/SuperAdmin user who
 * is assigned as Manager 1 or Manager 2 for an employee is considered the
 * assigned manager at that level.
 *
 * Unlike `managerCanReviewSubmission`, this does NOT check the workflow
 * status — it only checks the person-based assignment.
 */
export function isAssignedManagerAtLevel(
  reviewerUserId: number | null,
  submission: Pick<
    FormSubmissionListItem,
    "manager1UserId" | "manager2UserId"
  >,
  managerLevel: number,
): boolean {
  if (reviewerUserId == null || !Number.isFinite(reviewerUserId)) {
    return false;
  }

  const managers = toEmployeeManagers(submission);
  const assignedManagerId = getReviewingManagerUserId(managers, managerLevel);

  return assignedManagerId != null && assignedManagerId === reviewerUserId;
}

/**
 * True when the viewer is this employee's Manager 1 or Manager 2.
 * Manager dashboards list and count only these people — never org-subtree staff.
 */
export function isAssignedReportingManager(
  viewerUserId: number,
  submission: Pick<
    FormSubmissionListItem,
    "manager1UserId" | "manager2UserId"
  >,
): boolean {
  const managers = toEmployeeManagers(submission);
  return (
    managers.manager1Id === viewerUserId ||
    managers.manager2Id === viewerUserId
  );
}

/**
 * HEAD listing visibility: staff where the viewer is assigned as Manager 1 or 2.
 */
export function submissionVisibleToHead(
  viewerUserId: number,
  submission: Pick<
    FormSubmissionListItem,
    "manager1UserId" | "manager2UserId"
  >,
): boolean {
  return isAssignedReportingManager(viewerUserId, submission);
}

export function submissionRequiresSecondManagerReview(
  submission: Pick<FormSubmissionListItem, "manager2UserId">,
): boolean {
  return submission.manager2UserId != null;
}

/* -------------------------------------------------------------------------- */
/* Legacy entity helpers (org structure / reporting displays — not review routing) */
/* -------------------------------------------------------------------------- */

/** C0 nodes are skipped when walking the parent chain (stop at C1). */
export function isIgnoredEntityCategory(categoryCode: string): boolean {
  return categoryCode === "C0";
}

/** Walk up from entityId and return the first parent that is not C0. */
export function findEligibleParentEntity(
  entityId: number,
  entities: EntityRecord[],
): EntityRecord | null {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const current = byId.get(entityId);
  if (!current?.parentEntityId) {
    return null;
  }

  let parentId: number | null = current.parentEntityId;
  while (parentId != null) {
    const parent = byId.get(parentId);
    if (!parent) {
      return null;
    }
    if (!isIgnoredEntityCategory(parent.categoryCode)) {
      return parent;
    }
    parentId = parent.parentEntityId;
  }

  return null;
}

/**
 * @deprecated Prefer getReviewingManagerUserId — review routing is person-based.
 * Kept for org-structure utilities / SUPER_ADMIN fallbacks.
 */
export function getReviewingEntityId(
  employeeEntityId: number,
  managerLevel: number,
  entities: EntityRecord[],
): number | null {
  if (managerLevel <= 1) {
    return employeeEntityId;
  }

  let entityId = employeeEntityId;
  for (let level = 1; level < managerLevel; level += 1) {
    const parent = findEligibleParentEntity(entityId, entities);
    if (!parent) {
      return null;
    }
    entityId = parent.id;
  }

  return entityId;
}

/**
 * @deprecated Prefer managerCanReviewSubmission.
 */
export function headCanReviewSubmission(
  headEntityId: number,
  submission: Pick<
    FormSubmissionListItem,
    "entityId" | "status" | "managerLevel" | "manager1UserId" | "manager2UserId"
  >,
  entities: EntityRecord[],
  reviewerUserId?: number,
): boolean {
  if (reviewerUserId != null) {
    return managerCanReviewSubmission(reviewerUserId, submission);
  }

  // Legacy entity-based check when only entity id is available.
  if (submission.status !== "PENDING_HEAD_REVIEW") {
    return false;
  }
  if (submission.entityId == null) {
    return false;
  }
  const reviewingEntityId = getReviewingEntityId(
    submission.entityId,
    submission.managerLevel ?? 1,
    entities,
  );
  return reviewingEntityId === headEntityId;
}
