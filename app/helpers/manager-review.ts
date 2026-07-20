import type { EntityRecord } from "@/types/entities";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { AppraisalStatus } from "@/types/forms";
import { submissionInEntitySubtree } from "@/app/helpers/entity-scope";

export const MAX_MANAGER_LEVEL = 2;

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

/** Entity whose head should review at the given manager level. */
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

export function hasSecondManagerReview(
  employeeEntityId: number,
  entities: EntityRecord[],
): boolean {
  return findEligibleParentEntity(employeeEntityId, entities) !== null;
}

export function resolveManagerApprovalAdvance(
  currentManagerLevel: number,
  reviewerEntityId: number,
  entities: EntityRecord[],
): { managerLevel: number; status: AppraisalStatus } {
  if (currentManagerLevel >= MAX_MANAGER_LEVEL) {
    return {
      managerLevel: currentManagerLevel,
      status: "PENDING_HR_CALIBRATION",
    };
  }

  const parent = findEligibleParentEntity(reviewerEntityId, entities);
  if (parent) {
    return {
      managerLevel: currentManagerLevel + 1,
      status: "PENDING_HEAD_REVIEW",
    };
  }

  return {
    managerLevel: currentManagerLevel,
    status: "PENDING_HR_CALIBRATION",
  };
}

export function headCanReviewSubmission(
  headEntityId: number,
  submission: Pick<
    FormSubmissionListItem,
    "entityId" | "status" | "managerLevel"
  >,
  entities: EntityRecord[],
): boolean {
  if (submission.status !== "PENDING_HEAD_REVIEW") {
    return false;
  }

  if (submission.entityId == null) {
    return false;
  }

  const managerLevel = submission.managerLevel ?? 1;
  const reviewingEntityId = getReviewingEntityId(
    submission.entityId,
    managerLevel,
    entities,
  );

  return reviewingEntityId === headEntityId;
}

export function submissionVisibleToHead(
  headEntityId: number,
  submission: FormSubmissionListItem,
  entities: EntityRecord[],
): boolean {
  if (!submissionInEntitySubtree(submission, headEntityId, entities)) {
    return false;
  }

  if (submission.status === "PENDING_HEAD_REVIEW") {
    return headCanReviewSubmission(headEntityId, submission, entities);
  }

  return true;
}

export function submissionRequiresSecondManagerReview(
  submission: Pick<FormSubmissionListItem, "entityId" | "parentEntityName">,
  entities?: EntityRecord[],
): boolean {
  if (submission.entityId == null) {
    return false;
  }

  if (entities) {
    return hasSecondManagerReview(submission.entityId, entities);
  }

  return Boolean(submission.parentEntityName);
}
