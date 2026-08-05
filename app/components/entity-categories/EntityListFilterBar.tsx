"use client";

import { Building2, ChevronDown, RotateCcw, Search, Tag } from "lucide-react";
import {
  MultiSelectFilterDropdown,
  type MultiSelectOption,
} from "@/app/components/dashboard/MultiSelectFilterDropdown";
import type { EntityCategoryRecord } from "@/types/entity-categories";
import type { EntityCategoryCode } from "@/types/entity-categories";
import { cn } from "@/lib/utils";

interface EntityListFilterBarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedCategoryCode: EntityCategoryCode | "ALL";
  onCategoryCodeChange: (value: EntityCategoryCode | "ALL") => void;
  selectedEntityIds: string[] | null;
  onEntityIdsChange: (value: string[] | null) => void;
  selectedChildEntityIds: string[] | null;
  onChildEntityIdsChange: (value: string[] | null) => void;
  selectedParentEntityIds: string[] | null;
  onParentEntityIdsChange: (value: string[] | null) => void;
  entityOptions: MultiSelectOption[];
  childEntityOptions: MultiSelectOption[];
  parentEntityOptions: MultiSelectOption[];
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
  selectedEntityIds,
  onEntityIdsChange,
  selectedChildEntityIds,
  onChildEntityIdsChange,
  selectedParentEntityIds,
  onParentEntityIdsChange,
  entityOptions,
  childEntityOptions,
  parentEntityOptions,
  categories,
  categoriesLoading = false,
  filteredCount,
  totalCount,
  onClearFilters,
  hasActiveFilters,
}: EntityListFilterBarProps) {
  const categorySelected = selectedCategoryCode !== "ALL";
  const entitySelectionEmpty =
    selectedEntityIds !== null && selectedEntityIds.length === 0;

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
        <MultiSelectFilterDropdown
          label="Parent"
          icon={Building2}
          options={parentEntityOptions}
          selectedValues={selectedParentEntityIds}
          onChange={onParentEntityIdsChange}
          disabled={parentEntityOptions.length === 0}
          placeholder={
            parentEntityOptions.length === 0
              ? "No parent entities"
              : "All"
          }
          searchable={parentEntityOptions.length > 8}
        />
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

      

        <MultiSelectFilterDropdown
          label="Entity"
          icon={Building2}
          options={entityOptions}
          selectedValues={selectedEntityIds}
          onChange={onEntityIdsChange}
          disabled={!categorySelected || entityOptions.length === 0}
          placeholder={
            !categorySelected
              ? "Select a category first"
              : entityOptions.length === 0
                ? "No entities in category"
                : "All"
          }
          searchable={entityOptions.length > 8}
        />

        <MultiSelectFilterDropdown
          label="Child entity"
          icon={Building2}
          options={childEntityOptions}
          selectedValues={selectedChildEntityIds}
          onChange={onChildEntityIdsChange}
          disabled={
            !categorySelected ||
            entitySelectionEmpty ||
            childEntityOptions.length === 0
          }
          placeholder={
            !categorySelected
              ? "Select a category first"
              : entitySelectionEmpty
                ? "Select an entity first"
                : childEntityOptions.length === 0
                  ? "No child entities"
                  : "All"
          }
          searchable={childEntityOptions.length > 8}
        />
      </div>
    </div>
  );
}
