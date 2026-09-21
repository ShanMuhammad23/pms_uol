import type { EntityRecord } from "@/types/entities";
import type { UserRecord } from "@/types/users";

/** Resolved org-hierarchy values for one user. */
export type UserOrgFilterValues = {
  site: string;
  orgLevel1: string;
  orgLevel2: string;
};

const EMPTY_ORG_VALUES: UserOrgFilterValues = {
  site: "—",
  orgLevel1: "—",
  orgLevel2: "—",
};

/**
 * Resolve each user's org-hierarchy values by walking their entity's ancestor
 * chain: Site = the campus on the nearest ancestor carrying one, Org Level 1/2
 * = the names of the C1/C2 entities in the chain (or self). Keyed by
 * employeeId for use in table filters.
 */
export function buildUserOrgFilterLookup(
  users: UserRecord[],
  entities: EntityRecord[],
): Map<string, UserOrgFilterValues> {
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const lookup = new Map<string, UserOrgFilterValues>();

  for (const user of users) {
    const values = { ...EMPTY_ORG_VALUES };
    let current =
      user.entityId != null ? entityById.get(user.entityId) : undefined;
    let depth = 0;
    while (current && depth < 10) {
      if (values.site === "—" && current.campusName) {
        values.site = current.campusName;
      }
      if (values.orgLevel1 === "—" && current.categoryCode === "C1") {
        values.orgLevel1 = current.name;
      }
      if (values.orgLevel2 === "—" && current.categoryCode === "C2") {
        values.orgLevel2 = current.name;
      }
      current =
        current.parentEntityId != null
          ? entityById.get(current.parentEntityId)
          : undefined;
      depth += 1;
    }
    lookup.set(user.employeeId, values);
  }

  return lookup;
}
