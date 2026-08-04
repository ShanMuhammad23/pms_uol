"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Network,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EntityListFilterBar } from "@/app/components/entity-categories/EntityListFilterBar";
import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import {
  filterEntityRecords,
  getDirectChildEntitiesOfParents,
  getEntitiesForCategoryCode,
  type MultiFilterSelection,
} from "@/app/helpers/dashboard-entity-filters";
import { queryKeys } from "@/app/queries/keys";
import { fetchEntityCategories } from "@/lib/queries/entity-categories-client";
import { fetchEntities } from "@/lib/queries/entities-client";
import { cn } from "@/lib/utils";
import type { EntityRecord } from "@/types/entities";
import type { EntityCategoryCode } from "@/types/entity-categories";

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

const CATEGORY_COLORS: Record<
  string,
  { fill: string; text: string; ring: string; box: string }
> = {
  C0: {
    fill: "bg-slate-900 dark:bg-slate-800",
    text: "text-white",
    ring: "ring-slate-900/20 dark:ring-white/10",
    box: "bg-slate-100/80 border-slate-200 dark:bg-slate-900/60 dark:border-slate-700",
  },
  C1: {
    fill: "bg-violet-100 dark:bg-violet-950/50",
    text: "text-violet-900 dark:text-violet-100",
    ring: "ring-violet-300/60 dark:ring-violet-700/40",
    box: "bg-violet-50/70 border-violet-200/80 dark:bg-violet-950/30 dark:border-violet-800/50",
  },
  C2: {
    fill: "bg-sky-100 dark:bg-sky-950/50",
    text: "text-sky-900 dark:text-sky-100",
    ring: "ring-sky-300/60 dark:ring-sky-700/40",
    box: "bg-sky-50/70 border-sky-200/80 dark:bg-sky-950/30 dark:border-sky-800/50",
  },
  C3: {
    fill: "bg-emerald-100 dark:bg-emerald-950/50",
    text: "text-emerald-900 dark:text-emerald-100",
    ring: "ring-emerald-300/60 dark:ring-emerald-700/40",
    box: "bg-emerald-50/70 border-emerald-200/80 dark:bg-emerald-950/30 dark:border-emerald-800/50",
  },
};

function compareEntityNodes(a: EntityTreeNode, b: EntityTreeNode): number {
  const rankA = CATEGORY_RANK[a.categoryCode] ?? 99;
  const rankB = CATEGORY_RANK[b.categoryCode] ?? 99;
  if (rankA !== rankB) return rankA - rankB;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

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

  // Roots: C0 nodes, or any node whose parent is outside the current set
  // (so filtered views still render a coherent forest).
  const roots = [...byId.values()]
    .filter((node) => {
      if (node.categoryCode === "C0") return true;
      const parentId = node.parentEntityId;
      return parentId == null || !byId.has(parentId);
    })
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

function EntityCard({
  node,
  expanded,
  onToggle,
}: {
  node: EntityTreeNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  const colors = CATEGORY_COLORS[node.categoryCode] ?? {
    fill: "bg-slate-50 dark:bg-slate-800",
    text: "text-text-primary",
    ring: "ring-slate-200 dark:ring-slate-700",
    box: "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-700",
  };
  const hasChildren = node.children.length > 0;
  const isC0 = node.categoryCode === "C0";

  return (
    <button
      type="button"
      onClick={hasChildren ? onToggle : undefined}
      disabled={!hasChildren}
      className={cn(
        "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left ring-1 transition-colors",
        colors.fill,
        colors.text,
        colors.ring,
        hasChildren
          ? "cursor-pointer hover:brightness-[0.98] dark:hover:brightness-110"
          : "cursor-default",
      )}
    >
      {hasChildren ? (
        <span className="mt-0.5 shrink-0 opacity-80">
          {expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </span>
      ) : (
        <span className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate font-semibold leading-snug",
            isC0 ? "text-sm" : "text-[13px]",
          )}
        >
          {node.name}
        </span>
        <span
          className={cn(
            "mt-0.5 block text-[10px] font-medium opacity-80",
            isC0 && "text-slate-300",
          )}
        >
          {node.categoryCode} · {node.staffCount} staff
          {hasChildren
            ? ` · ${node.children.length} child${node.children.length === 1 ? "" : "ren"}`
            : ""}
        </span>
      </span>
    </button>
  );
}

function SiblingListBox({
  parentCategory,
  nodes,
  expandedIds,
  onToggle,
  depth,
}: {
  parentCategory: string;
  nodes: EntityTreeNode[];
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  depth: number;
}) {
  if (nodes.length === 0) return null;

  const boxColors =
    CATEGORY_COLORS[parentCategory]?.box ??
    "bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-700";

  return (
    <div
      className={cn(
        "mt-2 space-y-1.5 rounded-xl border p-2 shadow-sm",
        boxColors,
        depth > 0 && "ml-3 border-dashed",
      )}
    >
      {nodes.map((child) => {
        const isExpanded = expandedIds.has(child.id);
        const hasKids = child.children.length > 0;

        return (
          <div key={child.id} className="min-w-0">
            <EntityCard
              node={child}
              expanded={isExpanded}
              onToggle={() => onToggle(child.id)}
            />
            {hasKids && isExpanded ? (
              <SiblingListBox
                parentCategory={child.categoryCode}
                nodes={child.children}
                expandedIds={expandedIds}
                onToggle={onToggle}
                depth={depth + 1}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function RootColumn({
  root,
  expandedIds,
  onToggle,
}: {
  root: EntityTreeNode;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
}) {
  const isExpanded = expandedIds.has(root.id);
  const hasChildren = root.children.length > 0;
  const boxColors =
    CATEGORY_COLORS[root.categoryCode]?.box ??
    "bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-700";

  return (
    <div
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-2xl border p-3 shadow-sm",
        boxColors,
      )}
    >
      <EntityCard
        node={root}
        expanded={isExpanded}
        onToggle={() => onToggle(root.id)}
      />
      {hasChildren && isExpanded ? (
        <SiblingListBox
          parentCategory={root.categoryCode}
          nodes={root.children}
          expandedIds={expandedIds}
          onToggle={onToggle}
          depth={0}
        />
      ) : null}
    </div>
  );
}

export default function OrganizationTree() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const treeSignatureRef = useRef<string>("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<
    EntityCategoryCode | "ALL"
  >("ALL");
  const [selectedEntityIds, setSelectedEntityIds] =
    useState<MultiFilterSelection<number>>(null);
  const [selectedChildEntityIds, setSelectedChildEntityIds] =
    useState<MultiFilterSelection<number>>(null);
  const [selectedParentEntityIds, setSelectedParentEntityIds] =
    useState<MultiFilterSelection<number>>(null);

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["entity-categories"],
    queryFn: fetchEntityCategories,
  });

  const { data: entities, isLoading, error } = useQuery({
    queryKey: queryKeys.entities,
    queryFn: fetchEntities,
  });

  const categoryEntities = useMemo(
    () => getEntitiesForCategoryCode(entities ?? [], selectedCategoryCode),
    [entities, selectedCategoryCode],
  );

  const entityOptions = useMemo<MultiSelectOption[]>(
    () =>
      categoryEntities.map((entity) => ({
        value: String(entity.id),
        label: entity.name,
        count: 0,
      })),
    [categoryEntities],
  );

  const childEntities = useMemo(
    () =>
      getDirectChildEntitiesOfParents(
        entities ?? [],
        selectedEntityIds,
        categoryEntities.map((entity) => entity.id),
      ),
    [entities, selectedEntityIds, categoryEntities],
  );

  const childEntityOptions = useMemo<MultiSelectOption[]>(
    () =>
      childEntities.map((entity) => ({
        value: String(entity.id),
        label: `${entity.name} (${entity.categoryCode})`,
        count: 0,
      })),
    [childEntities],
  );

  const parentEntityOptions = useMemo<MultiSelectOption[]>(() => {
    if (!entities) return [];
    const parentIds = new Set<number>();
    for (const entity of entities) {
      if (entity.parentEntityId != null) {
        parentIds.add(entity.parentEntityId);
      }
    }
    const byId = new Map(entities.map((e) => [e.id, e]));
    return [...parentIds]
      .map((id) => byId.get(id))
      .filter((e): e is EntityRecord => e != null)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({ value: String(e.id), label: e.name, count: 0 }));
  }, [entities]);

  const filteredEntities = useMemo(
    () =>
      filterEntityRecords(entities ?? [], {
        searchQuery,
        categoryCode: selectedCategoryCode,
        entityIds: selectedEntityIds,
        childEntityIds: selectedChildEntityIds,
        parentEntityIds: selectedParentEntityIds,
      }),
    [
      entities,
      searchQuery,
      selectedCategoryCode,
      selectedEntityIds,
      selectedChildEntityIds,
      selectedParentEntityIds,
    ],
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedCategoryCode !== "ALL" ||
    selectedEntityIds !== null ||
    selectedChildEntityIds !== null ||
    selectedParentEntityIds !== null;

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategoryCode("ALL");
    setSelectedEntityIds(null);
    setSelectedChildEntityIds(null);
    setSelectedParentEntityIds(null);
  }, []);

  const handleCategoryCodeChange = useCallback(
    (value: EntityCategoryCode | "ALL") => {
      setSelectedCategoryCode(value);
      setSelectedEntityIds(null);
      setSelectedChildEntityIds(null);
    },
    [],
  );

  const handleEntityIdsChange = useCallback((values: string[] | null) => {
    setSelectedEntityIds(
      values === null ? null : values.map((value) => Number(value)),
    );
    setSelectedChildEntityIds(null);
  }, []);

  const handleChildEntityIdsChange = useCallback((values: string[] | null) => {
    setSelectedChildEntityIds(
      values === null ? null : values.map((value) => Number(value)),
    );
  }, []);

  const handleParentEntityIdsChange = useCallback((values: string[] | null) => {
    setSelectedParentEntityIds(
      values === null ? null : values.map((value) => Number(value)),
    );
  }, []);

  const tree = useMemo(
    () => buildEntityTree(filteredEntities),
    [filteredEntities],
  );

  // Expand roots whenever the visible forest changes so C1 lists show by default.
  useEffect(() => {
    const signature = tree.map((root) => root.id).join(",");
    if (signature === treeSignatureRef.current) return;
    treeSignatureRef.current = signature;
    setExpandedIds(new Set(tree.map((root) => root.id)));
  }, [tree]);

  const handleToggle = useCallback((id: number) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const totalCount = entities?.length ?? 0;
  const showTree = !isLoading && !error && tree.length > 0;
  const showNoMatch =
    !isLoading &&
    !error &&
    totalCount > 0 &&
    filteredEntities.length === 0;
  const showNoC0 =
    !isLoading &&
    !error &&
    totalCount === 0;

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
              Each C0 is a column; children of the same parent stack in a shaded
              list. Click a node to expand or collapse.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setZoom((current) => Math.min(1.5, current + 0.1))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
          >
            <ZoomIn className="size-3.5" />
            Zoom in
          </button>
          <button
            type="button"
            onClick={() => setZoom((current) => Math.max(0.5, current - 0.1))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
          >
            <ZoomOut className="size-3.5" />
            Zoom out
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
          >
            Reset view
          </button>
        </div>
      </div>

      {!isLoading && !error && totalCount > 0 ? (
        <EntityListFilterBar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          selectedCategoryCode={selectedCategoryCode}
          onCategoryCodeChange={handleCategoryCodeChange}
          selectedEntityIds={
            selectedEntityIds === null
              ? null
              : selectedEntityIds.map(String)
          }
          onEntityIdsChange={handleEntityIdsChange}
          selectedChildEntityIds={
            selectedChildEntityIds === null
              ? null
              : selectedChildEntityIds.map(String)
          }
          onChildEntityIdsChange={handleChildEntityIdsChange}
          selectedParentEntityIds={
            selectedParentEntityIds === null
              ? null
              : selectedParentEntityIds.map(String)
          }
          onParentEntityIdsChange={handleParentEntityIdsChange}
          parentEntityOptions={parentEntityOptions}
          entityOptions={entityOptions}
          childEntityOptions={childEntityOptions}
          categories={categories ?? []}
          categoriesLoading={categoriesLoading}
          filteredCount={filteredEntities.length}
          totalCount={totalCount}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      ) : null}

      <div
        ref={containerRef}
        className="relative h-[min(70vh,720px)] min-h-[420px] overflow-auto rounded-md border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-sm dark:border-white/10 dark:from-slate-950 dark:to-slate-900"
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

        {showNoC0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <FolderTree className="size-10 text-foreground/30" />
            <p className="mt-3 text-sm font-semibold text-text-primary">
              No entities yet
            </p>
            <p className="mt-1 text-sm text-foreground/60">
              Add at least one C0 (ORG Level 0) entity, then attach C1 children
              under it to build the tree.
            </p>
          </div>
        ) : null}

        {showNoMatch ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <FolderTree className="size-10 text-foreground/30" />
            <p className="mt-3 text-sm font-semibold text-text-primary">
              No entities match the current filters
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : null}

        {showTree ? (
          <div
            className="origin-top-left p-5 transition-transform duration-200"
            style={{
              transform: `scale(${zoom})`,
              width: `${100 / zoom}%`,
            }}
          >
            <div className="flex items-start gap-4">
              {tree.map((root) => (
                <RootColumn
                  key={root.id}
                  root={root}
                  expandedIds={expandedIds}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
