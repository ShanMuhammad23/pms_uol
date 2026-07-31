"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, Building2, IdCard, RotateCcw, Tags } from "lucide-react";
import { FilterChip, type FilterChipColor } from "@/app/components/dashboard/FilterChip";
import {
  MultiSelectFilterDropdown,
  type MultiSelectOption,
} from "@/app/components/dashboard/MultiSelectFilterDropdown";
import {
  ASSESSMENT_STATUS_OPTIONS,
  ENTITY_FILTER_LEVELS,
  type DirectAssessmentFilterState,
} from "@/app/queries/direct-assessment-filters";

interface ActiveDirectAssessmentFilter {
  label: string;
  onRemove: () => void;
  color: FilterChipColor;
}

interface DirectAssessmentFilterBarProps {
  filterState: DirectAssessmentFilterState;
  selectedDesignations: string[] | null;
  selectedRoleCategories: string[] | null;
  selectedAssessmentStatuses: string[] | null;
  selectedCategory0EntityIds: string[] | null;
  selectedCategory1EntityIds: string[] | null;
  selectedCategory2EntityIds: string[] | null;
  designationOptions: MultiSelectOption[];
  roleCategoryOptions: MultiSelectOption[];
  assessmentStatusOptions: MultiSelectOption[];
  category0Options: MultiSelectOption[];
  category1Options: MultiSelectOption[];
  category2Options: MultiSelectOption[];
  onDesignationChange: (values: string[] | null) => void;
  onRoleCategoryChange: (values: string[] | null) => void;
  onAssessmentStatusChange: (values: string[] | null) => void;
  onCategory0EntityChange: (values: string[] | null) => void;
  onCategory1EntityChange: (values: string[] | null) => void;
  onCategory2EntityChange: (values: string[] | null) => void;
  onClearAllFilters: () => void;
  onRemoveDesignation: () => void;
  onRemoveRoleCategory: () => void;
  onRemoveAssessmentStatus: () => void;
  onRemoveCategory0: () => void;
  onRemoveCategory1: () => void;
  onRemoveCategory2: () => void;
  hasActiveFilters: boolean;
}

function formatMultiChipLabel(
  prefix: string,
  selected: string[],
  resolveLabel: (value: string) => string,
): string {
  if (selected.length === 1) {
    return `${prefix}: ${resolveLabel(selected[0])}`;
  }
  return `${prefix}: ${selected.length} selected`;
}

export function DirectAssessmentFilterBar({
  filterState,
  selectedDesignations,
  selectedRoleCategories,
  selectedAssessmentStatuses,
  selectedCategory0EntityIds,
  selectedCategory1EntityIds,
  selectedCategory2EntityIds,
  designationOptions,
  roleCategoryOptions,
  assessmentStatusOptions,
  category0Options,
  category1Options,
  category2Options,
  onDesignationChange,
  onRoleCategoryChange,
  onAssessmentStatusChange,
  onCategory0EntityChange,
  onCategory1EntityChange,
  onCategory2EntityChange,
  onClearAllFilters,
  onRemoveDesignation,
  onRemoveRoleCategory,
  onRemoveAssessmentStatus,
  onRemoveCategory0,
  onRemoveCategory1,
  onRemoveCategory2,
  hasActiveFilters,
}: DirectAssessmentFilterBarProps) {
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

  const activeFilters: ActiveDirectAssessmentFilter[] = [];

  if (filterState.selectedCategory0EntityIds !== null) {
    activeFilters.push({
      label: formatMultiChipLabel(
        ENTITY_FILTER_LEVELS[0].label,
        filterState.selectedCategory0EntityIds.map(String),
        (value) =>
          category0Options.find((o) => o.value === value)?.label ?? value,
      ),
      onRemove: onRemoveCategory0,
      color: "slate",
    });
  }
  if (filterState.selectedCategory1EntityIds !== null) {
    activeFilters.push({
      label: formatMultiChipLabel(
        ENTITY_FILTER_LEVELS[1].label,
        filterState.selectedCategory1EntityIds.map(String),
        (value) =>
          category1Options.find((o) => o.value === value)?.label ?? value,
      ),
      onRemove: onRemoveCategory1,
      color: "slate",
    });
  }
  if (filterState.selectedCategory2EntityIds !== null) {
    activeFilters.push({
      label: formatMultiChipLabel(
        ENTITY_FILTER_LEVELS[2].label,
        filterState.selectedCategory2EntityIds.map(String),
        (value) =>
          category2Options.find((o) => o.value === value)?.label ?? value,
      ),
      onRemove: onRemoveCategory2,
      color: "slate",
    });
  }
  if (filterState.selectedRoleCategories !== null) {
    activeFilters.push({
      label: formatMultiChipLabel(
        "Role Category",
        filterState.selectedRoleCategories,
        (value) => value,
      ),
      onRemove: onRemoveRoleCategory,
      color: "amber",
    });
  }
  if (filterState.selectedDesignations !== null) {
    activeFilters.push({
      label: formatMultiChipLabel(
        "Designation",
        filterState.selectedDesignations,
        (value) => value,
      ),
      onRemove: onRemoveDesignation,
      color: "emerald",
    });
  }
  if (filterState.selectedAssessmentStatuses !== null) {
    activeFilters.push({
      label: formatMultiChipLabel(
        "Assessment Status",
        filterState.selectedAssessmentStatuses.map(String),
        (value) =>
          ASSESSMENT_STATUS_OPTIONS.find((o) => o.value === value)?.label ??
          value,
      ),
      onRemove: onRemoveAssessmentStatus,
      color: "orange",
    });
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="rounded-md border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
        <div className="border-t border-slate-200 px-4 pb-4 pt-3 dark:border-white/10">
          <div className="grid gap-3 grid-cols-[repeat(6,minmax(0,1fr))]">
            {ENTITY_FILTER_LEVELS.map((level, index) => (
              <MultiSelectFilterDropdown
                key={level.label}
                label={level.label}
                icon={Building2}
                options={entityOptions[index]}
                selectedValues={entitySelections[index]}
                onChange={entityHandlers[index]}
                disabled={
                  (index === 1 && selectedCategory0EntityIds?.length === 0) ||
                  (index === 2 && selectedCategory1EntityIds?.length === 0)
                }
                placeholder="All"
                searchable={entityOptions[index].length > 8}
              />
            ))}

            <MultiSelectFilterDropdown
              label="Role Category"
              icon={Tags}
              options={roleCategoryOptions}
              selectedValues={selectedRoleCategories}
              onChange={onRoleCategoryChange}
              placeholder="All"
              searchable={roleCategoryOptions.length > 8}
            />

            <MultiSelectFilterDropdown
              label="Designation"
              icon={IdCard}
              options={designationOptions}
              selectedValues={selectedDesignations}
              onChange={onDesignationChange}
              placeholder="All"
              searchable
            />

            <MultiSelectFilterDropdown
              label="Assessment Status"
              icon={Briefcase}
              options={assessmentStatusOptions}
              selectedValues={selectedAssessmentStatuses}
              onChange={onAssessmentStatusChange}
              placeholder="All"
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {hasActiveFilters && activeFilters.length > 0 ? (
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
    </div>
  );
}
