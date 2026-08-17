"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  FileBarChart,
  Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  fetchOrganizationReport,
  type OrgReportNode,
} from "@/lib/queries/organization-report-client";
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

  return (
    <>
      <tr
        className={cn(
          "border-b border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-white/5 dark:hover:bg-white/[0.03]",
          depth === 0 && "bg-slate-50/80 dark:bg-white/[0.04]",
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
                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
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
            <span className="shrink-0 text-[10px] text-foreground/40">
              ({node.subtreeStaffCount} staff)
            </span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-center text-sm tabular-nums text-text-primary">
          {node.formsAssigned}
        </td>
        <td className="px-3 py-2.5 text-center text-sm tabular-nums text-text-primary">
          {node.selfAssessed}
        </td>
        <td className="px-3 py-2.5 text-center text-sm tabular-nums text-text-primary">
          {node.assessedByManagers}
        </td>
        <td className="px-3 py-2.5 text-center text-sm tabular-nums text-text-primary">
          {node.hrAlignment}
        </td>
        <td className="px-3 py-2.5 text-center text-sm tabular-nums text-text-primary">
          {node.boardApproval}
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

  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());

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
    if (data) setExpandedIds(collectExpandableIds(data));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  const totalFormsAssigned = useMemo(
    () => data?.reduce((sum, node) => sum + node.formsAssigned, 0) ?? 0,
    [data],
  );
  const totalSelfAssessed = useMemo(
    () => data?.reduce((sum, node) => sum + node.selfAssessed, 0) ?? 0,
    [data],
  );
  const totalAssessedByManagers = useMemo(
    () => data?.reduce((sum, node) => sum + node.assessedByManagers, 0) ?? 0,
    [data],
  );
  const totalHrAlignment = useMemo(
    () => data?.reduce((sum, node) => sum + node.hrAlignment, 0) ?? 0,
    [data],
  );
  const totalBoardApproval = useMemo(
    () => data?.reduce((sum, node) => sum + node.boardApproval, 0) ?? 0,
    [data],
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
              Organization Hierarchy Report
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

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-white/[0.03]">
              <th className="py-3 pr-3 pl-4 text-left text-xs font-semibold uppercase tracking-wide text-foreground/70">
                Organization
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-foreground/70">
                Forms Assigned
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-foreground/70">
                Self Assessed
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-foreground/70">
                Assessed by Managers
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-foreground/70">
                HR Alignment
              </th>
              <th className="px-3 py-3 pr-4 text-center text-xs font-semibold uppercase tracking-wide text-foreground/70">
                Board Approval
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-16">
                  <div className="flex items-center justify-center gap-2 text-sm text-foreground/60">
                    <Loader2 className="size-4 animate-spin" />
                    Loading report…
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-16 text-center text-sm text-red-600 dark:text-red-400"
                >
                  Failed to load report. Please try again.
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-16 text-center text-sm text-foreground/60"
                >
                  No organization data available.
                </td>
              </tr>
            ) : (
              <>
                {data.map((node) => (
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
                  <td className="px-3 py-3 text-center text-sm font-bold tabular-nums">
                    {totalFormsAssigned}
                  </td>
                  <td className="px-3 py-3 text-center text-sm font-bold tabular-nums">
                    {totalSelfAssessed}
                  </td>
                  <td className="px-3 py-3 text-center text-sm font-bold tabular-nums">
                    {totalAssessedByManagers}
                  </td>
                  <td className="px-3 py-3 text-center text-sm font-bold tabular-nums">
                    {totalHrAlignment}
                  </td>
                  <td className="px-3 py-3 pr-4 text-center text-sm font-bold tabular-nums">
                    {totalBoardApproval}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-foreground/60">
        <span className="font-medium">Workflow stages:</span>
        <span>
          <strong>Forms Assigned</strong> — employees with at least one form
          assignment
        </span>
        <span>
          <strong>Self Assessed</strong> — past self-assessment (status ≥
          Manager Review)
        </span>
        <span>
          <strong>Assessed by Managers</strong> — past manager review (status ≥
          HR Alignment)
        </span>
        <span>
          <strong>HR Alignment</strong> — past HR calibration (status ≥ Board
          Approval)
        </span>
        <span>
          <strong>Board Approval</strong> — approved or completed
        </span>
      </div>
    </div>
  );
}
