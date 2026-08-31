import "server-only";

import { getEntitySubtreeIds } from "@/app/helpers/entity-scope";
import { listEntities } from "@/lib/queries/entities";

export async function resolveEntitySubtreeIds(
  rootEntityId: number,
): Promise<number[]> {
  const entities = await listEntities();
  return [...getEntitySubtreeIds(rootEntityId, entities)];
}

/** Union of self + descendants for each selected org root. */
export async function resolveEntitySubtreeIdsForRoots(
  rootEntityIds: number[],
): Promise<number[]> {
  if (rootEntityIds.length === 0) {
    return [];
  }

  const entities = await listEntities();
  const ids = new Set<number>();
  for (const rootId of rootEntityIds) {
    for (const id of getEntitySubtreeIds(rootId, entities)) {
      ids.add(id);
    }
  }
  return [...ids];
}
