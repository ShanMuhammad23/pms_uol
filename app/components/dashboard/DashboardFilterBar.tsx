"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Briefcase,
  Building2,
  ChevronDown,
  Hash,
  RotateCcw,
  Search,
  Users,
} from "lucide-react";
import { FilterChip, type FilterChipColor } from "@/app/components/dashboard/FilterChip";
import { itemVariants } from "@/app/helpers/dashboard-animations";
import { FORM_STATE_CONFIG } from "@/app/helpers/dashboard-form-state";
import type { FormState } from "@/app/helpers/dashboard-types";
import type { EntityRecord } from "@/types/entities";
import type { StaffCategoryWithSubCategories } from "@/types/staff-categories";
import { cn } from "@/lib/utils";

export interface ActiveFilter {
  label: string;
  onRemove: () => void;
  color: FilterChipColor;
}

interface DashboardFilterBarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedEntityId: number | "ALL";
  onEntityChange: (value: number | "ALL") => void;
  selectedCategoryId: number | "ALL";
  onCategoryChange: (value: number | "ALL") => void;
  selectedSubCategoryId: number | "ALL";
  onSubCategoryChange: (value: number | "ALL") => void;
  selectedFormState: FormState | "ALL";
  onFormStateChange: (value: FormState | "ALL") => void;
  sortedEntities: EntityRecord[];
  staffCategories: StaffCategoryWithSubCategories[];
  availableSubCategories: StaffCategoryWithSubCategories["subCategories"];
  entitiesLoading: boolean;
  staffCategoriesLoading: boolean;
  activeFilters: ActiveFilter[];
  onClearAllFilters: () => void;
}

export function DashboardFilterBar({
  searchQuery,
  onSearchQueryChange,
  selectedEntityId,
  onEntityChange,
  selectedCategoryId,
  onCategoryChange,
  selectedSubCategoryId,
  onSubCategoryChange,
  selectedFormState,
  onFormStateChange,
  sortedEntities,
  staffCategories,
  availableSubCategories,
  entitiesLoading,
  staffCategoriesLoading,
  activeFilters,
  onClearAllFilters,
}: DashboardFilterBarProps) {
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.55 }}
      className="mb-6 space-y-4"
    >
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden"
        >
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Name, ID, or email..."
                    value={searchQuery}
                    onChange={(e) => onSearchQueryChange(e.target.value)}
                    className={cn(
                      "w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400",
                      "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                      "dark:border-white/10 dark:bg-slate-950 dark:text-white",
                    )}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Entity
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={selectedEntityId === "ALL" ? "ALL" : String(selectedEntityId)}
                    onChange={(e) =>
                      onEntityChange(e.target.value === "ALL" ? "ALL" : Number(e.target.value))
                    }
                    disabled={entitiesLoading}
                    className={cn(
                      "w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-700",
                      "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300",
                    )}
                  >
                    <option value="ALL">All Entities</option>
                    {sortedEntities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.parentName
                          ? `${entity.name} (${entity.parentName})`
                          : entity.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Category
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={selectedCategoryId === "ALL" ? "ALL" : String(selectedCategoryId)}
                    onChange={(e) =>
                      onCategoryChange(e.target.value === "ALL" ? "ALL" : Number(e.target.value))
                    }
                    disabled={staffCategoriesLoading}
                    className={cn(
                      "w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-700",
                      "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300",
                    )}
                  >
                    <option value="ALL">All Categories</option>
                    {staffCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Sub-Category
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={selectedSubCategoryId === "ALL" ? "ALL" : String(selectedSubCategoryId)}
                    onChange={(e) =>
                      onSubCategoryChange(e.target.value === "ALL" ? "ALL" : Number(e.target.value))
                    }
                    disabled={staffCategoriesLoading || selectedCategoryId === "ALL"}
                    className={cn(
                      "w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-700",
                      "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300",
                    )}
                  >
                    <option value="ALL">All Sub-Categories</option>
                    {availableSubCategories.map((subCategory) => (
                      <option key={subCategory.id} value={subCategory.id}>
                        {subCategory.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Form State
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={selectedFormState}
                    onChange={(e) => onFormStateChange(e.target.value as FormState | "ALL")}
                    className={cn(
                      "w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-700",
                      "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                      "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300",
                    )}
                  >
                    <option value="ALL">All States</option>
                    {Object.entries(FORM_STATE_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {activeFilters.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-wrap items-center gap-2"
          >
            {activeFilters.map((filter, index) => (
              <FilterChip
                key={index}
                label={filter.label}
                onRemove={filter.onRemove}
                color={filter.color}
              />
            ))}
            <button
              onClick={onClearAllFilters}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400"
            >
              <RotateCcw className="h-3 w-3" />
              Clear All
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
