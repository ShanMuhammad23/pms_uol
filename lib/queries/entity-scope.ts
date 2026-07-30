import "server-only";

import { getEntitySubtreeIds } from "@/app/helpers/entity-scope";
import { listEntities } from "@/lib/queries/entities";

export async function resolveEntitySubtreeIds(
  rootEntityId: number,
): Promise<number[]> {
  const entities = await listEntities();
  return [...getEntitySubtreeIds(rootEntityId, entities)];
}
