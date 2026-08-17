import "server-only";

import { db } from "@/lib/db";
import { listEntities } from "@/lib/queries/entities";
import { getDefaultAppraisalCycle } from "@/lib/queries/appraisal-cycles";
import { getEntitySubtreeIds } from "@/app/helpers/entity-scope";
import type { EntityRecord } from "@/types/entities";

export interface OrgReportNode {
  id: number;
  name: string;
  categoryCode: string;
  parentEntityId: number | null;
  /** Direct staff count (users assigned to this entity). */
  directStaffCount: number;
  /** Subtree staff count (this entity + all descendants). */
  subtreeStaffCount: number;
  /** Forms assigned to employees in this entity's subtree. */
  formsAssigned: number;
  /** Employees who have submitted self-assessment (status >= PENDING_HEAD_REVIEW). */
  selfAssessed: number;
  /** Employees past manager review (status >= PENDING_HR_CALIBRATION). */
  assessedByManagers: number;
  /** Employees past HR alignment (status >= PENDING_BOARD_APPROVAL). */
  hrAlignment: number;
  /** Employees with board approval (status >= APPROVED). */
  boardApproval: number;
  /** Children nodes. */
  children: OrgReportNode[];
}

interface EntityCountRow {
  entity_id: string;
  forms_assigned: string;
  self_assessed: string;
  assessed_by_managers: string;
  hr_alignment: string;
  board_approval: string;
}

/**
 * Aggregate appraisal workflow counts per entity for the current default cycle.
 *
 * For each entity, counts are computed over the entity's *subtree* (the entity
 * itself plus all descendants). This means parent nodes (C0/C1) show rolled-up
 * totals that include all child entities beneath them.
 */
export async function getOrganizationReport(): Promise<OrgReportNode[]> {
  const entities = await listEntities();

  // Get the default appraisal cycle id.
  const defaultCycle = await getDefaultAppraisalCycle();
  const cycleId = defaultCycle?.id ?? null;

  // Aggregate counts per entity using the entity's subtree.
  // We join users → appraisals → employee_form_assignments, grouping by
  // the user's entity_id. The caller will roll these up by subtree.
  const countRows = await db.query<EntityCountRow>(
    `SELECT
       u.entity_id::text AS entity_id,
       COUNT(DISTINCT u.id) AS total_employees,
       COUNT(DISTINCT u.id) FILTER (
         WHERE efa.template_id IS NOT NULL
       ) AS forms_assigned,
       COUNT(DISTINCT ap.id) FILTER (
         WHERE ap.status IN (
           'PENDING_HEAD_REVIEW',
           'PENDING_HR_CALIBRATION',
           'PENDING_BOARD_APPROVAL',
           'APPROVED',
           'COMPLETED'
         )
       ) AS self_assessed,
       COUNT(DISTINCT ap.id) FILTER (
         WHERE ap.status IN (
           'PENDING_HR_CALIBRATION',
           'PENDING_BOARD_APPROVAL',
           'APPROVED',
           'COMPLETED'
         )
       ) AS assessed_by_managers,
       COUNT(DISTINCT ap.id) FILTER (
         WHERE ap.status IN (
           'PENDING_BOARD_APPROVAL',
           'APPROVED',
           'COMPLETED'
         )
       ) AS hr_alignment,
       COUNT(DISTINCT ap.id) FILTER (
         WHERE ap.status IN ('APPROVED', 'COMPLETED')
       ) AS board_approval
     FROM users u
     LEFT JOIN appraisals ap ON ap.employee_id = u.id
       AND ($1::int IS NULL
         OR ap.cycle_id = $1
         OR ($1::int IS NULL AND ap.cycle_id IS NULL))
     LEFT JOIN employee_form_assignments efa ON efa.employee_id = u.id
     WHERE u.is_active = TRUE
       AND u.employee_id <> 'EMP-0001'
       AND u.entity_id IS NOT NULL
     GROUP BY u.entity_id`,
    [cycleId],
  );

  // Build a map of entity_id → counts (direct, not subtree).
  const directCounts = new Map<
    number,
    {
      formsAssigned: number;
      selfAssessed: number;
      assessedByManagers: number;
      hrAlignment: number;
      boardApproval: number;
      directStaffCount: number;
    }
  >();

  for (const row of countRows.rows) {
    const entityId = Number(row.entity_id);
    directCounts.set(entityId, {
      formsAssigned: Number(row.forms_assigned ?? 0),
      selfAssessed: Number(row.self_assessed ?? 0),
      assessedByManagers: Number(row.assessed_by_managers ?? 0),
      hrAlignment: Number(row.hr_alignment ?? 0),
      boardApproval: Number(row.board_approval ?? 0),
      directStaffCount: 0, // filled from entities
    });
  }

  // Build the tree structure.
  const byId = new Map<number, OrgReportNode>();
  for (const entity of entities) {
    const counts = directCounts.get(entity.id);
    byId.set(entity.id, {
      id: entity.id,
      name: entity.name,
      categoryCode: entity.categoryCode,
      parentEntityId: entity.parentEntityId,
      directStaffCount: entity.staffCount,
      subtreeStaffCount: 0,
      formsAssigned: 0,
      selfAssessed: 0,
      assessedByManagers: 0,
      hrAlignment: 0,
      boardApproval: 0,
      children: [],
    });
  }

  // Link children to parents.
  for (const node of byId.values()) {
    if (node.categoryCode === "C0") continue;
    if (
      node.parentEntityId != null &&
      byId.has(node.parentEntityId) &&
      node.parentEntityId !== node.id
    ) {
      byId.get(node.parentEntityId)!.children.push(node);
    }
  }

  // Roll up subtree counts: for each entity, sum direct counts of all
  // entities in its subtree (including itself).
  for (const entity of entities) {
    const subtreeIds = getEntitySubtreeIds(entity.id, entities);
    let formsAssigned = 0;
    let selfAssessed = 0;
    let assessedByManagers = 0;
    let hrAlignment = 0;
    let boardApproval = 0;
    let subtreeStaffCount = 0;

    for (const subId of subtreeIds) {
      const subCounts = directCounts.get(subId);
      const subEntity = byId.get(subId);
      if (subCounts) {
        formsAssigned += subCounts.formsAssigned;
        selfAssessed += subCounts.selfAssessed;
        assessedByManagers += subCounts.assessedByManagers;
        hrAlignment += subCounts.hrAlignment;
        boardApproval += subCounts.boardApproval;
      }
      if (subEntity) {
        subtreeStaffCount += subEntity.directStaffCount;
      }
    }

    const node = byId.get(entity.id);
    if (node) {
      node.formsAssigned = formsAssigned;
      node.selfAssessed = selfAssessed;
      node.assessedByManagers = assessedByManagers;
      node.hrAlignment = hrAlignment;
      node.boardApproval = boardApproval;
      node.subtreeStaffCount = subtreeStaffCount;
    }
  }

  // Sort children and return roots (C0 entities or entities without parents).
  const CATEGORY_RANK: Record<string, number> = {
    C0: 0,
    C1: 1,
    C2: 2,
    C3: 3,
  };

  const compareNodes = (a: OrgReportNode, b: OrgReportNode): number => {
    const rankA = CATEGORY_RANK[a.categoryCode] ?? 99;
    const rankB = CATEGORY_RANK[b.categoryCode] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  };

  const sortNodes = (nodes: OrgReportNode[]) => {
    nodes.sort(compareNodes);
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };

  const roots = [...byId.values()].filter((node) => {
    if (node.categoryCode === "C0") return true;
    return node.parentEntityId == null || !byId.has(node.parentEntityId);
  });

  sortNodes(roots);
  return roots;
}
