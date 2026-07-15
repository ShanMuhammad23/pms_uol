"use client";

import { useCallback, useMemo, useState } from "react";
import type { ActiveFilter } from "@/app/components/dashboard/DashboardFilterBar";
import {
  ENTITY_FILTER_LEVELS,
  getEntitiesForFilterLevel,
} from "@/app/helpers/dashboard-entity-filters";
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
  const [selectedCategory0EntityId, setSelectedCategory0EntityId] = useState<
    number | "ALL"
  >("ALL");
  const [selectedCategory1EntityId, setSelectedCategory1EntityId] = useState<
    number | "ALL"
  >("ALL");
  const [selectedCategory2EntityId, setSelectedCategory2EntityId] = useState<
    number | "ALL"
  >("ALL");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "ALL">("ALL");
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number | "ALL">("ALL");
  const [selectedDesignation, setSelectedDesignation] = useState<string | "ALL">("ALL");
  const [selectedFormState, setSelectedFormState] = useState<(FormState | "ALL")>("ALL");

  const category0Entities = useMemo(
    () => getEntitiesForFilterLevel(entities, 0, null),
    [entities],
  );

  const category1Entities = useMemo(
    () =>
      selectedCategory0EntityId === "ALL"
        ? []
        : getEntitiesForFilterLevel(entities, 1, selectedCategory0EntityId),
    [entities, selectedCategory0EntityId],
  );

  const category2Entities = useMemo(
    () =>
      selectedCategory1EntityId === "ALL"
        ? []
        : getEntitiesForFilterLevel(entities, 2, selectedCategory1EntityId),
    [entities, selectedCategory1EntityId],
  );

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
          selectedCategory0EntityId,
          selectedCategory1EntityId,
          selectedCategory2EntityId,
          selectedCategoryId,
          selectedSubCategoryId,
          selectedDesignation,
          selectedFormState,
          staffCategories,
          entities,
        }),
      ),
    [
      submissions,
      searchQuery,
      selectedCategory0EntityId,
      selectedCategory1EntityId,
      selectedCategory2EntityId,
      selectedCategoryId,
      selectedSubCategoryId,
      selectedDesignation,
      selectedFormState,
      staffCategories,
      entities,
    ],
  );

  const handleCategory0EntityChange = useCallback((entityId: number | "ALL") => {
    setSelectedCategory0EntityId(entityId);
    setSelectedCategory1EntityId("ALL");
    setSelectedCategory2EntityId("ALL");
  }, []);

  const handleCategory1EntityChange = useCallback((entityId: number | "ALL") => {
    setSelectedCategory1EntityId(entityId);
    setSelectedCategory2EntityId("ALL");
  }, []);

  const handleStaffCategoryChange = useCallback((categoryId: number | "ALL") => {
    setSelectedCategoryId(categoryId);
    setSelectedSubCategoryId("ALL");
  }, []);

  const activeFilters = useMemo(() => {
    const filters: ActiveFilter[] = [];

    if (selectedCategory0EntityId !== "ALL") {
      const entity = entities.find((item) => item.id === selectedCategory0EntityId);
      filters.push({
        label: `${ENTITY_FILTER_LEVELS[0].label}: ${entity?.name ?? selectedCategory0EntityId}`,
        onRemove: () => handleCategory0EntityChange("ALL"),
        color: "slate",
      });
    }

    if (selectedCategory1EntityId !== "ALL") {
      const entity = entities.find((item) => item.id === selectedCategory1EntityId);
      filters.push({
        label: `${ENTITY_FILTER_LEVELS[1].label}: ${entity?.name ?? selectedCategory1EntityId}`,
        onRemove: () => handleCategory1EntityChange("ALL"),
        color: "slate",
      });
    }

    if (selectedCategory2EntityId !== "ALL") {
      const entity = entities.find((item) => item.id === selectedCategory2EntityId);
      filters.push({
        label: `${ENTITY_FILTER_LEVELS[2].label}: ${entity?.name ?? selectedCategory2EntityId}`,
        onRemove: () => setSelectedCategory2EntityId("ALL"),
        color: "slate",
      });
    }

    if (selectedCategoryId !== "ALL") {
      const category = staffCategories.find((item) => item.id === selectedCategoryId);
      filters.push({
        label: `Staff Category: ${category?.name ?? selectedCategoryId}`,
        onRemove: () => handleStaffCategoryChange("ALL"),
        color: "amber",
      });
    }

    if (selectedSubCategoryId !== "ALL") {
      const subCategory = availableSubCategories.find(
        (item) => item.id === selectedSubCategoryId,
      );
      filters.push({
        label: `Staff Sub-Category: ${subCategory?.name ?? selectedSubCategoryId}`,
        onRemove: () => setSelectedSubCategoryId("ALL"),
        color: "blue",
      });
    }

    if (selectedDesignation !== "ALL") {
      filters.push({
        label: `Designation: ${selectedDesignation}`,
        onRemove: () => setSelectedDesignation("ALL"),
        color: "emerald",
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
    selectedCategory0EntityId,
    selectedCategory1EntityId,
    selectedCategory2EntityId,
    selectedCategoryId,
    selectedSubCategoryId,
    selectedDesignation,
    selectedFormState,
    searchQuery,
    staffCategories,
    availableSubCategories,
    entities,
    handleCategory0EntityChange,
    handleCategory1EntityChange,
    handleStaffCategoryChange,
  ]);

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategory0EntityId("ALL");
    setSelectedCategory1EntityId("ALL");
    setSelectedCategory2EntityId("ALL");
    setSelectedCategoryId("ALL");
    setSelectedSubCategoryId("ALL");
    setSelectedDesignation("ALL");
    setSelectedFormState("ALL");
  }, []);

  const filterByFormState = useCallback((state: FormState) => {
    setSelectedFormState((prev) => (prev === state ? "ALL" : state));
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    selectedCategory0EntityId,
    selectedCategory1EntityId,
    selectedCategory2EntityId,
    setSelectedCategory2EntityId,
    selectedCategoryId,
    selectedSubCategoryId,
    setSelectedSubCategoryId,
    selectedDesignation,
    setSelectedDesignation,
    selectedFormState,
    setSelectedFormState,
    category0Entities,
    category1Entities,
    category2Entities,
    availableSubCategories,
    filteredSubmissions,
    activeFilters,
    handleCategory0EntityChange,
    handleCategory1EntityChange,
    handleStaffCategoryChange,
    clearAllFilters,
    filterByFormState,
  };
}
