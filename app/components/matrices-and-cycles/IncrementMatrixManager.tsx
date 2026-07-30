"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Layers,
  Pencil,
  Percent,
  Plus,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { fetchFinancialYears } from "@/lib/queries/financial-years-client";
import { fetchPerformanceMatrix } from "@/lib/queries/performance-matrices-client";
import {
  assignIncrementMatrixToEmployees,
  createSubCategoryIncrementMatrix,
  deleteSubCategoryIncrementMatrix,
  fetchIncrementMatrixAssignments,
  fetchSubCategoryIncrementMatrices,
  unassignIncrementMatrixFromEmployees,
  updateSubCategoryIncrementMatrix,
} from "@/lib/queries/sub-category-increment-matrices-client";
import { fetchUsers } from "@/lib/queries/users-client";
import type { SubCategoryIncrementMatrixRecord } from "@/types/sub-category-increment-matrices";
import type { UserRecord } from "@/types/users";

type MessageTone = "success" | "error";

interface FormMessage {
  tone: MessageTone;
  text: string;
}

type RightPanel = "entries" | "assign";

export default function IncrementMatrixManager() {
  const queryClient = useQueryClient();

  /* ─── State ─── */
  const [selectedFinancialYearId, setSelectedFinancialYearId] = useState<
    number | null
  >(null);
  const [matrixLabel, setMatrixLabel] = useState("Default");
  const [performanceLevelId, setPerformanceLevelId] = useState<number | "">(
    "",
  );
  const [performanceQuartileId, setPerformanceQuartileId] = useState<
    number | ""
  >("");
  const [incrementPercentage, setIncrementPercentage] = useState(10);
  const [editingEntry, setEditingEntry] =
    useState<SubCategoryIncrementMatrixRecord | null>(null);
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);

  const [rightPanel, setRightPanel] = useState<RightPanel>("entries");

  // Assignment state
  const [selectedMatrixLabel, setSelectedMatrixLabel] = useState<string>("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  // Collapsed matrix groups in entries table
  const [collapsedMatrices, setCollapsedMatrices] = useState<Set<string>>(
    new Set(),
  );

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

  const { data: assignments } = useQuery({
    queryKey: ["increment-matrix-assignments", selectedFinancialYearId],
    queryFn: () => fetchIncrementMatrixAssignments(selectedFinancialYearId!),
    enabled: selectedFinancialYearId !== null,
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  /* ─── Derived ─── */
  const selectedLevel = performanceMatrix?.find(
    (level) => Number(level.id) === Number(performanceLevelId),
  );
  const quartileOptions = selectedLevel?.quartiles ?? [];

  const matrixLabels = useMemo(() => {
    if (!entries) return [];
    return [...new Set(entries.map((e) => e.matrixLabel))].sort();
  }, [entries]);

  // Entries grouped by matrix label
  const entriesByLabel = useMemo(() => {
    const map = new Map<string, SubCategoryIncrementMatrixRecord[]>();
    if (!entries) return map;
    for (const entry of entries) {
      const list = map.get(entry.matrixLabel) ?? [];
      list.push(entry);
      map.set(entry.matrixLabel, list);
    }
    return map;
  }, [entries]);

  useEffect(() => {
    if (!selectedMatrixLabel && matrixLabels.length > 0) {
      setSelectedMatrixLabel(matrixLabels[0]);
    }
  }, [matrixLabels, selectedMatrixLabel]);

  const assignedEmployeeIds = useMemo(() => {
    if (!assignments || !selectedMatrixLabel) return new Set<string>();
    return new Set(
      assignments
        .filter((a) => a.matrixLabel === selectedMatrixLabel)
        .map((a) => a.employeeCode),
    );
  }, [assignments, selectedMatrixLabel]);

  // Map of employeeCode -> matrixLabel for ALL assignments (not just selected matrix)
  const employeeToMatrixMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!assignments) return map;
    for (const a of assignments) {
      map.set(a.employeeCode, a.matrixLabel);
    }
    return map;
  }, [assignments]);

  // Selected employees who are already assigned to a DIFFERENT matrix
  const conflictingEmployees = useMemo(() => {
    if (!selectedMatrixLabel || selectedEmployeeIds.length === 0) return [];
    return selectedEmployeeIds.filter(
      (code) =>
        employeeToMatrixMap.has(code) &&
        employeeToMatrixMap.get(code) !== selectedMatrixLabel,
    );
  }, [selectedMatrixLabel, selectedEmployeeIds, employeeToMatrixMap]);

  const previewLabel = useMemo(() => {
    if (!selectedLevel || !performanceQuartileId) return null;

    const quartile = quartileOptions.find(
      (item) => Number(item.id) === Number(performanceQuartileId),
    );
    if (!quartile) return null;

    return `${matrixLabel} · ${selectedLevel.name} · ${quartile.name} → ${incrementPercentage}%`;
  }, [
    matrixLabel,
    selectedLevel,
    performanceQuartileId,
    quartileOptions,
    incrementPercentage,
  ]);

  /* ─── Handlers ─── */
  const resetForm = () => {
    setMatrixLabel("Default");
    setPerformanceLevelId("");
    setPerformanceQuartileId("");
    setIncrementPercentage(10);
    setEditingEntry(null);
  };

  const handleNewMatrix = () => {
    setMatrixLabel("");
    setPerformanceLevelId("");
    setPerformanceQuartileId("");
    setIncrementPercentage(10);
    setEditingEntry(null);
    setFormMessage(null);
  };

  const invalidateEntries = () => {
    queryClient.invalidateQueries({
      queryKey: ["sub-category-increment-matrices", selectedFinancialYearId],
    });
  };

  const invalidateAssignments = () => {
    queryClient.invalidateQueries({
      queryKey: ["increment-matrix-assignments", selectedFinancialYearId],
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

  const assignMutation = useMutation({
    mutationFn: assignIncrementMatrixToEmployees,
    onSuccess: (data) => {
      setFormMessage({
        tone: "success",
        text: `Assigned increment matrix to ${data.assignedCount} employee(s).`,
      });
      setSelectedEmployeeIds([]);
      invalidateAssignments();
    },
    onError: (error: Error) => {
      setFormMessage({ tone: "error", text: error.message });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: unassignIncrementMatrixFromEmployees,
    onSuccess: (data) => {
      setFormMessage({
        tone: "success",
        text: `Unassigned increment matrix from ${data.unassignedCount} employee(s).`,
      });
      setSelectedEmployeeIds([]);
      invalidateAssignments();
    },
    onError: (error: Error) => {
      setFormMessage({ tone: "error", text: error.message });
    },
  });

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

    if (!performanceLevelId || !performanceQuartileId) {
      setFormMessage({
        tone: "error",
        text: "Complete all level and quartile selections.",
      });
      return;
    }

    const payload = {
      matrixLabel: matrixLabel.trim(),
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
    setPerformanceLevelId(entry.performanceLevelId);
    setPerformanceQuartileId(entry.performanceQuartileId);
    setIncrementPercentage(entry.incrementPercentage);
    setFormMessage(null);
  };

  const handleDelete = (entry: SubCategoryIncrementMatrixRecord) => {
    const confirmed = window.confirm(
      `Delete increment entry for ${entry.performanceLevelName} · ${entry.performanceQuartileName} (${entry.incrementPercentage}%)?`,
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
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/50">
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
                  Define recommended increment percentages for each performance
                  level and quartile within a financial year, then assign them
                  to individual employees.
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
                  setSelectedMatrixLabel("");
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

          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  {editingEntry ? "Edit Entry" : "New Entry"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleNewMatrix}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  <Plus className="size-3" />
                  New Matrix
                </button>
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
                  list="existing-matrix-labels"
                  className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
                />
                <datalist id="existing-matrix-labels">
                  {matrixLabels.map((label) => (
                    <option key={label} value={label} />
                  ))}
                </datalist>
                <p className="mt-1 text-xs text-foreground/50">
                  Type a new label to create a new matrix, or pick an existing one to add another entry to it.
                </p>
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

        {/* ─── Right: Entries Table + Assignment Panel ─── */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          {/* Panel Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRightPanel("entries")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                rightPanel === "entries"
                  ? "bg-primary text-white shadow-sm"
                  : "border border-slate-300 text-text-primary hover:bg-primary/10 dark:border-white/15"
              }`}
            >
              <Layers className="size-4" />
              Matrices
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  rightPanel === "entries"
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-foreground/60 dark:bg-slate-800"
                }`}
              >
                {matrixLabels.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRightPanel("assign")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                rightPanel === "assign"
                  ? "bg-primary text-white shadow-sm"
                  : "border border-slate-300 text-text-primary hover:bg-primary/10 dark:border-white/15"
              }`}
            >
              <Users className="size-4" />
              Assign to Employees
            </button>
          </div>

          {/* Entries Table */}
          {rightPanel === "entries" ? (
            <div className="flex-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/50">
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

              {!entriesLoading && (entries?.length ?? 0) === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <Percent className="size-6 text-foreground/40" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-text-primary">
                    No increment matrices yet
                  </p>
                  <p className="mt-1 text-sm text-foreground/60">
                    Create your first increment matrix using the form on the left.
                  </p>
                </div>
              ) : null}

              {!entriesLoading && (entries?.length ?? 0) > 0 ? (
                <div className="h-full overflow-auto">
                  {matrixLabels.map((label) => {
                    const labelEntries = entriesByLabel.get(label) ?? [];
                    const isCollapsed = collapsedMatrices.has(label);
                    return (
                      <div key={label} className="border-b border-slate-200 last:border-b-0 dark:border-white/10">
                        {/* Matrix Header */}
                        <button
                          type="button"
                          onClick={() => {
                            setCollapsedMatrices((prev) => {
                              const next = new Set(prev);
                              if (next.has(label)) {
                                next.delete(label);
                              } else {
                                next.add(label);
                              }
                              return next;
                            });
                          }}
                          className="flex w-full items-center justify-between bg-slate-50/80 px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <ChevronRight className="size-4 text-foreground/50" />
                            ) : (
                              <ChevronDown className="size-4 text-foreground/50" />
                            )}
                            <Layers className="size-4 text-primary" />
                            <span className="text-sm font-bold text-text-primary">
                              {label}
                            </span>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              {labelEntries.length} entr{labelEntries.length === 1 ? "y" : "ies"}
                            </span>
                          </div>
                          <span className="text-xs text-foreground/50">
                            Click to {isCollapsed ? "expand" : "collapse"}
                          </span>
                        </button>

                        {/* Matrix Entries */}
                        {!isCollapsed ? (
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-white/10">
                                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-foreground/60">
                                  Level
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-foreground/60">
                                  Quartile
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-foreground/60">
                                  Increment
                                </th>
                                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-foreground/60">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                              {labelEntries.map((entry) => (
                                <tr
                                  key={entry.id}
                                  className="transition-colors hover:bg-slate-50/80 dark:hover:bg-white/5"
                                >
                                  <td className="px-4 py-2.5 text-text-primary">
                                    {entry.performanceLevelName}
                                  </td>
                                  <td className="px-4 py-2.5 text-text-primary">
                                    {entry.performanceQuartileName}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                                      {entry.incrementPercentage}%
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5">
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
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Assignment Panel */}
          {rightPanel === "assign" ? (
            <div className="flex-1 overflow-auto rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/50">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-text-primary">
                    Assign increment matrix to employees
                  </h3>
                  <p className="mt-1 text-sm text-foreground/70">
                    Select a matrix label, then choose employees to assign.
                    Each employee gets one increment matrix per financial year.
                  </p>
                </div>

                {/* Matrix Label Selector */}
                <div>
                  <label
                    htmlFor="assign-matrix-label"
                    className="mb-1.5 block text-sm font-medium text-text-primary"
                  >
                    Increment Matrix Label
                  </label>
                  <select
                    id="assign-matrix-label"
                    value={selectedMatrixLabel}
                    onChange={(e) => {
                      setSelectedMatrixLabel(e.target.value);
                      setSelectedEmployeeIds([]);
                    }}
                    disabled={!matrixLabels.length}
                    className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
                  >
                    {!matrixLabels.length ? (
                      <option value="">No increment matrices configured</option>
                    ) : (
                      matrixLabels.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {selectedMatrixLabel ? (
                  <div className="rounded-md border border-sky-200 bg-sky-50/50 px-4 py-3 dark:border-sky-500/30 dark:bg-sky-950/20">
                    <p className="text-xs font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300">
                      Assigning
                    </p>
                    <p className="mt-1 text-lg font-bold text-sky-900 dark:text-sky-100">
                      {selectedMatrixLabel}
                    </p>
                    <p className="mt-1 text-xs text-sky-600 dark:text-sky-400">
                      {assignments?.filter((a) => a.matrixLabel === selectedMatrixLabel).length ?? 0} employee(s) currently assigned
                    </p>
                  </div>
                ) : null}

                {/* Employee Selection */}
                <div>
                  <label
                    htmlFor="assign-employees"
                    className="mb-1.5 block text-sm font-medium text-text-primary"
                  >
                    Employees
                  </label>
                  <select
                    id="assign-employees"
                    multiple
                    value={selectedEmployeeIds}
                    onChange={(event) => {
                      const selected = Array.from(
                        event.currentTarget.selectedOptions,
                      ).map((option) => option.value);
                      setSelectedEmployeeIds(selected);
                    }}
                    className="min-h-48 w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
                  >
                    {(users ?? []).map((user: UserRecord) => {
                      const currentMatrix = employeeToMatrixMap.get(user.employeeId);
                      const isAssignedToThis = assignedEmployeeIds.has(user.employeeId);
                      const isAssignedToOther =
                        currentMatrix && currentMatrix !== selectedMatrixLabel;
                      return (
                        <option
                          key={user.id}
                          value={user.employeeId}
                          className={
                            isAssignedToThis
                              ? "font-semibold text-primary"
                              : isAssignedToOther
                                ? "text-amber-600"
                                : ""
                          }
                        >
                          {user.employeeId} -{" "}
                          {`${user.firstName} ${user.lastName}`.trim()}
                          {isAssignedToThis
                            ? " ✓"
                            : isAssignedToOther
                              ? ` (assigned to: ${currentMatrix})`
                              : ""}
                        </option>
                      );
                    })}
                  </select>
                  <p className="mt-1.5 text-xs text-foreground/60">
                    Hold Ctrl/Cmd to select multiple employees. ✓ = assigned to this matrix. Amber text = assigned to a different matrix (unassign first).
                    {selectedEmployeeIds.length > 0
                      ? ` ${selectedEmployeeIds.length} selected.`
                      : ""}
                  </p>
                </div>

                {/* Conflict Warning */}
                {conflictingEmployees.length > 0 ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    <p className="font-semibold">
                      {conflictingEmployees.length} employee(s) are already assigned to a different matrix.
                    </p>
                    <p className="mt-1">
                      Unassign them first before assigning to &ldquo;{selectedMatrixLabel}&rdquo;.
                      The server will reject this assignment otherwise.
                    </p>
                  </div>
                ) : null}

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={
                      !selectedFinancialYearId ||
                      !selectedMatrixLabel ||
                      selectedEmployeeIds.length === 0 ||
                      assignMutation.isPending
                    }
                    onClick={() => {
                      if (!selectedFinancialYearId || !selectedMatrixLabel) return;
                      setFormMessage(null);
                      assignMutation.mutate({
                        financialYearId: selectedFinancialYearId,
                        matrixLabel: selectedMatrixLabel,
                        employeeCodes: selectedEmployeeIds,
                      });
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    <UserCheck className="size-4" />
                    Assign selected employees
                  </button>

                  <button
                    type="button"
                    disabled={
                      !selectedFinancialYearId ||
                      selectedEmployeeIds.length === 0 ||
                      unassignMutation.isPending
                    }
                    onClick={() => {
                      if (!selectedFinancialYearId) return;
                      setFormMessage(null);
                      unassignMutation.mutate({
                        financialYearId: selectedFinancialYearId,
                        employeeCodes: selectedEmployeeIds,
                      });
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-500/10 disabled:opacity-60 dark:border-red-900/40"
                  >
                    <Trash2 className="size-4" />
                    Unassign selected
                  </button>
                </div>

                {/* Currently Assigned List */}
                {selectedMatrixLabel && assignments ? (
                  <div className="mt-4">
                    <h4 className="mb-2 text-sm font-semibold text-text-primary">
                      Currently Assigned to &ldquo;{selectedMatrixLabel}&rdquo;
                    </h4>
                    {assignments.filter((a) => a.matrixLabel === selectedMatrixLabel).length === 0 ? (
                      <p className="text-sm text-foreground/60">
                        No employees assigned to this matrix yet.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {assignments
                          .filter((a) => a.matrixLabel === selectedMatrixLabel)
                          .map((a) => (
                            <span
                              key={a.employeeId}
                              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-text-primary dark:border-white/10 dark:bg-white/5"
                            >
                              {a.employeeCode} — {a.firstName} {a.lastName}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
