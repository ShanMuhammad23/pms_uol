import { getEntityDescendantIds } from "@/app/helpers/dashboard-entity-filters";
import type { EntityRecord } from "@/types/entities";
import type { FormSubmissionListItem } from "@/types/form-submissions";

/** Entity root plus all descendants in the org tree. */
export function getEntitySubtreeIds(
  rootEntityId: number,
  entities: EntityRecord[],
): Set<number> {
  const scope = getEntityDescendantIds(rootEntityId, entities);
  scope.add(rootEntityId);
  return scope;
}

/** Walk parent_entity_id chain upward from the given entity. */
export function getEntityAncestorIds(
  entityId: number,
  entities: EntityRecord[],
): Set<number> {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const ancestors = new Set<number>();
  let current = byId.get(entityId);

  while (current?.parentEntityId != null) {
    ancestors.add(current.parentEntityId);
    current = byId.get(current.parentEntityId);
  }

  return ancestors;
}

/** Ancestors + assigned entity + descendants — for filter dropdowns. */
export function getEntityFilterScopeIds(
  rootEntityId: number,
  entities: EntityRecord[],
): Set<number> {
  const scope = getEntitySubtreeIds(rootEntityId, entities);
  for (const ancestorId of getEntityAncestorIds(rootEntityId, entities)) {
    scope.add(ancestorId);
  }
  return scope;
}

export function filterEntitiesForHeadDashboard(
  entities: EntityRecord[],
  headEntityId: number,
): EntityRecord[] {
  const scope = getEntityFilterScopeIds(headEntityId, entities);
  return entities.filter((entity) => scope.has(entity.id));
}

export function isEntityInSubtree(
  entityId: number | null | undefined,
  rootEntityId: number,
  entities: EntityRecord[],
): boolean {
  if (entityId == null) {
    return false;
  }

  return getEntitySubtreeIds(rootEntityId, entities).has(entityId);
}

export function filterEntitiesToSubtree(
  entities: EntityRecord[],
  rootEntityId: number,
): EntityRecord[] {
  const scope = getEntitySubtreeIds(rootEntityId, entities);
  return entities.filter((entity) => scope.has(entity.id));
}

export function submissionInEntitySubtree(
  submission: Pick<FormSubmissionListItem, "entityId">,
  rootEntityId: number,
  entities: EntityRecord[],
): boolean {
  return isEntityInSubtree(submission.entityId, rootEntityId, entities);
}
