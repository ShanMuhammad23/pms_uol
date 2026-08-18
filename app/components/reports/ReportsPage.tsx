"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  FileBarChart,
  Loader2,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  fetchOrganizationReport,
  type OrgReportNode,
} from "@/lib/queries/organization-report-client";
import { fetchDashboardEntities } from "@/lib/queries/entities-client";
import { queryKeys } from "@/app/queries/keys";
import { MultiSelectFilterDropdown } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import type { EntityRecord } from "@/types/entities";
import { cn } from "@/lib/utils";

const CATEGORY_RANK: Record<string, number> = {
  C0: 0,
  C1: 1,
  C2: 2,
  C3: 3,
};

const CATEGORY_BADGE: Record<string, string> = {
  C0: "bg-slate-900 text-white dark:bg-slate-700",
  C1: "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
  C2: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  C3: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
};

/** Row background tints matching the category badge palette. */
const CATEGORY_ROW_TINT: Record<string, string> = {
  C0: "bg-slate-200 dark:bg-slate-700/60",
  C1: "bg-violet-100 dark:bg-violet-900/40",
  C2: "bg-sky-100 dark:bg-sky-900/40",
  C3: "bg-emerald-100 dark:bg-emerald-900/40",
};

/** Filter levels for cascading dropdowns. */
const FILTER_LEVELS = [
  { categoryCode: "C0", label: "ORG Level 0" },
  { categoryCode: "C1", label: "ORG Level 1" },
  { categoryCode: "C2", label: "ORG Level 2" },
  { categoryCode: "C3", label: "ORG Level 3" },
] as const;

/** Collect all expandable node ids (any node with children). */
function collectExpandableIds(nodes: OrgReportNode[]): Set<number> {
  const ids = new Set<number>();
  const walk = (list: OrgReportNode[]) => {
    for (const node of list) {
      if (node.children.length > 0) {
        ids.add(node.id);
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return ids;
}

/** Get entities of a given category code, optionally filtered by parent ids. */
function getEntitiesForLevel(
  entities: EntityRecord[],
  categoryCode: string,
  parentIds: number[] | null,
): EntityRecord[] {
  const filtered = entities.filter((e) => e.categoryCode === categoryCode);
  if (parentIds === null) return filtered;
  if (parentIds.length === 0) return [];
  const parentSet = new Set(parentIds);
  return filtered.filter((e) => e.parentEntityId != null && parentSet.has(e.parentEntityId));
}

/** Build MultiSelectOption[] from entity records. */
function toOptions(entities: EntityRecord[]): MultiSelectOption[] {
  return entities.map((e) => ({
    value: String(e.id),
    label: e.name,
    count: e.staffCount,
  }));
}

/**
 * Collect all entity ids that should be visible given the filter selections.
 * For each level, if a selection is made, include those entities + all their
 * descendants + all their ancestors (so the tree path is preserved).
 */
function getVisibleEntityIds(
  entities: EntityRecord[],
  selections: Record<string, number[] | null>,
): Set<number> | null {
  const hasAnyFilter = FILTER_LEVELS.some(
    (lvl) => selections[lvl.categoryCode] !== null,
  );
  if (!hasAnyFilter) return null; // null = show all

  const byId = new Map(entities.map((e) => [e.id, e]));
  const childrenByParent = new Map<number, number[]>();
  for (const e of entities) {
    if (e.parentEntityId != null) {
      const siblings = childrenByParent.get(e.parentEntityId) ?? [];
      siblings.push(e.id);
      childrenByParent.set(e.parentEntityId, siblings);
    }
  }

  // Collect the "seed" ids — the deepest level that has a selection.
  // Then expand to include all descendants and ancestors.
  const visible = new Set<number>();

  // Add all selected entities at every level.
  for (const lvl of FILTER_LEVELS) {
    const sel = selections[lvl.categoryCode];
    if (sel !== null && sel.length > 0) {
      for (const id of sel) {
        visible.add(id);
      }
    }
  }

  // Expand descendants from all visible ids.
  const addDescendants = (id: number) => {
    const children = childrenByParent.get(id);
    if (children) {
      for (const childId of children) {
        if (!visible.has(childId)) {
          visible.add(childId);
          addDescendants(childId);
        }
      }
    }
  };

  // Add ancestors from all visible ids.
  const addAncestors = (id: number) => {
    const entity = byId.get(id);
    if (entity?.parentEntityId != null) {
      if (!visible.has(entity.parentEntityId)) {
        visible.add(entity.parentEntityId);
        addAncestors(entity.parentEntityId);
      }
    }
  };

  const seedIds = [...visible];
  for (const id of seedIds) {
    addDescendants(id);
    addAncestors(id);
  }

  return visible;
}

/** Prune the report tree to only include visible entity ids. */
function pruneTree(
  nodes: OrgReportNode[],
  visibleIds: Set<number> | null,
): OrgReportNode[] {
  if (visibleIds === null) return nodes;

  const pruneNode = (node: OrgReportNode): OrgReportNode | null => {
    if (!visibleIds.has(node.id)) return null;
    const prunedChildren = node.children
      .map((child) => pruneNode(child))
      .filter((child): child is OrgReportNode => child !== null);
    return { ...node, children: prunedChildren };
  };

  return nodes
    .map((node) => pruneNode(node))
    .filter((node): node is OrgReportNode => node !== null);
}

/** Compute percentage of value relative to total, rounded to 1 decimal. */
function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

/** Prominent count badge for report columns. */
function CountBadge({
  value,
  variant,
  depth,
  percentage,
}: {
  value: number;
  variant: "total" | "eligible" | "forms" | "self" | "manager" | "hr" | "board";
  depth: number;
  percentage?: number;
}) {
  const isZero = value === 0;
  const isRoot = depth === 0;

  const variantStyles: Record<string, string> = {
    total: "bg-slate-200 text-slate-800 dark:bg-slate-700/60 dark:text-slate-100",
    eligible: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200",
    forms: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
    self: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200",
    manager: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
    hr: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
    board: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  };

  if (isZero) {
    return (
      <span className="inline-flex flex-row items-center gap-2 tabular-nums">
        <span className="text-sm text-foreground/30">0 -</span>
        <span className="text-[10px] text-foreground/25">0%</span>
      </span>
    );
  }

  const pct =
    percentage !== undefined
      ? percentage
      : variant === "total"
        ? 100
        : 0;

  return (
    <span
      className={cn(
        "inline-flex min-w-[2.5rem] flex-row gap-2 items-center rounded-full px-2 py-0.5 tabular-nums",
        isRoot ? "text-sm font-bold" : "text-sm font-semibold",
        variantStyles[variant],
      )}
    >
      <span>{value} -</span>
      <span className="text-[12px] font-medium opacity-75">
        {pct.toFixed(1)}%
      </span>
    </span>
  );
}

function ReportRow({
  node,
  depth,
  expandedIds,
  onToggle,
}: {
  node: OrgReportNode;
  depth: number;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const badgeClass = CATEGORY_BADGE[node.categoryCode] ?? "bg-slate-100 text-slate-700";
  const rowTint = CATEGORY_ROW_TINT[node.categoryCode] ?? "";

  return (
    <>
      <tr
        className={cn(
          "border-b border-slate-100 transition-colors hover:bg-slate-100/80 dark:border-white/5 dark:hover:bg-white/[0.06]",
          rowTint,
        )}
      >
        <td className="py-2.5 pr-3">
          <div
            className="flex items-center gap-2"
            style={{ paddingLeft: `${depth * 24}px` }}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={() => onToggle(node.id)}
                className="flex size-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
              >
                {isExpanded ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </button>
            ) : (
              <span className="size-5 shrink-0" aria-hidden />
            )}
            <span
              className={cn(
                "shrink-0 rounded-md px-2 py-0.5 text-xs font-bold tracking-wide shadow-sm",
                badgeClass,
              )}
            >
              {node.categoryCode}
            </span>
            <span
              className={cn(
                "truncate text-sm",
                depth === 0
                  ? "font-bold text-text-primary"
                  : depth === 1
                    ? "font-semibold text-text-primary"
                    : "font-medium text-text-primary",
              )}
            >
              {node.name}
            </span>
           
          </div>
        </td>
        <td className="px-3 py-2.5 text-center">
          <CountBadge value={node.subtreeStaffCount} variant="total" depth={depth} percentage={100} />
        </td>
        <td className="px-3 py-2.5 text-center">
          <CountBadge value={node.eligible} variant="eligible" depth={depth} percentage={pct(node.eligible, node.subtreeStaffCount)} />
        </td>
        <td className="px-3 py-2.5 text-center">
          <CountBadge value={node.formsAssigned} variant="forms" depth={depth} percentage={pct(node.formsAssigned, node.subtreeStaffCount)} />
        </td>
        <td className="px-3 py-2.5 text-center">
          <CountBadge value={node.selfAssessed} variant="self" depth={depth} percentage={pct(node.selfAssessed, node.subtreeStaffCount)} />
        </td>
        <td className="px-3 py-2.5 text-center">
          <CountBadge value={node.assessedByManagers} variant="manager" depth={depth} percentage={pct(node.assessedByManagers, node.subtreeStaffCount)} />
        </td>
        <td className="px-3 py-2.5 text-center">
          <CountBadge value={node.hrAlignment} variant="hr" depth={depth} percentage={pct(node.hrAlignment, node.subtreeStaffCount)} />
        </td>
        <td className="px-3 py-2.5 text-center">
          <CountBadge value={node.boardApproval} variant="board" depth={depth} percentage={pct(node.boardApproval, node.subtreeStaffCount)} />
        </td>
      </tr>

      {hasChildren && isExpanded
        ? node.children.map((child) => (
            <ReportRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          ))
        : null}
    </>
  );
}

export default function ReportsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["organization-report"],
    queryFn: fetchOrganizationReport,
  });

  const { data: entities } = useQuery({
    queryKey: queryKeys.entities,
    queryFn: fetchDashboardEntities,
  });

  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());

  // Filter selections per category level: null = no filter, [] = none, [ids] = selected
  const [filterSelections, setFilterSelections] = useState<
    Record<string, number[] | null>
  >({
    C0: null,
    C1: null,
    C2: null,
    C3: null,
  });

  // Auto-expand C0 roots on first load.
  const dataSignature = data?.map((n) => n.id).join(",") ?? "";
  const [loadedSignature, setLoadedSignature] = useState("");
  if (data && dataSignature !== loadedSignature) {
    setLoadedSignature(dataSignature);
    setExpandedIds(new Set(data.map((n) => n.id)));
  }

  const handleToggle = (id: number) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    if (filteredTree) setExpandedIds(collectExpandableIds(filteredTree));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  // Build cascading filter options.
  const filterOptions = useMemo(() => {
    const result: Record<string, MultiSelectOption[]> = {};
    let parentIds: number[] | null = null;

    for (const lvl of FILTER_LEVELS) {
      const levelEntities = getEntitiesForLevel(
        entities ?? [],
        lvl.categoryCode,
        parentIds,
      );
      result[lvl.categoryCode] = toOptions(levelEntities);

      // Determine parent ids for the next level.
      const sel = filterSelections[lvl.categoryCode];
      if (sel !== null && sel.length > 0) {
        parentIds = sel;
      } else if (sel !== null && sel.length === 0) {
        // Empty selection at this level → next level has no options.
        parentIds = [];
      } else {
        // null = no filter → next level shows all children of all entities at this level.
        parentIds = levelEntities.map((e) => e.id);
      }
    }

    return result;
  }, [entities, filterSelections]);

  const handleFilterChange = useCallback(
    (categoryCode: string, values: string[] | null) => {
      const numValues =
        values === null ? null : values.map((v) => Number(v));

      setFilterSelections((prev) => {
        const next: Record<string, number[] | null> = { ...prev };
        next[categoryCode] = numValues;

        // Reset deeper levels when a parent level changes.
        const levelIndex = FILTER_LEVELS.findIndex(
          (lvl) => lvl.categoryCode === categoryCode,
        );
        for (let i = levelIndex + 1; i < FILTER_LEVELS.length; i++) {
          next[FILTER_LEVELS[i].categoryCode] = null;
        }

        return next;
      });
    },
    [],
  );

  const hasActiveFilters = FILTER_LEVELS.some(
    (lvl) => filterSelections[lvl.categoryCode] !== null,
  );

  const clearFilters = useCallback(() => {
    setFilterSelections({ C0: null, C1: null, C2: null, C3: null });
  }, []);

  // Compute visible entity ids and prune the tree.
  const visibleIds = useMemo(
    () => getVisibleEntityIds(entities ?? [], filterSelections),
    [entities, filterSelections],
  );

  const filteredTree = useMemo(
    () => (data ? pruneTree(data, visibleIds) : data),
    [data, visibleIds],
  );

  // Auto-expand all visible nodes when filters are active.
  const filterSignature = JSON.stringify(filterSelections);
  const [lastFilterSignature, setLastFilterSignature] = useState("");
  if (filterSignature !== lastFilterSignature) {
    setLastFilterSignature(filterSignature);
    if (hasActiveFilters && filteredTree) {
      setExpandedIds(collectExpandableIds(filteredTree));
    }
  }

  const totalStaff = useMemo(
    () => filteredTree?.reduce((sum, node) => sum + node.subtreeStaffCount, 0) ?? 0,
    [filteredTree],
  );
  const totalEligible = useMemo(
    () => filteredTree?.reduce((sum, node) => sum + node.eligible, 0) ?? 0,
    [filteredTree],
  );
  const totalFormsAssigned = useMemo(
    () => filteredTree?.reduce((sum, node) => sum + node.formsAssigned, 0) ?? 0,
    [filteredTree],
  );
  const totalSelfAssessed = useMemo(
    () => filteredTree?.reduce((sum, node) => sum + node.selfAssessed, 0) ?? 0,
    [filteredTree],
  );
  const totalAssessedByManagers = useMemo(
    () =>
      filteredTree?.reduce((sum, node) => sum + node.assessedByManagers, 0) ??
      0,
    [filteredTree],
  );
  const totalHrAlignment = useMemo(
    () => filteredTree?.reduce((sum, node) => sum + node.hrAlignment, 0) ?? 0,
    [filteredTree],
  );
  const totalBoardApproval = useMemo(
    () => filteredTree?.reduce((sum, node) => sum + node.boardApproval, 0) ?? 0,
    [filteredTree],
  );

  return (
    <div className="space-y-6 text-text-primary">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileBarChart className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">
              Organization Hierarchy Process Status Summary
            </h2>
            <p className="mt-0.5 text-sm text-foreground/60">
              Expandable org tree with appraisal workflow counts per entity.
              Parent rows show rolled-up totals for all descendants.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExpandAll}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-primary/10 dark:border-white/15"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-primary/10 dark:border-white/15"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-row flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="flex items-center gap-1.5 pb-2 text-xs font-semibold text-foreground/70">
          <Building2 className="size-3.5" />
          Filter:
        </div>
        {FILTER_LEVELS.map((lvl) => {
          const sel = filterSelections[lvl.categoryCode];
          const options = filterOptions[lvl.categoryCode] ?? [];
          const isDisabled = options.length === 0;
          return (
            <div key={lvl.categoryCode} className="w-auto min-w-[160px] max-w-[220px]">
              <MultiSelectFilterDropdown
                label={lvl.label}
                icon={Building2}
                options={options}
                selectedValues={
                  sel === null ? null : sel.map((id) => String(id))
                }
                onChange={(values) =>
                  handleFilterChange(lvl.categoryCode, values)
                }
                disabled={isDisabled}
                searchable
                quiet
              />
            </div>
          );
        })}
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 dark:border-white/15"
          >
            <X className="size-3" />
            Clear
          </button>
        ) : null}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
        <table className="w-full min-w-[1000px] border-collapse">
          <thead>
            <tr className="border-b-2 border-primary/30 bg-primary/90 text-white backdrop-blur-md dark:border-primary/40 dark:bg-primary/80">
              <th className="py-3.5 pr-3 pl-4 text-left text-sm font-bold uppercase tracking-wide text-white">
                Organization
              </th>
              <th className="px-3 py-3.5 text-center text-sm font-bold uppercase tracking-wide text-white/90">
                Total
              </th>
              <th className="px-3 py-3.5 text-center text-sm font-bold uppercase tracking-wide text-white/90">
                Eligible
              </th>
              <th className="px-3 py-3.5 text-center text-sm font-bold uppercase tracking-wide text-white/90">
                Forms Assigned
              </th>
              <th className="px-3 py-3.5 text-center text-sm font-bold uppercase tracking-wide text-white/90">
                Self Assessed
              </th>
              <th className="px-3 py-3.5 text-center text-sm font-bold uppercase tracking-wide text-white/90">
                Assessed by Managers
              </th>
              <th className="px-3 py-3.5 text-center text-sm font-bold uppercase tracking-wide text-white/90">
                HR Alignment
              </th>
              <th className="px-3 py-3.5 pr-4 text-center text-sm font-bold uppercase tracking-wide text-white/90">
                Board Approval
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-16">
                  <div className="flex items-center justify-center gap-2 text-sm text-foreground/60">
                    <Loader2 className="size-4 animate-spin" />
                    Loading report…
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-16 text-center text-sm text-red-600 dark:text-red-400"
                >
                  Failed to load report. Please try again.
                </td>
              </tr>
            ) : !filteredTree || filteredTree.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-16 text-center text-sm text-foreground/60"
                >
                  {hasActiveFilters
                    ? "No organizations match the current filters."
                    : "No organization data available."}
                </td>
              </tr>
            ) : (
              <>
                {filteredTree.map((node) => (
                  <ReportRow
                    key={node.id}
                    node={node}
                    depth={0}
                    expandedIds={expandedIds}
                    onToggle={handleToggle}
                  />
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-slate-300 bg-slate-100/80 dark:border-white/20 dark:bg-white/[0.06]">
                  <td className="py-3 pr-3 pl-4 text-sm font-bold">
                    Grand Total
                  </td>
                  <td className="px-3 py-3 text-center">
                    <CountBadge value={totalStaff} variant="total" depth={0} percentage={100} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <CountBadge value={totalEligible} variant="eligible" depth={0} percentage={pct(totalEligible, totalStaff)} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <CountBadge value={totalFormsAssigned} variant="forms" depth={0} percentage={pct(totalFormsAssigned, totalStaff)} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <CountBadge value={totalSelfAssessed} variant="self" depth={0} percentage={pct(totalSelfAssessed, totalStaff)} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <CountBadge value={totalAssessedByManagers} variant="manager" depth={0} percentage={pct(totalAssessedByManagers, totalStaff)} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <CountBadge value={totalHrAlignment} variant="hr" depth={0} percentage={pct(totalHrAlignment, totalStaff)} />
                  </td>
                  <td className="px-3 py-3 pr-4 text-center">
                    <CountBadge value={totalBoardApproval} variant="board" depth={0} percentage={pct(totalBoardApproval, totalStaff)} />
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
