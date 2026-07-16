"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Briefcase,
  Building2,
  ChevronDown,
  IdCard,
  RotateCcw,
  Users,
} from "lucide-react";
import { Category0DistributionBar } from "@/app/components/dashboard/Category0DistributionBar";
import { FilterChip, type FilterChipColor } from "@/app/components/dashboard/FilterChip";
import {
  MultiSelectFilterDropdown,
  type MultiSelectOption,
} from "@/app/components/dashboard/MultiSelectFilterDropdown";
import { itemVariants } from "@/app/helpers/dashboard-animations";
import { ENTITY_FILTER_LEVELS } from "@/app/helpers/dashboard-entity-filters";
import { cn } from "@/lib/utils";

export interface ActiveFilter {
  label: string;
  onRemove: () => void;
  color: FilterChipColor;
}

interface DashboardFilterBarProps {
  selectedCategory0EntityIds: string[] | null;
  onCategory0EntityChange: (value: string[] | null) => void;
  selectedCategory1EntityIds: string[] | null;
  onCategory1EntityChange: (value: string[] | null) => void;
  selectedCategory2EntityIds: string[] | null;
  onCategory2EntityChange: (value: string[] | null) => void;
  category0Options: MultiSelectOption[];
  category1Options: MultiSelectOption[];
  category2Options: MultiSelectOption[];
  selectedCategoryIds: string[] | null;
  onStaffCategoryChange: (value: string[] | null) => void;
  selectedSubCategoryIds: string[] | null;
  onSubCategoryChange: (value: string[] | null) => void;
  staffCategoryOptions: MultiSelectOption[];
  staffSubCategoryOptions: MultiSelectOption[];
  selectedDesignations: string[] | null;
  onDesignationChange: (value: string[] | null) => void;
  designationOptions: MultiSelectOption[];
  designationsLoading: boolean;
  selectedFormStates: string[] | null;
  onFormStateChange: (value: string[] | null) => void;
  formStateOptions: MultiSelectOption[];
  entitiesLoading: boolean;
  staffCategoriesLoading: boolean;
  activeFilters: ActiveFilter[];
  onClearAllFilters: () => void;
}

export function DashboardFilterBar({
  selectedCategory0EntityIds,
  onCategory0EntityChange,
  selectedCategory1EntityIds,
  onCategory1EntityChange,
  selectedCategory2EntityIds,
  onCategory2EntityChange,
  category0Options,
  category1Options,
  category2Options,
  selectedCategoryIds,
  onStaffCategoryChange,
  staffCategoryOptions,
  selectedDesignations,
  onDesignationChange,
  designationOptions,
  designationsLoading,
  selectedFormStates,
  onFormStateChange,
  formStateOptions,
  entitiesLoading,
  staffCategoriesLoading,
  activeFilters,
  onClearAllFilters,
}: DashboardFilterBarProps) {
  const [filtersVisible, setFiltersVisible] = useState(true);

  const entitySelections = [
    selectedCategory0EntityIds,
    selectedCategory1EntityIds,
    selectedCategory2EntityIds,
  ];
  const entityOptions = [category0Options, category1Options, category2Options];
  const entityHandlers = [
    onCategory0EntityChange,
    onCategory1EntityChange,
    onCategory2EntityChange,
  ];

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.55 }}
      className="mb-6 space-y-4"
    >
      <div className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-center gap-3 px-4 py-2">
          <Category0DistributionBar options={category0Options} />
          <button
            type="button"
            onClick={() => setFiltersVisible((prev) => !prev)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
                <div className="flex flex-wrap gap-3">
                  {ENTITY_FILTER_LEVELS.map((level, index) => (
                    <MultiSelectFilterDropdown
                      key={level.label}
                      label={level.label}
                      icon={Building2}
                      options={entityOptions[index]}
                      selectedValues={entitySelections[index]}
                      onChange={entityHandlers[index]}
                      disabled={
                        entitiesLoading ||
                        (index === 1 && selectedCategory0EntityIds?.length === 0) ||
                        (index === 2 && selectedCategory1EntityIds?.length === 0)
                      }
                      placeholder={`All`}
                      searchable={entityOptions[index].length > 8}
                    />
                  ))}

                  <MultiSelectFilterDropdown
                    label="Staff Category"
                    icon={Users}
                    options={staffCategoryOptions}
                    selectedValues={selectedCategoryIds}
                    onChange={onStaffCategoryChange}
                    disabled={staffCategoriesLoading}
                    placeholder="All"
                  />

             

                  <MultiSelectFilterDropdown
                    label="Designation"
                    icon={IdCard}
                    options={designationOptions}
                    selectedValues={selectedDesignations}
                    onChange={onDesignationChange}
                    disabled={designationsLoading}
                    placeholder="All"
                    searchable
                  />

                  <MultiSelectFilterDropdown
                    label="Form Status"
                    icon={Briefcase}
                    options={formStateOptions}
                    selectedValues={selectedFormStates}
                    onChange={onFormStateChange}
                    placeholder="All"
                  />
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
