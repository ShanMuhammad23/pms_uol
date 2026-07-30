"use client";

import { useQuery } from "@tanstack/react-query";
import {
  FolderTree,
  Network,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CustomNodeElementProps,
  RawNodeDatum,
} from "react-d3-tree";
import { queryKeys } from "@/app/queries/keys";
import { fetchEntities } from "@/lib/queries/entities-client";
import { cn } from "@/lib/utils";
import type { EntityRecord } from "@/types/entities";

const Tree = dynamic(() => import("react-d3-tree").then((mod) => mod.Tree), {
  ssr: false,
  loading: () => (
    <p className="px-5 py-16 text-center text-sm text-foreground/60">
      Loading tree diagram…
    </p>
  ),
});

type EntityTreeNode = EntityRecord & {
  children: EntityTreeNode[];
};

/** Org levels flow top-down: C0 → C1 → C2 → C3 */
const CATEGORY_RANK: Record<string, number> = {
  C0: 0,
  C1: 1,
  C2: 2,
  C3: 3,
};

const CATEGORY_COLORS: Record<string, { fill: string; text: string; ring: string }> = {
  C0: { fill: "#0f172a", text: "#ffffff", ring: "#0f172a" },
  C1: { fill: "#ede9fe", text: "#5b21b6", ring: "#8b5cf6" },
  C2: { fill: "#e0f2fe", text: "#075985", ring: "#0ea5e9" },
  C3: { fill: "#d1fae5", text: "#065f46", ring: "#10b981" },
};

function compareEntityNodes(a: EntityTreeNode, b: EntityTreeNode): number {
  const rankA = CATEGORY_RANK[a.categoryCode] ?? 99;
  const rankB = CATEGORY_RANK[b.categoryCode] ?? 99;
  if (rankA !== rankB) return rankA - rankB;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/**
 * Build hierarchy rooted at C0 (ORG Level 0).
 * Children attach via parent_entity_id so C1 hang under their C0, C2 under C1, etc.
 */
function buildEntityTree(entities: EntityRecord[]): EntityTreeNode[] {
  const byId = new Map<number, EntityTreeNode>();
  for (const entity of entities) {
    byId.set(entity.id, { ...entity, children: [] });
  }

  for (const node of byId.values()) {
    // C0 is always a top-level root — never nest under another entity.
    if (node.categoryCode === "C0") continue;

    const parentId = node.parentEntityId;
    if (parentId != null && byId.has(parentId) && parentId !== node.id) {
      byId.get(parentId)!.children.push(node);
    }
  }

  const roots = [...byId.values()]
    .filter((node) => node.categoryCode === "C0")
    .sort(compareEntityNodes);

  const sortNodes = (nodes: EntityTreeNode[]) => {
    nodes.sort(compareEntityNodes);
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };

  sortNodes(roots);
  return roots;
}

function toRawNode(node: EntityTreeNode): RawNodeDatum {
  return {
    name: node.name,
    attributes: {
      categoryCode: node.categoryCode,
      staffCount: String(node.staffCount),
      entityId: String(node.id),
    },
    children: node.children.map(toRawNode),
  };
}

/** Always a single root object — react-d3-tree only renders data[0]. */
function toD3TreeData(roots: EntityTreeNode[]): RawNodeDatum {
  if (roots.length === 1) {
    return toRawNode(roots[0]);
  }

  // Invisible wrapper so every C0 appears as a left-side root sibling.
  return {
    name: "",
    attributes: {
      categoryCode: "ROOT",
      staffCount: "0",
      entityId: "root",
    },
    children: roots.map(toRawNode),
  };
}

function EntityNode({
  nodeDatum,
  toggleNode,
}: CustomNodeElementProps) {
  const category = String(nodeDatum.attributes?.categoryCode ?? "");
  const staffCount = String(nodeDatum.attributes?.staffCount ?? "0");

  // Multi-C0 forest wrapper: take no visual space.
  if (category === "ROOT") {
    return <g />;
  }

  const isC0 = category === "C0";
  const colors = CATEGORY_COLORS[category] ?? {
    fill: "#f8fafc",
    text: "#0f172a",
    ring: "#64748b",
  };
  const hasChildren = Boolean(nodeDatum.children?.length);
  const width = Math.min(210, Math.max(150, nodeDatum.name.length * 8 + 44));
  const height = isC0 ? 58 : 64;

  return (
    <g>
      <rect
        width={width}
        height={height}
        x={-width / 2}
        y={-height / 2}
        rx={10}
        ry={10}
        fill={colors.fill}
        stroke={colors.ring}
        strokeWidth={isC0 ? 2 : 1.5}
        className={cn(hasChildren && "cursor-pointer")}
        onClick={hasChildren ? toggleNode : undefined}
      />
      <text
        fill={colors.text}
        strokeWidth={0}
        x={0}
        y={-8}
        textAnchor="middle"
        style={{
          fontSize: isC0 ? "12px" : "11px",
          fontWeight: 700,
          fontFamily: "inherit",
        }}
        className={cn(hasChildren && "cursor-pointer")}
        onClick={hasChildren ? toggleNode : undefined}
      >
        {nodeDatum.name.length > 22
          ? `${nodeDatum.name.slice(0, 20)}…`
          : nodeDatum.name}
      </text>
      <text
        fill={colors.text}
        strokeWidth={0}
        x={0}
        y={8}
        textAnchor="middle"
        style={{ fontSize: "9px", fontWeight: 600, opacity: isC0 ? 0.9 : 0.85 }}
      >
        {category} · {staffCount} staff
      </text>
      {hasChildren ? (
        <text
          fill={isC0 ? "#cbd5e1" : colors.ring}
          strokeWidth={0}
          x={0}
          y={22}
          textAnchor="middle"
          style={{ fontSize: "8px", fontWeight: 500 }}
        >
          {nodeDatum.__rd3t.collapsed ? "▸ expand" : "▾ collapse"}
        </text>
      ) : null}
    </g>
  );
}

export default function OrganizationTree() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [translate, setTranslate] = useState({ x: 140, y: 0 });
  const [zoom, setZoom] = useState(0.75);

  const { data: entities, isLoading, error } = useQuery({
    queryKey: queryKeys.entities,
    queryFn: fetchEntities,
  });

  const tree = useMemo(() => buildEntityTree(entities ?? []), [entities]);
  const treeData = useMemo(() => toD3TreeData(tree), [tree]);
  const hasForestWrapper = tree.length > 1;

  const recenter = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { height } = el.getBoundingClientRect();
    // Pull invisible multi-C0 wrapper off-canvas so C0 nodes sit on the left.
    setTranslate({ x: hasForestWrapper ? -140 : 140, y: height / 2 });
  }, [hasForestWrapper]);

  useEffect(() => {
    recenter();
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => recenter());
    observer.observe(el);
    return () => observer.disconnect();
  }, [recenter, treeData]);

  const handleUpdate = useCallback(
    (target: { zoom: number; translate: { x: number; y: number } }) => {
      setZoom(target.zoom);
      setTranslate(target.translate);
    },
    [],
  );

  const pathClassFunc = useCallback(
    (link: { source: { data: RawNodeDatum } }) => {
      const sourceCategory = String(
        link.source.data.attributes?.categoryCode ?? "",
      );
      if (sourceCategory === "ROOT") {
        return "organization-tree-link organization-tree-link--root";
      }
      return "organization-tree-link";
    },
    [],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Network className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Organization Tree
            </h2>
            <p className="mt-0.5 text-sm text-foreground/60">
              Left-to-right from every C0 parent, then C1 → C2 → C3. Drag to
              pan, scroll to zoom, click nodes to expand/collapse.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setZoom((current) => Math.min(2, current + 0.15))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
          >
            <ZoomIn className="size-3.5" />
            Zoom in
          </button>
          <button
            type="button"
            onClick={() => setZoom((current) => Math.max(0.3, current - 0.15))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
          >
            <ZoomOut className="size-3.5" />
            Zoom out
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(0.75);
              recenter();
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
          >
            Reset view
          </button>
        </div>
      </div>

      
      <div
        ref={containerRef}
        className="relative h-[min(70vh,720px)] min-h-[420px] overflow-hidden rounded-md border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-sm dark:border-white/10 dark:from-slate-950 dark:to-slate-900"
      >
        {isLoading ? (
          <p className="px-5 py-16 text-center text-sm text-foreground/60">
            Loading organization tree…
          </p>
        ) : null}

        {error ? (
          <p className="px-5 py-16 text-center text-sm text-red-600 dark:text-red-400">
            Failed to load entities.
          </p>
        ) : null}

        {!isLoading && !error && tree.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <FolderTree className="size-10 text-foreground/30" />
            <p className="mt-3 text-sm font-semibold text-text-primary">
              No C0 entities yet
            </p>
            <p className="mt-1 text-sm text-foreground/60">
              Add at least one C0 (ORG Level 0) entity, then attach C1 children
              under it to build the tree.
            </p>
          </div>
        ) : null}

        {!isLoading && !error && tree.length > 0 ? (
          <Tree
            data={treeData}
            orientation="horizontal"
            translate={translate}
            zoom={zoom}
            scaleExtent={{ min: 0.25, max: 2 }}
            separation={{ siblings: 1.2, nonSiblings: 1.4 }}
            nodeSize={{ x: 260, y: 90 }}
            pathFunc="step"
            collapsible
            // Show C0 → C1; keep every C1 collapsed (hide C2/C3 until expanded).
            initialDepth={hasForestWrapper ? 2 : 1}
            enableLegacyTransitions
            transitionDuration={300}
            onUpdate={handleUpdate}
            renderCustomNodeElement={(props) => <EntityNode {...props} />}
            pathClassFunc={pathClassFunc as never}
          />
        ) : null}
      </div>

      <style>{`
        .organization-tree-link {
          stroke: #94a3b8 !important;
          stroke-width: 1.5px !important;
          fill: none !important;
        }
        .organization-tree-link--root {
          stroke: transparent !important;
          stroke-width: 0 !important;
        }
        .dark .organization-tree-link:not(.organization-tree-link--root) {
          stroke: #64748b !important;
        }
      `}</style>
    </div>
  );
}
