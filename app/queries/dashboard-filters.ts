"use client";

import { useCallback, useMemo, useState } from "react";
import type { ActiveFilter } from "@/app/components/dashboard/DashboardFilterBar";
import { matchesSubmissionFilters } from "@/app/helpers/dashboard-filters";
import { FORM_STATE_CONFIG } from "@/app/helpers/dashboard-form-state";
import type { FormState } from "@/app/helpers/dashboard-types";
import type { EntityRecord } from "@/types/entities";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { StaffCategoryWithSubCategories } from "@/types/staff-categories";

interface UseDashboardFiltersParams {
  submissions: FormSubmissionListItem[];
  staffCategories: StaffCategoryWithSubCategories[];
  entities: EntityRecord[];
}

export function useDashboardFilters({
  submissions,
  staffCategories,
  entities,
}: UseDashboardFiltersParams) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState<number | "ALL">("ALL");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "ALL">("ALL");
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number | "ALL">("ALL");
  const [selectedFormState, setSelectedFormState] = useState<(FormState | "ALL")>("ALL");

  const selectedStaffCategory = useMemo(
    () =>
      selectedCategoryId === "ALL"
        ? null
        : staffCategories.find((category) => category.id === selectedCategoryId) ?? null,
    [selectedCategoryId, staffCategories],
  );

  const availableSubCategories = useMemo(
    () => selectedStaffCategory?.subCategories ?? [],
    [selectedStaffCategory],
  );

  const filteredSubmissions = useMemo(
    () =>
      submissions.filter((submission) =>
        matchesSubmissionFilters(submission, {
          searchQuery,
          selectedEntityId,
          selectedCategoryId,
          selectedSubCategoryId,
          selectedFormState,
          staffCategories,
          entities,
        }),
      ),
    [
      submissions,
      searchQuery,
      selectedEntityId,
      selectedCategoryId,
      selectedSubCategoryId,
      selectedFormState,
      staffCategories,
      entities,
    ],
  );

  const handleCategoryChange = useCallback((categoryId: number | "ALL") => {
    setSelectedCategoryId(categoryId);
    setSelectedSubCategoryId("ALL");
  }, []);

  const activeFilters = useMemo(() => {
    const filters: ActiveFilter[] = [];

    if (selectedEntityId !== "ALL") {
      const entity = entities.find((item) => item.id === selectedEntityId);
      filters.push({
        label: `Entity: ${entity?.name ?? selectedEntityId}`,
        onRemove: () => setSelectedEntityId("ALL"),
        color: "slate",
      });
    }

    if (selectedCategoryId !== "ALL") {
      const category = staffCategories.find((item) => item.id === selectedCategoryId);
      filters.push({
        label: `Category: ${category?.name ?? selectedCategoryId}`,
        onRemove: () => handleCategoryChange("ALL"),
        color: "amber",
      });
    }

    if (selectedSubCategoryId !== "ALL") {
      const subCategory = availableSubCategories.find((item) => item.id === selectedSubCategoryId);
      filters.push({
        label: `Sub-Category: ${subCategory?.name ?? selectedSubCategoryId}`,
        onRemove: () => setSelectedSubCategoryId("ALL"),
        color: "blue",
      });
    }

    if (selectedFormState !== "ALL") {
      filters.push({
        label: `State: ${FORM_STATE_CONFIG[selectedFormState].label}`,
        onRemove: () => setSelectedFormState("ALL"),
        color: "orange",
      });
    }

    if (searchQuery) {
      filters.push({
        label: `Search: "${searchQuery}"`,
        onRemove: () => setSearchQuery(""),
        color: "emerald",
      });
    }

    return filters;
  }, [
    selectedEntityId,
    selectedCategoryId,
    selectedSubCategoryId,
    selectedFormState,
    searchQuery,
    staffCategories,
    availableSubCategories,
    entities,
    handleCategoryChange,
  ]);

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedEntityId("ALL");
    setSelectedCategoryId("ALL");
    setSelectedSubCategoryId("ALL");
    setSelectedFormState("ALL");
  }, []);

  const filterByFormState = useCallback((state: FormState) => {
    setSelectedFormState((prev) => (prev === state ? "ALL" : state));
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    selectedEntityId,
    setSelectedEntityId,
    selectedCategoryId,
    selectedSubCategoryId,
    setSelectedSubCategoryId,
    selectedFormState,
    setSelectedFormState,
    availableSubCategories,
    filteredSubmissions,
    activeFilters,
    handleCategoryChange,
    clearAllFilters,
    filterByFormState,
  };
}
