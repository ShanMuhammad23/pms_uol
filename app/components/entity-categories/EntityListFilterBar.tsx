"use client";

import { ChevronDown, RotateCcw, Search, Tag } from "lucide-react";
import type { EntityCategoryRecord } from "@/types/entity-categories";
import type { EntityCategoryCode } from "@/types/entity-categories";
import { cn } from "@/lib/utils";

interface EntityListFilterBarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedCategoryCode: EntityCategoryCode | "ALL";
  onCategoryCodeChange: (value: EntityCategoryCode | "ALL") => void;
  categories: EntityCategoryRecord[];
  categoriesLoading?: boolean;
  filteredCount: number;
  totalCount: number;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export function EntityListFilterBar({
  searchQuery,
  onSearchQueryChange,
  selectedCategoryCode,
  onCategoryCodeChange,
  categories,
  categoriesLoading = false,
  filteredCount,
  totalCount,
  onClearFilters,
  hasActiveFilters,
}: EntityListFilterBarProps) {
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              className={cn(
                "w-full appearance-none rounded-lg border border-slate-300 bg-background py-2 pl-10 pr-10 text-sm text-text-primary",
                "focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
                "dark:border-white/15",
              )}
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
      </div>
    </div>
  );
}
