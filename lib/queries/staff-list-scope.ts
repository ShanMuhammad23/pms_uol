/**
 * Shared SQL visibility for staff listing / dashboard overview.
 * Includes org subtree and/or employees where the viewer is Manager 1 or 2.
 */

export type StaffListScope = {
  scopedEntityIds?: number[];
  managedByUserId?: number | null;
};

/**
 * Builds a WHERE fragment after `$1` (cycle id).
 * Returns additional bind params in order.
 */
export function appendStaffVisibilityClause(
  options: StaffListScope | undefined,
  startParamIndex = 2,
): { clause: string; params: unknown[] } {
  const entityIds = options?.scopedEntityIds;
  const managerId =
    options?.managedByUserId != null && Number.isFinite(options.managedByUserId)
      ? Number(options.managedByUserId)
      : null;

  if (entityIds != null && managerId != null) {
    if (entityIds.length === 0) {
      return {
        clause: `AND (u.head_id = $${startParamIndex} OR u.manager_2_id = $${startParamIndex})`,
        params: [managerId],
      };
    }

    return {
      clause: `AND (
        u.entity_id = ANY($${startParamIndex}::bigint[])
        OR u.head_id = $${startParamIndex + 1}
        OR u.manager_2_id = $${startParamIndex + 1}
      )`,
      params: [entityIds, managerId],
    };
  }

  if (entityIds != null) {
    if (entityIds.length === 0) {
      return { clause: "AND FALSE", params: [] };
    }

    return {
      clause: `AND u.entity_id = ANY($${startParamIndex}::bigint[])`,
      params: [entityIds],
    };
  }

  if (managerId != null) {
    return {
      clause: `AND (u.head_id = $${startParamIndex} OR u.manager_2_id = $${startParamIndex})`,
      params: [managerId],
    };
  }

  return { clause: "", params: [] };
}
