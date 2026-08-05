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
  { fill: string; text: string; ring: string }
> = {
  C0: {
    fill: "bg-slate-900 dark:bg-slate-800",
    text: "text-white",
    ring: "ring-slate-900/20 dark:ring-white/10",
  },
  C1: {
    fill: "bg-violet-100 dark:bg-violet-950/50",
    text: "text-violet-900 dark:text-violet-100",
    ring: "ring-violet-300/60 dark:ring-violet-700/40",
  },
  C2: {
    fill: "bg-sky-100 dark:bg-sky-950/50",
    text: "text-sky-900 dark:text-sky-100",
    ring: "ring-sky-300/60 dark:ring-sky-700/40",
  },
  C3: {
    fill: "bg-emerald-100 dark:bg-emerald-950/50",
    text: "text-emerald-900 dark:text-emerald-100",
    ring: "ring-emerald-300/60 dark:ring-emerald-700/40",
  },
};

const LINE = "border-slate-300 dark:border-slate-600";

function compareEntityNodes(a: EntityTreeNode, b: EntityTreeNode): number {
  const rankA = CATEGORY_RANK[a.categoryCode] ?? 99;
  const rankB = CATEGORY_RANK[b.categoryCode] ?? 99;
  if (rankA !== rankB) return rankA - rankB;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/**
 * Include every ancestor of each matched entity up to C0 so filtered views
 * still render nested under their real org parents.
 */
function collectEntitiesWithAncestors(
  matched: EntityRecord[],
  all: EntityRecord[],
): EntityRecord[] {
  if (matched.length === 0) return [];

  const byId = new Map(all.map((entity) => [entity.id, entity]));
  const included = new Map<number, EntityRecord>();

  for (const entity of matched) {
    let current: EntityRecord | undefined = entity;
    while (current) {
      if (included.has(current.id)) break;
      included.set(current.id, current);
      if (current.categoryCode === "C0" || current.parentEntityId == null) {
        break;
      }
      current = byId.get(current.parentEntityId);
    }
  }

  return [...included.values()];
}

function collectExpandableIds(nodes: EntityTreeNode[]): Set<number> {
  const ids = new Set<number>();
  const walk = (list: EntityTreeNode[]) => {
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

function buildEntityTree(entities: EntityRecord[]): EntityTreeNode[] {
  const byId = new Map<number, EntityTreeNode>();
  for (const entity of entities) {
    byId.set(entity.id, { ...entity, children: [] });
  }

  for (const node of byId.values()) {
    if (node.categoryCode === "C0") continue;

    const parentId = node.parentEntityId;
    if (parentId != null && byId.has(parentId) && parentId !== node.id) {
      byId.get(parentId)!.children.push(node);
    }
  }

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
  };
  const hasChildren = node.children.length > 0;
  const isC0 = node.categoryCode === "C0";

  return (
    <button
      type="button"
      onClick={hasChildren ? onToggle : undefined}
      disabled={!hasChildren}
      title={node.name}
      className={cn(
        "relative z-10 flex w-36 shrink-0 items-start gap-1 rounded-md px-2 py-1.5 text-left ring-1 transition-colors",
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
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </span>
      ) : (
        <span className="mt-0.5 size-3 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate font-semibold leading-tight",
            isC0 ? "text-xs" : "text-[11px]",
          )}
        >
          {node.name}
        </span>
        <span
          className={cn(
            "mt-px block text-[9px] font-medium leading-tight opacity-80",
            isC0 && "text-slate-300",
          )}
        >
          {node.categoryCode} · {node.staffCount}
          {hasChildren
            ? ` · ${node.children.length} child${node.children.length === 1 ? "" : "ren"}`
            : ""}
        </span>
      </span>
    </button>
  );
}

/**
 * Classic org-chart branch: parent on top, children below joined by
 * vertical + horizontal connector lines.
 */
function TreeBranch({
  node,
  expandedIds,
  onToggle,
  isRoot = false,
  isFirst = true,
  isLast = true,
  isOnly = true,
}: {
  node: EntityTreeNode;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  isRoot?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  isOnly?: boolean;
}) {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const showChildren = hasChildren && isExpanded;
  const childCount = node.children.length;

  return (
    <li
      className={cn(
        "relative flex list-none flex-col items-center px-2",
        isRoot ? "pt-0" : "pt-5",
      )}
    >
      {!isRoot ? (
        <>
          {/* Vertical stub from crossbar down to this card */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-1/2 top-0 h-5 w-px -translate-x-1/2 border-l",
              LINE,
            )}
          />
          {/* Horizontal elbow segment across siblings */}
          {!isOnly ? (
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-0 border-t",
                LINE,
                isFirst && "left-1/2 right-0",
                isLast && "left-0 right-1/2",
                !isFirst && !isLast && "left-0 right-0",
              )}
            />
          ) : null}
        </>
      ) : null}

      <EntityCard
        node={node}
        expanded={isExpanded}
        onToggle={() => onToggle(node.id)}
      />

      {showChildren ? (
        <>
          {/* Stem from parent down to the children row */}
          <span
            aria-hidden
            className={cn("mt-0 block h-4 w-px border-l", LINE)}
          />

          <ul
            className="relative flex list-none items-start justify-center p-0"
            role="group"
          >
            {node.children.map((child, index) => (
              <TreeBranch
                key={child.id}
                node={child}
                expandedIds={expandedIds}
                onToggle={onToggle}
                isFirst={index === 0}
                isLast={index === childCount - 1}
                isOnly={childCount === 1}
              />
            ))}
          </ul>
        </>
      ) : null}
    </li>
  );
}

function OrgTreeRoot({
  root,
  expandedIds,
  onToggle,
}: {
  root: EntityTreeNode;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
}) {
  return (
    <ul className="m-0 flex list-none justify-center p-0" role="tree">
      <TreeBranch
        node={root}
        expandedIds={expandedIds}
        onToggle={onToggle}
        isRoot
      />
    </ul>
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
        count: entity.staffCount,
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
        count: entity.staffCount,
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
      .map((e) => ({ value: String(e.id), label: e.name, count: e.staffCount }));
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

  const treeEntities = useMemo(
    () => collectEntitiesWithAncestors(filteredEntities, entities ?? []),
    [filteredEntities, entities],
  );

  const tree = useMemo(() => buildEntityTree(treeEntities), [treeEntities]);

  // Expand the visible forest when it changes. With filters active, expand every
  // ancestor path so matches stay linked under their parents up to C0.
  useEffect(() => {
    const signature = `${hasActiveFilters ? "f" : "a"}:${tree
      .map((root) => root.id)
      .join(",")}:${treeEntities.length}`;
    if (signature === treeSignatureRef.current) return;
    treeSignatureRef.current = signature;
    setExpandedIds(
      hasActiveFilters
        ? collectExpandableIds(tree)
        : new Set(tree.map((root) => root.id)),
    );
  }, [tree, treeEntities.length, hasActiveFilters]);

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
    !isLoading && !error && totalCount > 0 && filteredEntities.length === 0;
  const showNoC0 = !isLoading && !error && totalCount === 0;

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
              Top-down org chart: each parent sits above its children, joined by
              connector lines. Click a node to expand or collapse.
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
            selectedEntityIds === null ? null : selectedEntityIds.map(String)
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
            className="origin-top-left p-6 transition-transform duration-200"
            style={{
              transform: `scale(${zoom})`,
              width: `${100 / zoom}%`,
            }}
          >
            <div className="flex flex-wrap items-start justify-center gap-x-10 gap-y-12">
              {tree.map((root) => (
                <OrgTreeRoot
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
