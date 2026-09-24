"use client";

import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  FileBarChart,
  Loader2,
  MapPin,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  fetchOrganizationReport,
  fetchOrganizationReportRecords,
  type OrgReportNode,
} from "@/lib/queries/organization-report-client";
import { APPRAISAL_STATUS_LABELS, type AppraisalStatus } from "@/types/forms";
import { useDashboardEntitiesQuery } from "@/app/queries/organization";
import { MultiSelectFilterDropdown } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import type { EntityRecord } from "@/types/entities";
import { cn } from "@/lib/utils";
import { useColumnConfig, type ColumnDef } from "@/app/hooks/use-column-config";
import {
  ColumnManagementPanel,
  ColumnManagementPanelTrigger,
} from "@/app/components/common/ColumnManagementPanel";
import { ResizableHeader } from "@/app/components/common/ResizableHeader";

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

// ---------------------------------------------------------------------------
// Column definitions for the report table.
// ---------------------------------------------------------------------------

type ReportColumnId =
  | "site"
  | "organization"
  | "total"
  | "eligible"
  | "formsAssigned"
  | "formsNotAssigned"
  | "directScoreEntry"
  | "managerDirectAssessment"
  | "performanceMatrixAssigned"
  | "incrementMatrixAssigned"
  | "selfAssessed"
  | "manager1Assigned"
  | "assessedByManager1"
  | "manager2Assigned"
  | "assessedByManager2"
  | "hrAlignment"
  | "boardApproval";

const REPORT_COLUMNS: ColumnDef[] = [
  { id: "site", label: "Site", pinned: true, width: 120 },
  { id: "organization", label: "Organization", pinned: true, width: 280 },
  { id: "total", label: "Total", width: 100 },
  { id: "eligible", label: "Eligible", width: 100 },
  { id: "formsAssigned", label: "Assigned", width: 130 },
  { id: "performanceMatrixAssigned", label: "Perf. Matrix", width: 120 },
  { id: "incrementMatrixAssigned", label: "Incr. Matrix", width: 120 },
  { id: "selfAssessed", label: "Assessed", width: 130 },
  { id: "manager1Assigned", label: "Manager 1 Assigned", width: 150 },
  { id: "assessedByManager1", label: "Manager 1 Review", width: 150 },
  { id: "manager2Assigned", label: "Manager 2 Assigned", width: 150 },
  { id: "assessedByManager2", label: "Manager 2 Review", width: 150 },
  { id: "hrAlignment", label: "HR Alignment", width: 130 },
  { id: "boardApproval", label: "Board Approval", width: 130 },
];

/** Popup chrome colors — mirrors the CountBadge palette so the modal echoes
 * the clicked column's badge color. */
const RECORD_MODAL_VARIANT: Record<CountVariant, string> = {
  total: "bg-slate-200 text-slate-800 dark:bg-slate-700/60 dark:text-slate-100",
  eligible: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200",
  forms: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
  formsNotAssigned: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
  ds: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
  ms: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200",
  perfMatrix: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200",
  incrMatrix: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-200",
  self: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200",
  manager1: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
  manager2: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200",
  hr: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  board: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
};

/** Records-popup columns — widths persist via useColumnConfig. The manager
 * column shares one id so its width carries across Manager 1 / Manager 2. */
const RECORD_MODAL_COLUMNS: ColumnDef[] = [
  { id: "sap", label: "SAP ID", width: 100 },
  { id: "name", label: "Name", width: 190 },
  { id: "email", label: "Email", width: 220 },
  { id: "org1", label: "Org 1", width: 170 },
  { id: "org2", label: "Org 2", width: 170 },
  { id: "manager", label: "Manager", width: 170 },
  { id: "status", label: "Status", width: 160 },
];

// ---------------------------------------------------------------------------
// Cell rendering helpers
// ---------------------------------------------------------------------------

type CountVariant =
  | "total"
  | "eligible"
  | "forms"
  | "formsNotAssigned"
  | "ds"
  | "ms"
  | "perfMatrix"
  | "incrMatrix"
  | "self"
  | "manager1"
  | "manager2"
  | "hr"
  | "board";

/** Map column id → count variant for CountBadge. */
const COLUMN_VARIANT: Record<ReportColumnId, CountVariant> = {
  site: "total",
  organization: "total",
  total: "total",
  eligible: "eligible",
  formsAssigned: "forms",
  formsNotAssigned: "formsNotAssigned",
  directScoreEntry: "ds",
  managerDirectAssessment: "ms",
  performanceMatrixAssigned: "perfMatrix",
  incrementMatrixAssigned: "incrMatrix",
  selfAssessed: "self",
  manager1Assigned: "manager1",
  assessedByManager1: "manager1",
  manager2Assigned: "manager2",
  assessedByManager2: "manager2",
  hrAlignment: "hr",
  boardApproval: "board",
};

/** Map column id → node field that holds the count value. */
function getNodeValue(
  node: OrgReportNode,
  columnId: ReportColumnId,
): number {
  switch (columnId) {
    case "total": return node.subtreeStaffCount;
    case "eligible": return node.eligible;
    case "formsAssigned": return node.formsAssigned;
    case "formsNotAssigned": return node.formsNotAssigned;
    case "directScoreEntry": return node.directScoreEntry;
    case "managerDirectAssessment": return node.managerDirectAssessment;
    case "performanceMatrixAssigned": return node.performanceMatrixAssigned;
    case "incrementMatrixAssigned": return node.incrementMatrixAssigned;
    case "selfAssessed": return node.selfAssessed;
    case "manager1Assigned": return node.manager1Assigned;
    case "assessedByManager1": return node.assessedByManager1;
    case "manager2Assigned": return node.manager2Assigned;
    case "assessedByManager2": return node.assessedByManager2;
    case "hrAlignment": return node.hrAlignment;
    case "boardApproval": return node.boardApproval;
    default: return 0;
  }
}

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------

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
 * Resolve an entity's site: its own campusId, or the campusId of the nearest
 * ancestor that carries one (site is assigned on C0/root entities).
 */
function resolveEntityCampusId(
  entity: EntityRecord,
  byId: Map<number, EntityRecord>,
): number | null {
  let current: EntityRecord | undefined = entity;
  while (current) {
    if (current.campusId != null) return current.campusId;
    current = current.parentEntityId != null
      ? byId.get(current.parentEntityId)
      : undefined;
  }
  return null;
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
  const hasAnyFilter =
    selections.site !== null ||
    FILTER_LEVELS.some((lvl) => selections[lvl.categoryCode] !== null);
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

  const visible = new Set<number>();

  // Site filter: seed every entity that resolves to a selected campus.
  // Descendant/ancestor expansion below preserves the full tree paths.
  const siteSel = selections.site;
  if (siteSel !== null && siteSel.length > 0) {
    const siteSet = new Set(siteSel);
    for (const e of entities) {
      const campusId = resolveEntityCampusId(e, byId);
      if (campusId != null && siteSet.has(campusId)) {
        visible.add(e.id);
      }
    }
  }

  for (const lvl of FILTER_LEVELS) {
    const sel = selections[lvl.categoryCode];
    if (sel !== null && sel.length > 0) {
      for (const id of sel) {
        visible.add(id);
      }
    }
  }

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

// ---------------------------------------------------------------------------
// CountBadge component
// ---------------------------------------------------------------------------

/** Prominent count badge for report columns. Clickable when onClick given. */
function CountBadge({
  value,
  variant,
  depth,
  percentage,
  showPercentage = true,
  onClick,
}: {
  value: number;
  variant: CountVariant;
  depth: number;
  percentage?: number;
  showPercentage?: boolean;
  onClick?: () => void;
}) {
  const isZero = value === 0;
  const isRoot = depth === 0;

  const variantStyles: Record<string, string> = {
    total: "bg-slate-200 text-slate-800 dark:bg-slate-700/60 dark:text-slate-100",
    eligible: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200",
    forms: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
    formsNotAssigned: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
    ds: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
    ms: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200",
    perfMatrix: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200",
    incrMatrix: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-200",
    self: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200",
    manager1: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
    manager2: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200",
    hr: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
    board: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  };

  if (isZero) {
    return (
      <span className="inline-flex flex-row items-center gap-2 tabular-nums">
        <span className="text-sm text-foreground/30">
          0{showPercentage ? " - 0%" : ""}
        </span>
      </span>
    );
  }

  const pctValue = percentage !== undefined ? percentage : 0;

  const badge = (
    <>
      <span>{value}{showPercentage ? " -" : ""}</span>
      {showPercentage ? (
        <span className="text-[12px] font-medium opacity-75">
          {pctValue.toFixed(1)}%
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="View records"
        className={cn(
          "inline-flex min-w-[2.5rem] flex-row gap-2 items-center rounded-full px-2 py-0.5 tabular-nums transition-shadow",
          "hover:ring-2 hover:ring-offset-1 hover:ring-slate-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:ring-white/30",
          isRoot ? "text-sm font-bold" : "text-sm font-semibold",
          variantStyles[variant],
        )}
      >
        {badge}
      </button>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex min-w-[2.5rem] flex-row gap-2 items-center rounded-full px-2 py-0.5 tabular-nums",
        isRoot ? "text-sm font-bold" : "text-sm font-semibold",
        variantStyles[variant],
      )}
    >
      {badge}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ReportRow component — renders a single tree row + its children recursively.
// Now receives visible columns and column width helpers so it respects the
// user's column management and resize preferences.
// ---------------------------------------------------------------------------

interface ReportRowProps {
  node: OrgReportNode;
  depth: number;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  onBadgeClick: (node: OrgReportNode, columnId: ReportColumnId) => void;
  visibleColumns: ColumnDef[];
  frozenColumnIds: string[];
  stickyOffsets: Record<string, number>;
  getColumnWidth: (columnId: string, defaultWidth?: number) => number | undefined;
  hasSelectColumn: boolean;
}

function ReportRow({
  node,
  depth,
  expandedIds,
  onToggle,
  onBadgeClick,
  visibleColumns,
  frozenColumnIds,
  stickyOffsets,
  getColumnWidth,
  hasSelectColumn,
}: ReportRowProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const badgeClass = CATEGORY_BADGE[node.categoryCode] ?? "bg-slate-100 text-slate-700";
  const rowTint = CATEGORY_ROW_TINT[node.categoryCode] ?? "";
  const frozenSet = new Set(frozenColumnIds);

  const cellStyle = (col: ColumnDef): React.CSSProperties => {
    const w = getColumnWidth(col.id, col.width);
    const isFrozen = frozenSet.has(col.id);
    return {
      ...(w != null ? { width: w, minWidth: w, maxWidth: w } : {}),
      ...(isFrozen ? { left: stickyOffsets[col.id], zIndex: 20 } : {}),
    };
  };

  const cellClassName = (col: ColumnDef, extra?: string): string => {
    const isFrozen = frozenSet.has(col.id);
    return cn(
      "px-3 py-2.5 text-center",
      isFrozen && "sticky",
      extra,
    );
  };

  const renderCountCell = (col: ColumnDef) => {
    const columnId = col.id as ReportColumnId;
    const value = getNodeValue(node, columnId);
    const variant = COLUMN_VARIANT[columnId];
    const showPct = columnId !== "total" && columnId !== "eligible";
    const percentage = showPct ? pct(value, node.eligible) : undefined;

    return (
      <td
        key={col.id}
        className={cellClassName(col)}
        style={cellStyle(col)}
      >
        <CountBadge
          value={value}
          variant={variant}
          depth={depth}
          percentage={percentage}
          showPercentage={showPct}
          onClick={value > 0 ? () => onBadgeClick(node, columnId) : undefined}
        />
      </td>
    );
  };

  return (
    <>
      <tr
        className={cn(
          "border-b border-slate-100 transition-colors hover:bg-slate-100/80 dark:border-white/5 dark:hover:bg-white/[0.06]",
          rowTint,
        )}
      >
        {visibleColumns.map((col) => {
          if (col.id === "site") {
            return (
              <td
                key={col.id}
                className={cellClassName(col, "text-left")}
                style={cellStyle(col)}
              >
                <span className="block truncate pl-1 text-sm font-medium text-foreground/80">
                  {node.campusName ?? "—"}
                </span>
              </td>
            );
          }
          if (col.id === "organization") {
            const isFrozen = frozenSet.has(col.id);
            return (
              <td
                key={col.id}
                className={cn(
                  "py-2.5 pr-3",
                  isFrozen && "sticky",
                  isFrozen && "bg-inherit",
                )}
                style={cellStyle(col)}
              >
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
            );
          }
          return renderCountCell(col);
        })}
      </tr>

      {hasChildren && isExpanded
        ? node.children.map((child) => (
            <ReportRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onBadgeClick={onBadgeClick}
              visibleColumns={visibleColumns}
              frozenColumnIds={frozenColumnIds}
              stickyOffsets={stickyOffsets}
              getColumnWidth={getColumnWidth}
              hasSelectColumn={hasSelectColumn}
            />
          ))
        : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main ReportsPage component
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["organization-report"],
    queryFn: () => fetchOrganizationReport(),
  });

  const { data: entities } = useDashboardEntitiesQuery();

  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [columnMgmtOpen, setColumnMgmtOpen] = useState(false);
  // Clicked count badge → show the records behind it. entityId null = org-wide.
  const [recordsView, setRecordsView] = useState<{
    entityId: number | null;
    entityName: string;
    columnId: ReportColumnId;
    columnLabel: string;
  } | null>(null);

  const recordsQuery = useQuery({
    queryKey: [
      "org-report-records",
      recordsView?.entityId ?? "all",
      recordsView?.columnId,
    ],
    queryFn: () =>
      fetchOrganizationReportRecords(
        recordsView!.entityId,
        recordsView!.columnId,
      ),
    enabled: recordsView !== null,
  });

  const openRecords = (node: OrgReportNode | null, columnId: ReportColumnId) => {
    const columnLabel =
      REPORT_COLUMNS.find((c) => c.id === columnId)?.label ?? columnId;
    setRecordsView({
      entityId: node?.id ?? null,
      entityName: node?.name ?? "All Organizations",
      columnId,
      columnLabel,
    });
  };

  // Manager-related columns get a matching manager column in the popup.
  const recordsManagerCol =
    recordsView?.columnId === "manager1Assigned" ||
    recordsView?.columnId === "assessedByManager1"
      ? "manager1"
      : recordsView?.columnId === "manager2Assigned" ||
          recordsView?.columnId === "assessedByManager2"
        ? "manager2"
        : null;

  const recordStatusLabel = (status: string | null) =>
    status
      ? (APPRAISAL_STATUS_LABELS[status as AppraisalStatus] ?? status)
      : "—";

  const exportRecordsToExcel = () => {
    const records = recordsQuery.data ?? [];
    if (records.length === 0 || !recordsView) return;

    const rows = records.map((r) => ({
      "SAP ID": r.employeeId,
      Name: r.employeeName,
      Email: r.email ?? "",
      "Org 1": r.orgLevel1Name ?? "",
      "Org 2": r.orgLevel2Name ?? "",
      ...(recordsManagerCol === "manager1"
        ? { "Manager 1": r.manager1Name ?? "" }
        : recordsManagerCol === "manager2"
          ? { "Manager 2": r.manager2Name ?? "" }
          : {}),
      Status: recordStatusLabel(r.status),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 28 },
      { wch: 32 },
      { wch: 28 },
      { wch: 28 },
      { wch: 22 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Records");
    const filename = `${recordsView.columnLabel} - ${recordsView.entityName}`
      .replace(/[\\/:*?"<>|]/g, "-")
      .slice(0, 120);
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  // Column config (persisted server-side via useColumnConfig).
  const {
    config,
    defaults: configDefaults,
    visibleOrderedColumns,
    frozenColumnIds,
    stickyOffsets,
    getColumnWidth,
    setColumnWidth,
    updateConfig,
    resetConfig,
  } = useColumnConfig("reports-process-status", {
    allColumns: REPORT_COLUMNS,
    hasSelectColumn: false,
  });

  // Records-popup column widths (persisted like the main table).
  const { getColumnWidth: getRecordColWidth, setColumnWidth: setRecordColWidth } =
    useColumnConfig("reports-record-popup", {
      allColumns: RECORD_MODAL_COLUMNS,
      hasSelectColumn: false,
    });

  // Filter selections per level: "site" (campus ids) then the org category
  // levels C0–C3. null = no filter, [] = none, [ids] = selected.
  const [filterSelections, setFilterSelections] = useState<
    Record<string, number[] | null>
  >({
    site: null,
    C0: null,
    C1: null,
    C2: null,
    C3: null,
  });

  // All nodes collapsed by default; user expands manually.
  const dataSignature = data?.map((n) => n.id).join(",") ?? "";
  const [loadedSignature, setLoadedSignature] = useState("");
  if (data && dataSignature !== loadedSignature) {
    setLoadedSignature(dataSignature);
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

  // Build cascading filter options. Site is the top level: a site selection
  // restricts ORG Level 0 to entities at those campuses, which then cascades
  // through the org levels as before.
  const filterOptions = useMemo(() => {
    const result: Record<string, MultiSelectOption[]> = {};
    const allEntities = entities ?? [];
    const byId = new Map(allEntities.map((e) => [e.id, e]));

    // Site options: the distinct campuses referenced by the entity tree,
    // counted by how many entities carry that campus directly.
    const campusById = new Map<number, { name: string; count: number }>();
    for (const e of allEntities) {
      if (e.campusId != null && e.campusName) {
        const entry = campusById.get(e.campusId);
        if (entry) entry.count += 1;
        else campusById.set(e.campusId, { name: e.campusName, count: 1 });
      }
    }
    result.site = [...campusById.entries()]
      .map(([id, { name, count }]) => ({
        value: String(id),
        label: name,
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const siteSel = filterSelections.site;
    // null = no site filter; [] = "none selected" (empties C0 options,
    // matching how [] behaves at every other cascade level).
    const siteSet = siteSel !== null ? new Set(siteSel) : null;

    let parentIds: number[] | null = null;

    for (const lvl of FILTER_LEVELS) {
      let levelEntities = getEntitiesForLevel(
        allEntities,
        lvl.categoryCode,
        parentIds,
      );
      // C0 options are scoped by the site selection — deeper levels already
      // inherit site through their C0 parent.
      if (lvl.categoryCode === "C0" && siteSet) {
        levelEntities = levelEntities.filter(
          (e) => {
            const campusId = resolveEntityCampusId(e, byId);
            return campusId != null && siteSet.has(campusId);
          },
        );
      }
      result[lvl.categoryCode] = toOptions(levelEntities);

      const sel = filterSelections[lvl.categoryCode];
      if (sel !== null && sel.length > 0) {
        parentIds = sel;
      } else if (sel !== null && sel.length === 0) {
        parentIds = [];
      } else {
        parentIds = null;
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

        // "site" sits above C0 — index -1 resets every org level below it.
        const levelIndex =
          categoryCode === "site"
            ? -1
            : FILTER_LEVELS.findIndex(
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

  const hasActiveFilters =
    filterSelections.site !== null ||
    FILTER_LEVELS.some((lvl) => filterSelections[lvl.categoryCode] !== null);

  const clearFilters = useCallback(() => {
    setFilterSelections({ site: null, C0: null, C1: null, C2: null, C3: null });
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

  // Grand totals — sum across root-level nodes.
  const totalStaff = useMemo(
    () => filteredTree?.reduce((sum, node) => sum + node.subtreeStaffCount, 0) ?? 0,
    [filteredTree],
  );
  const totalEligible = useMemo(
    () => filteredTree?.reduce((sum, node) => sum + node.eligible, 0) ?? 0,
    [filteredTree],
  );

  const grandTotalValue = (columnId: ReportColumnId): number => {
    if (!filteredTree) return 0;
    return filteredTree.reduce((sum, node) => sum + getNodeValue(node, columnId), 0);
  };

  const visibleColumnCount = visibleOrderedColumns.length;
  const frozenSet = new Set(frozenColumnIds);

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
          <ColumnManagementPanelTrigger
            open={columnMgmtOpen}
            onOpenChange={setColumnMgmtOpen}
          />
        </div>
      </div>

      <ColumnManagementPanel
        open={columnMgmtOpen}
        onOpenChange={setColumnMgmtOpen}
        columns={REPORT_COLUMNS}
        config={config}
        defaults={configDefaults}
        onApply={updateConfig}
        onReset={resetConfig}
      />

      {/* Filters */}
      <div className="flex flex-row flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="flex items-center gap-1.5 pb-2 text-xs font-semibold text-foreground/70">
          <Building2 className="size-3.5" />
          Filter:
        </div>
        <div className="w-auto min-w-[160px] max-w-[220px]">
          <MultiSelectFilterDropdown
            label="Site"
            icon={MapPin}
            options={filterOptions.site ?? []}
            selectedValues={
              filterSelections.site === null
                ? null
                : filterSelections.site.map((id) => String(id))
            }
            onChange={(values) => handleFilterChange("site", values)}
            disabled={(filterOptions.site ?? []).length === 0}
            searchable
            quiet
          />
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
            onClick={() => {
              clearFilters();
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 dark:border-white/15"
          >
            <X className="size-3" />
            Clear
          </button>
        ) : null}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
        <table className="border-collapse">
          <thead>
            <tr className="border-b-2 border-primary/30 bg-primary/90 text-white backdrop-blur-md dark:border-primary/40 dark:bg-primary/80">
              {visibleOrderedColumns.map((col) => {
                const isFrozen = frozenSet.has(col.id);
                const w = getColumnWidth(col.id, col.width);
                return (
                  <ResizableHeader
                    key={col.id}
                    columnId={col.id}
                    width={w}
                    onResize={setColumnWidth}
                    frozen={isFrozen}
                    stickyLeft={stickyOffsets[col.id]}
                    className={cn(
                      "py-3.5 text-center text-sm font-bold uppercase tracking-wide",
                      col.id === "organization"
                        ? "pl-4 text-left text-white"
                        : "text-white/90",
                      isFrozen && "bg-primary/90 dark:bg-primary/80",
                    )}
                  >
                    {col.label}
                  </ResizableHeader>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={visibleColumnCount} className="py-16">
                  <div className="flex items-center justify-center gap-2 text-sm text-foreground/60">
                    <Loader2 className="size-4 animate-spin" />
                    Loading report…
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan={visibleColumnCount}
                  className="py-16 text-center text-sm text-red-600 dark:text-red-400"
                >
                  Failed to load report. Please try again.
                </td>
              </tr>
            ) : !filteredTree || filteredTree.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumnCount}
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
                    onBadgeClick={openRecords}
                    visibleColumns={visibleOrderedColumns}
                    frozenColumnIds={frozenColumnIds}
                    stickyOffsets={stickyOffsets}
                    getColumnWidth={getColumnWidth}
                    hasSelectColumn={false}
                  />
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-slate-300 bg-slate-100/80 dark:border-white/20 dark:bg-white/[0.06]">
                  {visibleOrderedColumns.map((col) => {
                    const columnId = col.id as ReportColumnId;
                    const isFrozen = frozenSet.has(col.id);
                    const w = getColumnWidth(col.id, col.width);

                    if (columnId === "site") {
                      return (
                        <td
                          key={col.id}
                          className={cn(
                            "py-3 pl-1 text-sm font-bold",
                            isFrozen && "sticky",
                            isFrozen && "bg-slate-100/80 dark:bg-white/[0.06]",
                          )}
                          style={{
                            ...(w != null ? { width: w, minWidth: w, maxWidth: w } : {}),
                            ...(isFrozen ? { left: stickyOffsets[col.id], zIndex: 20 } : {}),
                          }}
                        />
                      );
                    }

                    if (columnId === "organization") {
                      return (
                        <td
                          key={col.id}
                          className={cn(
                            "py-3 pr-3 pl-4 text-sm font-bold",
                            isFrozen && "sticky",
                            isFrozen && "bg-slate-100/80 dark:bg-white/[0.06]",
                          )}
                          style={{
                            ...(w != null ? { width: w, minWidth: w, maxWidth: w } : {}),
                            ...(isFrozen ? { left: stickyOffsets[col.id], zIndex: 20 } : {}),
                          }}
                        >
                          Grand Total
                        </td>
                      );
                    }

                    const value = grandTotalValue(columnId);
                    const variant = COLUMN_VARIANT[columnId];
                    const showPct = columnId !== "total" && columnId !== "eligible";
                    const percentage = showPct ? pct(value, totalEligible) : undefined;

                    return (
                      <td
                        key={col.id}
                        className={cn(
                          "px-3 py-3 text-center",
                          isFrozen && "sticky",
                          isFrozen && "bg-slate-100/80 dark:bg-white/[0.06]",
                        )}
                        style={{
                          ...(w != null ? { width: w, minWidth: w, maxWidth: w } : {}),
                          ...(isFrozen ? { left: stickyOffsets[col.id], zIndex: 20 } : {}),
                        }}
                      >
                        <CountBadge
                          value={value}
                          variant={variant}
                          depth={0}
                          percentage={percentage}
                          showPercentage={showPct}
                          onClick={
                            value > 0
                              ? () => openRecords(null, columnId)
                              : undefined
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Records modal — actual employees behind a clicked count badge */}
      {recordsView ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setRecordsView(null)}
        >
          <div
            className="flex h-[85vh] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                "flex items-center justify-between border-b border-black/10 px-5 py-3 dark:border-white/10",
                RECORD_MODAL_VARIANT[COLUMN_VARIANT[recordsView.columnId]],
              )}
            >
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">
                  {recordsView.columnLabel} — {recordsView.entityName}
                </h3>
                <p className="text-xs opacity-75">
                  {recordsQuery.data
                    ? `${recordsQuery.data.length} record${recordsQuery.data.length !== 1 ? "s" : ""}`
                    : "Loading…"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={exportRecordsToExcel}
                  disabled={!recordsQuery.data || recordsQuery.data.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={() => setRecordsView(null)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {recordsQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading records…
                </div>
              ) : recordsQuery.isError ? (
                <div className="py-16 text-center text-sm text-red-500">
                  Failed to load records.
                </div>
              ) : (recordsQuery.data?.length ?? 0) === 0 ? (
                <div className="py-16 text-center text-sm text-slate-500">
                  No records found.
                </div>
              ) : (
                <table className="w-full table-fixed text-sm">
                  <thead
                    className={cn(
                      "sticky top-0 text-left text-xs font-semibold uppercase tracking-wide",
                      RECORD_MODAL_VARIANT[COLUMN_VARIANT[recordsView.columnId]],
                    )}
                  >
                    <tr>
                      {(
                        [
                          ["sap", "SAP ID"],
                          ["name", "Name"],
                          ["email", "Email"],
                          ["org1", "Org 1"],
                          ["org2", "Org 2"],
                          ...(recordsManagerCol === "manager1"
                            ? [["manager", "Manager 1"] as const]
                            : recordsManagerCol === "manager2"
                              ? [["manager", "Manager 2"] as const]
                              : []),
                          ["status", "Status"],
                        ] as const
                      ).map(([id, label]) => (
                        <ResizableHeader
                          key={id}
                          columnId={id}
                          width={getRecordColWidth(id)}
                          onResize={setRecordColWidth}
                          className="px-4 py-2.5"
                        >
                          {label}
                        </ResizableHeader>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(recordsQuery.data ?? []).map((r) => (
                      <tr
                        key={r.userId}
                        className="border-t border-slate-100 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/[0.04]"
                      >
                        <td className="truncate px-4 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">
                          {r.employeeId}
                        </td>
                        <td className="truncate px-4 py-2 text-slate-800 dark:text-slate-100">
                          {r.employeeName}
                        </td>
                        <td className="truncate px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                          {r.email ?? "—"}
                        </td>
                        <td className="truncate px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                          {r.orgLevel1Name ?? "—"}
                        </td>
                        <td className="truncate px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                          {r.orgLevel2Name ?? "—"}
                        </td>
                        {recordsManagerCol === "manager1" ? (
                          <td className="truncate px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                            {r.manager1Name ?? "—"}
                          </td>
                        ) : null}
                        {recordsManagerCol === "manager2" ? (
                          <td className="truncate px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                            {r.manager2Name ?? "—"}
                          </td>
                        ) : null}
                        <td className="truncate px-4 py-2 text-xs text-slate-600 dark:text-slate-300">
                          {recordStatusLabel(r.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
