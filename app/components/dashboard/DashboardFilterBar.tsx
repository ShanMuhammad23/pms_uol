"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Briefcase,
  Building2,
  ChevronDown,
  Hash,
  IdCard,
  RotateCcw,
  Users,
} from "lucide-react";
import { FilterChip, type FilterChipColor } from "@/app/components/dashboard/FilterChip";
import { itemVariants } from "@/app/helpers/dashboard-animations";
import { FORM_STATE_CONFIG } from "@/app/helpers/dashboard-form-state";
import { ENTITY_FILTER_LEVELS } from "@/app/helpers/dashboard-entity-filters";
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
  selectedCategory0EntityId: number | "ALL";
  onCategory0EntityChange: (value: number | "ALL") => void;
  selectedCategory1EntityId: number | "ALL";
  onCategory1EntityChange: (value: number | "ALL") => void;
  selectedCategory2EntityId: number | "ALL";
  onCategory2EntityChange: (value: number | "ALL") => void;
  category0Entities: EntityRecord[];
  category1Entities: EntityRecord[];
  category2Entities: EntityRecord[];
  selectedCategoryId: number | "ALL";
  onStaffCategoryChange: (value: number | "ALL") => void;
  selectedSubCategoryId: number | "ALL";
  onSubCategoryChange: (value: number | "ALL") => void;
  selectedDesignation: string | "ALL";
  onDesignationChange: (value: string | "ALL") => void;
  designations: string[];
  designationsLoading: boolean;
  selectedFormState: FormState | "ALL";
  onFormStateChange: (value: FormState | "ALL") => void;
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
  selectedCategory0EntityId,
  onCategory0EntityChange,
  selectedCategory1EntityId,
  onCategory1EntityChange,
  selectedCategory2EntityId,
  onCategory2EntityChange,
  category0Entities,
  category1Entities,
  category2Entities,
  selectedCategoryId,
  onStaffCategoryChange,
  selectedSubCategoryId,
  onSubCategoryChange,
  selectedDesignation,
  onDesignationChange,
  designations,
  designationsLoading,
  selectedFormState,
  onFormStateChange,
  staffCategories,
  availableSubCategories,
  entitiesLoading,
  staffCategoriesLoading,
  activeFilters,
  onClearAllFilters,
}: DashboardFilterBarProps) {
  const [filtersVisible, setFiltersVisible] = useState(true);

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.55 }}
      className="mb-6 space-y-4"
    >
      <div className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-center justify-end px-4 py-2">
          <button
            type="button"
            onClick={() => setFiltersVisible((prev) => !prev)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label={filtersVisible ? "Hide filters" : "Show filters"}
            aria-expanded={filtersVisible}
            title={filtersVisible ? "Hide filters" : "Show filters"}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-300",
                filtersVisible && "rotate-180",
              )}
            />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {filtersVisible ? (
            <motion.div
              key="filters-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="overflow-hidden"
            >
              <div className="border-t border-slate-200 px-4 pb-4 pt-3 dark:border-white/10">
                <div className="flex flex-wrap gap-2">
                 

             {ENTITY_FILTER_LEVELS.map((level, index) => {
                    const selectedId =
                      index === 0
                        ? selectedCategory0EntityId
                        : index === 1
                          ? selectedCategory1EntityId
                          : selectedCategory2EntityId;
                    const options =
                      index === 0
                        ? category0Entities
                        : index === 1
                          ? category1Entities
                          : category2Entities;
                    const onChange =
                      index === 0
                        ? onCategory0EntityChange
                        : index === 1
                          ? onCategory1EntityChange
                          : onCategory2EntityChange;
                    const disabled =
                      entitiesLoading ||
                      (index === 1 && selectedCategory0EntityId === "ALL") ||
                      (index === 2 && selectedCategory1EntityId === "ALL");

                    return (
                      <div key={level.label} className="space-y-1.5 flex-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {level.label}
                        </label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <select
                            value={selectedId === "ALL" ? "ALL" : String(selectedId)}
                            onChange={(event) =>
                              onChange(
                                event.target.value === "ALL"
                                  ? "ALL"
                                  : Number(event.target.value),
                              )
                            }
                            disabled={disabled}
                            className={cn(
                              "w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-700",
                              "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                              "disabled:cursor-not-allowed disabled:opacity-50",
                              "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300",
                            )}
                          >
                            <option value="ALL">All {level.label}</option>
                            {options.map((entity) => (
                              <option key={entity.id} value={entity.id}>
                                {entity.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>
                      </div>
                    );
                  })}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Staff Category
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select
                        value={selectedCategoryId === "ALL" ? "ALL" : String(selectedCategoryId)}
                        onChange={(e) =>
                          onStaffCategoryChange(
                            e.target.value === "ALL" ? "ALL" : Number(e.target.value),
                          )
                        }
                        disabled={staffCategoriesLoading}
                        className={cn(
                          "w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-700",
                          "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300",
                        )}
                      >
                        <option value="ALL">All Staff Categories</option>
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
                      Staff Sub-Category
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select
                        value={
                          selectedSubCategoryId === "ALL" ? "ALL" : String(selectedSubCategoryId)
                        }
                        onChange={(e) =>
                          onSubCategoryChange(
                            e.target.value === "ALL" ? "ALL" : Number(e.target.value),
                          )
                        }
                        disabled={staffCategoriesLoading || selectedCategoryId === "ALL"}
                        className={cn(
                          "w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-700",
                          "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300",
                        )}
                      >
                        <option value="ALL">All Staff Sub-Categories</option>
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
                      Designation
                    </label>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select
                        value={selectedDesignation}
                        onChange={(e) =>
                          onDesignationChange(
                            e.target.value === "ALL" ? "ALL" : e.target.value,
                          )
                        }
                        disabled={designationsLoading}
                        className={cn(
                          "w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-700",
                          "outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          "dark:border-white/10 dark:bg-slate-950 dark:text-slate-300",
                        )}
                      >
                        <option value="ALL">All Designations</option>
                        {designations.map((designation) => (
                          <option key={designation} value={designation}>
                            {designation}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Form Status
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
                        <option value="ALL">All Statuses</option>
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
          ) : null}
        </AnimatePresence>
      </div>

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
