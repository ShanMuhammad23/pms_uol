"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Layers,
  Pencil,
  Percent,
  Plus,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { fetchFinancialYears } from "@/lib/queries/financial-years-client";
import { fetchPerformanceMatrix } from "@/lib/queries/performance-matrices-client";
import {
  createSubCategoryIncrementMatrix,
  deleteSubCategoryIncrementMatrix,
  fetchSubCategoryIncrementMatrices,
  updateSubCategoryIncrementMatrix,
} from "@/lib/queries/sub-category-increment-matrices-client";
import {
  CATEGORY_LABELS,
  CATEGORY_SUB_MAP,
  EMPLOYEE_CATEGORIES,
  SUB_CATEGORY_LABELS,
  type EmployeeCategory,
  type SubCategory,
} from "@/types/forms";
import type { SubCategoryIncrementMatrixRecord } from "@/types/sub-category-increment-matrices";

type MessageTone = "success" | "error";

interface FormMessage {
  tone: MessageTone;
  text: string;
}

export default function IncrementMatrixManager() {
  const queryClient = useQueryClient();

  /* ─── State ─── */
  const [selectedFinancialYearId, setSelectedFinancialYearId] = useState<
    number | null
  >(null);
  const [targetCategory, setTargetCategory] = useState<EmployeeCategory | "">(
    "",
  );
  const [matrixLabel, setMatrixLabel] = useState("Default");
  const [targetSubCategory, setTargetSubCategory] = useState<SubCategory | "">(
    "",
  );
  const [performanceLevelId, setPerformanceLevelId] = useState<number | "">(
    "",
  );
  const [performanceQuartileId, setPerformanceQuartileId] = useState<
    number | ""
  >("");
  const [incrementPercentage, setIncrementPercentage] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState<EmployeeCategory | "ALL">(
    "ALL",
  );
  const [editingEntry, setEditingEntry] =
    useState<SubCategoryIncrementMatrixRecord | null>(null);
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);

  /* ─── Data ─── */
  const { data: financialYears, isLoading: yearsLoading } = useQuery({
    queryKey: ["financial-years"],
    queryFn: fetchFinancialYears,
  });

  useEffect(() => {
    if (!selectedFinancialYearId && financialYears && financialYears.length > 0) {
      const activeYear =
        financialYears.find((year) => year.isActive) ?? financialYears[0];
      setSelectedFinancialYearId(activeYear.id);
    }
  }, [financialYears, selectedFinancialYearId]);

  const { data: performanceMatrix, isLoading: matrixLoading } = useQuery({
    queryKey: ["performance-matrix", selectedFinancialYearId],
    queryFn: () => fetchPerformanceMatrix(selectedFinancialYearId!),
    enabled: selectedFinancialYearId !== null,
  });

  const {
    data: entries,
    isLoading: entriesLoading,
    error: entriesError,
  } = useQuery({
    queryKey: ["sub-category-increment-matrices", selectedFinancialYearId],
    queryFn: () => fetchSubCategoryIncrementMatrices(selectedFinancialYearId!),
    enabled: selectedFinancialYearId !== null,
  });

  /* ─── Derived ─── */
  const subCategories = targetCategory ? CATEGORY_SUB_MAP[targetCategory] : [];
  const selectedLevel = performanceMatrix?.find(
    (level) => Number(level.id) === Number(performanceLevelId),
  );
  const quartileOptions = selectedLevel?.quartiles ?? [];

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    if (categoryFilter === "ALL") return entries;
    return entries.filter((entry) => entry.targetCategory === categoryFilter);
  }, [entries, categoryFilter]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { ALL: entries?.length ?? 0 };
    EMPLOYEE_CATEGORIES.forEach((cat) => {
      map[cat] =
        entries?.filter((e) => e.targetCategory === cat).length ?? 0;
    });
    return map;
  }, [entries]);

  const previewLabel = useMemo(() => {
    if (
      !targetCategory ||
      !targetSubCategory ||
      !selectedLevel ||
      !performanceQuartileId
    )
      return null;

    const quartile = quartileOptions.find(
      (item) => Number(item.id) === Number(performanceQuartileId),
    );
    if (!quartile) return null;

    return `${matrixLabel} · ${CATEGORY_LABELS[targetCategory]} · ${SUB_CATEGORY_LABELS[targetSubCategory]} · ${selectedLevel.name} · ${quartile.name} → ${incrementPercentage}%`;
  }, [
    matrixLabel,
    targetCategory,
    targetSubCategory,
    selectedLevel,
    performanceQuartileId,
    quartileOptions,
    incrementPercentage,
  ]);

  /* ─── Handlers ─── */
  const resetForm = () => {
    setMatrixLabel("Default");
    setTargetCategory("");
    setTargetSubCategory("");
    setPerformanceLevelId("");
    setPerformanceQuartileId("");
    setIncrementPercentage(10);
    setEditingEntry(null);
  };

  const invalidateEntries = () => {
    queryClient.invalidateQueries({
      queryKey: ["sub-category-increment-matrices", selectedFinancialYearId],
    });
  };

  const createMutation = useMutation({
    mutationFn: createSubCategoryIncrementMatrix,
    onSuccess: () => {
      setFormMessage({
        tone: "success",
        text: "Increment matrix entry created successfully.",
      });
      resetForm();
      invalidateEntries();
    },
    onError: (error: Error) => {
      setFormMessage({ tone: "error", text: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: Parameters<typeof updateSubCategoryIncrementMatrix>[1];
    }) => updateSubCategoryIncrementMatrix(id, input),
    onSuccess: () => {
      setFormMessage({
        tone: "success",
        text: "Increment matrix entry updated successfully.",
      });
      resetForm();
      invalidateEntries();
    },
    onError: (error: Error) => {
      setFormMessage({ tone: "error", text: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSubCategoryIncrementMatrix,
    onSuccess: () => {
      setFormMessage({
        tone: "success",
        text: "Increment matrix entry deleted successfully.",
      });
      if (editingEntry) resetForm();
      invalidateEntries();
    },
    onError: (error: Error) => {
      setFormMessage({ tone: "error", text: error.message });
    },
  });

  const handleCategoryChange = (category: EmployeeCategory) => {
    setTargetCategory(category);
    setTargetSubCategory("");
  };

  const handleLevelChange = (levelId: number) => {
    setPerformanceLevelId(levelId);
    setPerformanceQuartileId("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);

    if (!selectedFinancialYearId) {
      setFormMessage({ tone: "error", text: "Select a financial year first." });
      return;
    }

    if (
      !targetCategory ||
      !targetSubCategory ||
      !performanceLevelId ||
      !performanceQuartileId
    ) {
      setFormMessage({
        tone: "error",
        text: "Complete all category, level, and quartile selections.",
      });
      return;
    }

    const payload = {
      matrixLabel: matrixLabel.trim(),
      targetCategory,
      targetSubCategory,
      performanceLevelId,
      performanceQuartileId,
      incrementPercentage,
    };

    if (editingEntry) {
      updateMutation.mutate({
        id: editingEntry.id,
        input: { financialYearId: selectedFinancialYearId, ...payload },
      });
      return;
    }

    createMutation.mutate({
      financialYearId: selectedFinancialYearId,
      ...payload,
    });
  };

  const handleEdit = (entry: SubCategoryIncrementMatrixRecord) => {
    setEditingEntry(entry);
    setMatrixLabel(entry.matrixLabel);
    setTargetCategory(entry.targetCategory);
    setTargetSubCategory(entry.targetSubCategory);
    setPerformanceLevelId(entry.performanceLevelId);
    setPerformanceQuartileId(entry.performanceQuartileId);
    setIncrementPercentage(entry.incrementPercentage);
    setFormMessage(null);
  };

  const handleDelete = (entry: SubCategoryIncrementMatrixRecord) => {
    const confirmed = window.confirm(
      `Delete increment entry for ${CATEGORY_LABELS[entry.targetCategory]} / ${SUB_CATEGORY_LABELS[entry.targetSubCategory]} (${entry.performanceLevelName} · ${entry.performanceQuartileName})?`,
    );
    if (!confirmed) return;
    setFormMessage(null);
    deleteMutation.mutate(entry.id);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  /* ─── Render ─── */
  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      {/* ═══════ Top Control Bar (never scrolls) ═══════ */}
      <div className="shrink-0 space-y-4">
        {/* Header Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Increment Matrix Configuration
                </h2>
                <p className="mt-0.5 max-w-2xl text-sm text-foreground/60">
                  Define recommended increment percentages for each employee
                  category, sub-category, performance level, and quartile within
                  a financial year.
                </p>
              </div>
            </div>

            <div className="w-full shrink-0 sm:w-64">
              <label
                htmlFor="increment-financial-year"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/50"
              >
                Financial Year
              </label>
              <select
                id="increment-financial-year"
                value={selectedFinancialYearId ?? ""}
                onChange={(e) => {
                  setSelectedFinancialYearId(Number(e.target.value));
                  resetForm();
                  setFormMessage(null);
                }}
                disabled={yearsLoading || !financialYears?.length}
                className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
              >
                {!financialYears?.length ? (
                  <option value="">No financial years available</option>
                ) : (
                  financialYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.label} ({year.year})
                      {year.isActive ? " — Active" : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-foreground/40">
            Filter
          </span>
          <button
            type="button"
            onClick={() => setCategoryFilter("ALL")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              categoryFilter === "ALL"
                ? "bg-primary text-white shadow-sm"
                : "border border-slate-300 text-text-primary hover:bg-primary/10 dark:border-white/15"
            }`}
          >
            All
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                categoryFilter === "ALL"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-foreground/60 dark:bg-slate-800"
              }`}
            >
              {categoryCounts.ALL}
            </span>
          </button>
          {EMPLOYEE_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setCategoryFilter(category)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                categoryFilter === category
                  ? "bg-primary text-white shadow-sm"
                  : "border border-slate-300 text-text-primary hover:bg-primary/10 dark:border-white/15"
              }`}
            >
              {CATEGORY_LABELS[category]}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  categoryFilter === category
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-foreground/60 dark:bg-slate-800"
                }`}
              >
                {categoryCounts[category]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══════ Main Content Split ═══════ */}
      <div className="flex flex-1 min-h-0 flex-col gap-6 lg:flex-row">
        {/* ─── Left: Form (sticky feel, narrow column) ─── */}
        <div className="flex w-full flex-col gap-4 lg:w-[420px] lg:shrink-0 lg:overflow-y-auto lg:pr-1">
          <AnimatePresence mode="wait">
            {formMessage ? (
              <motion.div
                key={formMessage.text}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                  formMessage.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/30 dark:bg-emerald-950/20 dark:text-emerald-300"
                    : "border-red-200 bg-red-50 text-red-800 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-300"
                }`}
              >
                {formMessage.text}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  {editingEntry ? "Edit Entry" : "New Entry"}
                </h3>
              </div>
              {editingEntry ? (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setFormMessage(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                >
                  <X className="size-3" />
                  Cancel
                </button>
              ) : null}
            </div>

            {!matrixLoading &&
            performanceMatrix &&
            performanceMatrix.length === 0 ? (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                No performance levels are configured for this financial year.
                Define levels and quartiles in the{" "}
                <span className="font-medium">Matrices</span> tab first.
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="increment-matrix-label"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/60"
                >
                  Matrix Label
                </label>
                <input
                  id="increment-matrix-label"
                  value={matrixLabel}
                  onChange={(e) => setMatrixLabel(e.target.value)}
                  placeholder="e.g. Matrix A"
                  className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
                />
              </div>

              {/* Category */}
              <div>
                <label
                  htmlFor="increment-category"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/60"
                >
                  Employee Category
                </label>
                <select
                  id="increment-category"
                  value={targetCategory}
                  onChange={(e) =>
                    handleCategoryChange(e.target.value as EmployeeCategory)
                  }
                  disabled={!selectedFinancialYearId}
                  className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
                >
                  <option value="">Select category</option>
                  {EMPLOYEE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sub-Category */}
              <div>
                <label
                  htmlFor="increment-sub-category"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/60"
                >
                  Sub-Category
                </label>
                <select
                  id="increment-sub-category"
                  value={targetSubCategory}
                  onChange={(e) =>
                    setTargetSubCategory(e.target.value as SubCategory)
                  }
                  disabled={!targetCategory}
                  className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
                >
                  <option value="">Select sub-category</option>
                  {subCategories.map((subCategory) => (
                    <option key={subCategory} value={subCategory}>
                      {SUB_CATEGORY_LABELS[subCategory]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Performance Level */}
              <div>
                <label
                  htmlFor="increment-level"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/60"
                >
                  Performance Level
                </label>
                <select
                  id="increment-level"
                  value={performanceLevelId}
                  onChange={(e) => handleLevelChange(Number(e.target.value))}
                  disabled={!performanceMatrix?.length}
                  className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
                >
                  <option value="">Select performance level</option>
                  {performanceMatrix?.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quartile */}
              <div>
                <label
                  htmlFor="increment-quartile"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/60"
                >
                  Quartile
                </label>
                <select
                  id="increment-quartile"
                  value={performanceQuartileId}
                  onChange={(e) =>
                    setPerformanceQuartileId(Number(e.target.value))
                  }
                  disabled={!performanceLevelId}
                  className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
                >
                  <option value="">Select quartile</option>
                  {quartileOptions.map((quartile) => (
                    <option key={quartile.id} value={quartile.id}>
                      {quartile.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Percentage */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-2">
                  <Percent className="size-4 text-primary" />
                  <label
                    htmlFor="increment-percentage"
                    className="text-sm font-semibold text-text-primary"
                  >
                    Increment Percentage
                  </label>
                </div>
                <p className="mt-1 text-xs text-foreground/60">
                  Recommended salary increment from 1% to 100%.
                </p>

                <div className="mt-4 space-y-4">
                  <input
                    id="increment-percentage-range"
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={incrementPercentage}
                    onChange={(e) =>
                      setIncrementPercentage(Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                  <div className="flex items-center gap-3">
                    <input
                      id="increment-percentage"
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={incrementPercentage}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (!Number.isNaN(value)) {
                          setIncrementPercentage(
                            Math.min(100, Math.max(1, value)),
                          );
                        }
                      }}
                      className="w-20 rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
                    />
                    <span className="text-sm font-semibold text-foreground/70">
                      %
                    </span>
                  </div>
                </div>

                {previewLabel ? (
                  <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-text-primary">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Preview
                    </p>
                    <p className="mt-0.5 font-medium leading-snug">
                      {previewLabel}
                    </p>
                  </div>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={
                  !selectedFinancialYearId ||
                  isSubmitting ||
                  !performanceMatrix?.length
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-60"
              >
                {editingEntry ? (
                  <>
                    <Pencil className="size-4" />
                    Update Entry
                  </>
                ) : (
                  <>
                    <Plus className="size-4" />
                    Add Entry
                  </>
                )}
              </button>
            </form>
          </div>

          {!yearsLoading && !financialYears?.length ? (
            <p className="px-1 text-xs text-foreground/60">
              Need a financial year first? Configure one in the{" "}
              <Link
                href="/dashboard/matrices-and-cycles"
                className="text-primary hover:underline"
              >
                Financial Year
              </Link>{" "}
              tab.
            </p>
          ) : null}
        </div>

        {/* ─── Right: Table (independently scrollable) ─── */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">
                Configured Entries
              </h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {filteredEntries.length}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/50">
            {entriesLoading ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-foreground/60">
                  Loading increment entries…
                </p>
              </div>
            ) : null}

            {entriesError ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-red-600 dark:text-red-400">
                  Failed to load increment matrix entries.
                </p>
              </div>
            ) : null}

            {!entriesLoading && filteredEntries.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <Percent className="size-6 text-foreground/40" />
                </div>
                <p className="mt-3 text-sm font-semibold text-text-primary">
                  No increment entries yet
                </p>
                <p className="mt-1 text-sm text-foreground/60">
                  Add your first increment rule using the form on the left.
                </p>
              </div>
            ) : null}

            {!entriesLoading && filteredEntries.length > 0 ? (
              <div className="h-full overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm dark:bg-slate-800/95 dark:shadow-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground/70">
                        Matrix
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground/70">
                        Category
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground/70">
                        Sub-Category
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground/70">
                        Level
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground/70">
                        Quartile
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground/70">
                        Increment
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground/70">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                    {filteredEntries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="transition-colors hover:bg-slate-50/80 dark:hover:bg-white/5"
                      >
                        <td className="px-4 py-3 text-text-primary">
                          {entry.matrixLabel}
                        </td>
                        <td className="px-4 py-3 text-text-primary">
                          {CATEGORY_LABELS[entry.targetCategory]}
                        </td>
                        <td className="px-4 py-3 text-text-primary">
                          {SUB_CATEGORY_LABELS[entry.targetSubCategory]}
                        </td>
                        <td className="px-4 py-3 text-text-primary">
                          {entry.performanceLevelName}
                        </td>
                        <td className="px-4 py-3 text-text-primary">
                          {entry.performanceQuartileName}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                            {entry.incrementPercentage}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(entry)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-primary/10 hover:text-primary dark:border-white/15"
                            >
                              <Pencil className="size-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(entry)}
                              disabled={deleteMutation.isPending}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-60 dark:border-red-900/40"
                            >
                              <Trash2 className="size-3" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}