"use client";

import { Building2, ChevronDown, RotateCcw, Search, Tag } from "lucide-react";
import type { EntityRecord } from "@/types/entities";
import type { EntityCategoryRecord } from "@/types/entity-categories";
import type { EntityCategoryCode } from "@/types/entity-categories";
import { cn } from "@/lib/utils";

interface EntityListFilterBarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedCategoryCode: EntityCategoryCode | "ALL";
  onCategoryCodeChange: (value: EntityCategoryCode | "ALL") => void;
  selectedEntityId: number | "ALL";
  onEntityIdChange: (value: number | "ALL") => void;
  selectedChildEntityId: number | "ALL";
  onChildEntityIdChange: (value: number | "ALL") => void;
  categoryEntityOptions: EntityRecord[];
  childEntityOptions: EntityRecord[];
  categories: EntityCategoryRecord[];
  categoriesLoading?: boolean;
  filteredCount: number;
  totalCount: number;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

const selectClassName = cn(
  "w-full appearance-none rounded-lg border border-slate-300 bg-background py-2 pl-10 pr-10 text-sm text-text-primary",
  "focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
  "dark:border-white/15",
);

export function EntityListFilterBar({
  searchQuery,
  onSearchQueryChange,
  selectedCategoryCode,
  onCategoryCodeChange,
  selectedEntityId,
  onEntityIdChange,
  selectedChildEntityId,
  onChildEntityIdChange,
  categoryEntityOptions,
  childEntityOptions,
  categories,
  categoriesLoading = false,
  filteredCount,
  totalCount,
  onClearFilters,
  hasActiveFilters,
}: EntityListFilterBarProps) {
  const categorySelected = selectedCategoryCode !== "ALL";
  const entitySelected = selectedEntityId !== "ALL";

  return (
    <div className="space-y-3 rounded-md border border-slate-300/80 p-4 dark:border-white/15">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/70">
          Showing {filteredCount} of {totalCount} entities
        </p>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
          >
            <RotateCcw className="size-3.5" />
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5">
          <label
            htmlFor="entity-list-search"
            className="text-xs font-semibold uppercase tracking-wider text-foreground/70"
          >
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/50" />
            <input
              id="entity-list-search"
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Name or parent..."
              className={cn(
                "w-full rounded-lg border border-slate-300 bg-background py-2 pl-10 pr-4 text-sm text-text-primary",
                "placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15",
              )}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="entity-list-category-code"
            className="text-xs font-semibold uppercase tracking-wider text-foreground/70"
          >
            Category
          </label>
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/50" />
            <select
              id="entity-list-category-code"
              value={selectedCategoryCode}
              onChange={(event) =>
                onCategoryCodeChange(
                  event.target.value === "ALL"
                    ? "ALL"
                    : (event.target.value as EntityCategoryCode),
                )
              }
              disabled={categoriesLoading}
              className={selectClassName}
            >
              <option value="ALL">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.code}>
                  {category.code}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-foreground/50" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="entity-list-entity"
            className="text-xs font-semibold uppercase tracking-wider text-foreground/70"
          >
            Entity
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/50" />
            <select
              id="entity-list-entity"
              value={selectedEntityId === "ALL" ? "ALL" : String(selectedEntityId)}
              onChange={(event) =>
                onEntityIdChange(
                  event.target.value === "ALL"
                    ? "ALL"
                    : Number(event.target.value),
                )
              }
              disabled={!categorySelected || categoryEntityOptions.length === 0}
              className={selectClassName}
            >
              <option value="ALL">
                {!categorySelected
                  ? "Select a category first"
                  : categoryEntityOptions.length === 0
                    ? "No entities in category"
                    : "All entities in category"}
              </option>
              {categoryEntityOptions.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-foreground/50" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="entity-list-child-entity"
            className="text-xs font-semibold uppercase tracking-wider text-foreground/70"
          >
            Child entity
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/50" />
            <select
              id="entity-list-child-entity"
              value={
                selectedChildEntityId === "ALL"
                  ? "ALL"
                  : String(selectedChildEntityId)
              }
              onChange={(event) =>
                onChildEntityIdChange(
                  event.target.value === "ALL"
                    ? "ALL"
                    : Number(event.target.value),
                )
              }
              disabled={!entitySelected || childEntityOptions.length === 0}
              className={selectClassName}
            >
              <option value="ALL">
                {!entitySelected
                  ? "Select an entity first"
                  : childEntityOptions.length === 0
                    ? "No child entities"
                    : "All child entities"}
              </option>
              {childEntityOptions.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name} ({entity.categoryCode})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-foreground/50" />
          </div>
        </div>
      </div>
    </div>
  );
}
