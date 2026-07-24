import type { EntityRecord } from "@/types/entities";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { AppraisalStatus } from "@/types/forms";
import { submissionInEntitySubtree } from "@/app/helpers/entity-scope";

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

  const managers = toEmployeeManagers(submission);
  const reviewingManagerId = getReviewingManagerUserId(
    managers,
    submission.managerLevel ?? 1,
  );

  return (
    reviewingManagerId != null && reviewingManagerId === reviewerUserId
  );
}

/**
 * HEAD listing visibility:
 * - org subtree staff (dashboard context), or
 * - staff where the viewer is assigned as Manager 1 or 2
 * Pending reviews are limited to forms the viewer can actually approve.
 */
export function submissionVisibleToHead(
  viewerUserId: number,
  viewerEntityId: number | null,
  submission: FormSubmissionListItem,
  entities: EntityRecord[],
): boolean {
  const managers = toEmployeeManagers(submission);
  const isAssignedManager =
    managers.manager1Id === viewerUserId ||
    managers.manager2Id === viewerUserId;

  const inOrgSubtree =
    viewerEntityId != null &&
    submissionInEntitySubtree(submission, viewerEntityId, entities);

  if (!isAssignedManager && !inOrgSubtree) {
    return false;
  }

  if (submission.status === "PENDING_HEAD_REVIEW") {
    if (isAssignedManager) return true;
    return managerCanReviewSubmission(viewerUserId, submission);
  }

  return true;
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
