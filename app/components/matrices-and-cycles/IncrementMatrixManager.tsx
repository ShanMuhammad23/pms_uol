"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Grid3X3, Percent, Plus, Trash2, UserCheck, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  getPerformanceLevelColor,
  getPerformanceLevelTint,
} from "@/app/helpers/dashboard-helpers";
import { DASHBOARD_QUERY_CACHE } from "@/app/queries/query-cache";
import { queryKeys } from "@/app/queries/keys";
import { fetchFinancialYears } from "@/lib/queries/financial-years-client";
import {
  fetchPerformanceMatrix,
  fetchPerformanceMatrixLabels,
} from "@/lib/queries/performance-matrices-client";
import {
  assignIncrementMatrixToEmployees,
  createSubCategoryIncrementMatrix,
  deleteSubCategoryIncrementMatrix,
  fetchIncrementMatrixAssignments,
  fetchSubCategoryIncrementMatrices,
  updateSubCategoryIncrementMatrix,
} from "@/lib/queries/sub-category-increment-matrices-client";
import { fetchUsers } from "@/lib/queries/users-client";
import { cn } from "@/lib/utils";
import type { SubCategoryIncrementMatrixRecord } from "@/types/sub-category-increment-matrices";
import type {
  PerformanceLevelWithQuartiles,
  PerformanceQuartileRecord,
} from "@/types/performance-matrices";
import PerformanceMatrixGrid from "./PerformanceMatrixGrid";

type MessageTone = "success" | "error";
type MatricesPanel = "overview" | "assign" | "add-matrix";

interface FormMessage {
  tone: MessageTone;
  text: string;
}

const panels: Array<{
  id: MatricesPanel;
  label: string;
  icon: typeof Grid3X3;
}> = [
  { id: "overview", label: "Overview", icon: Grid3X3 },
  { id: "assign", label: "Assign", icon: UserCheck },
  { id: "add-matrix", label: "Add Matrix", icon: Plus },
];

function formatIncrementPercent(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/, "");
}

export default function IncrementMatrixManager() {
  const queryClient = useQueryClient();
  const [selectedFinancialYearId, setSelectedFinancialYearId] = useState<
    number | null
  >(null);
  const [activePanel, setActivePanel] = useState<MatricesPanel>("overview");
  const [selectedMatrixLabel, setSelectedMatrixLabel] = useState("Default");
  const [newMatrixLabel, setNewMatrixLabel] = useState("");
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
  const [selectedQuartileId, setSelectedQuartileId] = useState<number | null>(
    null,
  );
  const [percentDialogOpen, setPercentDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] =
    useState<PerformanceLevelWithQuartiles | null>(null);
  const [editingQuartile, setEditingQuartile] =
    useState<PerformanceQuartileRecord | null>(null);
  const [incrementPercentage, setIncrementPercentage] = useState(10);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  const { data: financialYears } = useQuery({
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

  const {
    data: performanceMatrix,
    isLoading: matrixLoading,
    error: matrixError,
  } = useQuery({
    queryKey: [
      "performance-matrix",
      selectedFinancialYearId,
      selectedMatrixLabel,
    ],
    queryFn: () =>
      fetchPerformanceMatrix(
        selectedFinancialYearId!,
        selectedMatrixLabel || undefined,
      ),
    enabled: selectedFinancialYearId !== null,
  });

  const { data: performanceMatrixLabels } = useQuery({
    queryKey: ["performance-matrix-labels", selectedFinancialYearId],
    queryFn: () => fetchPerformanceMatrixLabels(selectedFinancialYearId!),
    enabled: selectedFinancialYearId !== null,
  });

  const {
    data: entries,
    isLoading: entriesLoading,
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
    queryKey: queryKeys.users,
    queryFn: fetchUsers,
    ...DASHBOARD_QUERY_CACHE,
  });

  const incrementLabels = useMemo(() => {
    if (!entries) return [];
    return [...new Set(entries.map((entry) => entry.matrixLabel))].sort(
      (a, b) => a.localeCompare(b),
    );
  }, [entries]);

  const matrixOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...(performanceMatrixLabels ?? []),
          ...incrementLabels,
          "Default",
        ]),
      ).sort((a, b) => a.localeCompare(b)),
    [performanceMatrixLabels, incrementLabels],
  );

  const entriesForLabel = useMemo(() => {
    if (!entries) return [];
    return entries.filter((entry) => entry.matrixLabel === selectedMatrixLabel);
  }, [entries, selectedMatrixLabel]);

  const percentageByQuartileId = useMemo(() => {
    const map = new Map<number, SubCategoryIncrementMatrixRecord>();
    for (const entry of entriesForLabel) {
      map.set(entry.performanceQuartileId, entry);
    }
    return map;
  }, [entriesForLabel]);

  const totalQuartiles = useMemo(
    () =>
      performanceMatrix?.reduce(
        (sum, level) => sum + level.quartiles.length,
        0,
      ) ?? 0,
    [performanceMatrix],
  );

  const filledCells = entriesForLabel.length;

  const selectedLevel = performanceMatrix?.find(
    (level) => level.id === selectedLevelId,
  );
  const selectedLevelIndex =
    performanceMatrix?.findIndex((level) => level.id === selectedLevelId) ?? -1;

  const invalidateEntries = () => {
    void queryClient.invalidateQueries({
      queryKey: ["sub-category-increment-matrices", selectedFinancialYearId],
    });
  };

  const invalidateAssignments = () => {
    void queryClient.invalidateQueries({
      queryKey: ["increment-matrix-assignments", selectedFinancialYearId],
    });
  };

  const closePercentDialog = () => {
    setPercentDialogOpen(false);
    setDialogError(null);
    setEditingLevel(null);
    setEditingQuartile(null);
  };

  const openPercentDialog = (
    level: PerformanceLevelWithQuartiles,
    quartile: PerformanceQuartileRecord,
  ) => {
    const existing = percentageByQuartileId.get(quartile.id);
    setEditingLevel(level);
    setEditingQuartile(quartile);
    setSelectedLevelId(level.id);
    setSelectedQuartileId(quartile.id);
    setIncrementPercentage(existing?.incrementPercentage ?? 10);
    setDialogError(null);
    setFormMessage(null);
    setPercentDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: createSubCategoryIncrementMatrix,
    onSuccess: () => {
      setFormMessage({
        tone: "success",
        text: "Increment percentage saved.",
      });
      closePercentDialog();
      invalidateEntries();
    },
    onError: (error: Error) => {
      setDialogError(error.message);
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
        text: "Increment percentage updated.",
      });
      closePercentDialog();
      invalidateEntries();
    },
    onError: (error: Error) => {
      setDialogError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSubCategoryIncrementMatrix,
    onSuccess: () => {
      setFormMessage({
        tone: "success",
        text: "Increment percentage cleared.",
      });
      closePercentDialog();
      invalidateEntries();
    },
    onError: (error: Error) => {
      setDialogError(error.message);
    },
  });

  const assignMutation = useMutation({
    mutationFn: assignIncrementMatrixToEmployees,
    onSuccess: (data) => {
      setFormMessage({
        tone: "success",
        text: `Increment matrix "${data.matrixLabel}" assigned to ${data.assignedCount} employees.`,
      });
      setSelectedEmployeeIds([]);
      invalidateAssignments();
    },
    onError: (error: Error) => {
      setFormMessage({ tone: "error", text: error.message });
    },
  });

  const handlePercentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDialogError(null);

    if (!selectedFinancialYearId || !editingLevel || !editingQuartile) {
      setDialogError("Select a quartile cell first.");
      return;
    }

    if (
      !Number.isFinite(incrementPercentage) ||
      incrementPercentage < 1 ||
      incrementPercentage > 100
    ) {
      setDialogError("Increment percentage must be between 1 and 100.");
      return;
    }

    const existing = percentageByQuartileId.get(editingQuartile.id);
    const payload = {
      matrixLabel: selectedMatrixLabel.trim(),
      performanceLevelId: editingLevel.id,
      performanceQuartileId: editingQuartile.id,
      incrementPercentage: Math.round(incrementPercentage * 100) / 100,
    };

    if (existing) {
      updateMutation.mutate({
        id: existing.id,
        input: { financialYearId: selectedFinancialYearId, ...payload },
      });
      return;
    }

    createMutation.mutate({
      financialYearId: selectedFinancialYearId,
      ...payload,
    });
  };

  const handleClearPercentage = () => {
    if (!editingQuartile) return;
    const existing = percentageByQuartileId.get(editingQuartile.id);
    if (!existing) {
      closePercentDialog();
      return;
    }

    const confirmed = window.confirm(
      `Clear increment for ${editingLevel?.name ?? "level"} · ${editingQuartile.name}?`,
    );
    if (!confirmed) return;
    deleteMutation.mutate(existing.id);
  };

  const handleCreateMatrixLabel = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const label = newMatrixLabel.trim();
    if (!label) {
      setFormMessage({ tone: "error", text: "Matrix label is required." });
      return;
    }

    if (
      matrixOptions.some((option) => option.toLowerCase() === label.toLowerCase())
    ) {
      setFormMessage({
        tone: "error",
        text: `Matrix "${label}" already exists for this financial year.`,
      });
      return;
    }

    setSelectedMatrixLabel(label);
    setNewMatrixLabel("");
    setSelectedLevelId(null);
    setSelectedQuartileId(null);
    setActivePanel("overview");
    setFormMessage({
      tone: "success",
      text: `Increment matrix "${label}" ready. Click quartile cells to set percentages.`,
    });
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const assignedCount =
    assignments?.filter((row) => row.matrixLabel === selectedMatrixLabel)
      .length ?? 0;

  return (
    <div className="space-y-5">
      <AnimatePresence>
        {formMessage ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={cn(
              "overflow-hidden rounded-md border px-4 py-3 text-sm font-medium",
              formMessage.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/30 dark:bg-emerald-950/20 dark:text-emerald-300"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-300",
            )}
          >
            {formMessage.text}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="rounded-md border border-slate-300/80 dark:border-white/15">
        <div className="flex flex-wrap gap-1 border-b border-slate-300/80 p-2 dark:border-white/15">
          {panels.map((panel) => {
            const Icon = panel.icon;
            const isActive = activePanel === panel.id;

            return (
              <button
                key={panel.id}
                type="button"
                onClick={() => {
                  setActivePanel(panel.id);
                  if (panel.id === "add-matrix") {
                    setNewMatrixLabel("");
                    setFormMessage(null);
                  }
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-primary text-white shadow-sm"
                    : "text-foreground/70 hover:bg-primary/10 hover:text-text-primary",
                )}
              >
                <Icon className="size-4" />
                {panel.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {activePanel === "overview" ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-slate-300/80 bg-background px-3 py-2.5 dark:border-white/15">
                  <label
                    htmlFor="increment-financial-year"
                    className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground/60"
                  >
                    Financial Year
                  </label>
                  <select
                    id="increment-financial-year"
                    value={selectedFinancialYearId ?? ""}
                    onChange={(event) => {
                      setSelectedFinancialYearId(Number(event.target.value));
                      setSelectedMatrixLabel("Default");
                      setSelectedLevelId(null);
                      setSelectedQuartileId(null);
                      setFormMessage(null);
                    }}
                    disabled={!financialYears?.length}
                    className="w-full rounded-lg border border-slate-300 bg-background px-2.5 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
                  >
                    {!financialYears?.length ? (
                      <option value="">No financial years available</option>
                    ) : (
                      financialYears.map((year) => (
                        <option key={year.id} value={year.id}>
                          {year.label}
                          {year.isActive ? " — Active" : ""}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="rounded-md border border-slate-300/80 bg-background px-3 py-2.5 dark:border-white/15">
                  <label
                    htmlFor="increment-matrix-label"
                    className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground/60"
                  >
                    Matrix
                  </label>
                  <select
                    id="increment-matrix-label"
                    value={selectedMatrixLabel}
                    onChange={(event) => {
                      setSelectedMatrixLabel(event.target.value);
                      setSelectedLevelId(null);
                      setSelectedQuartileId(null);
                      setFormMessage(null);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-background px-2.5 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
                  >
                    {matrixOptions.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-md border border-violet-200 bg-violet-50/70 px-4 py-3 dark:border-violet-500/30 dark:bg-violet-950/20">
                  <p className="text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    Levels
                  </p>
                  <p className="mt-1 text-2xl font-bold text-violet-900 dark:text-violet-100">
                    {performanceMatrix?.length ?? 0}
                  </p>
                </div>

                <div className="rounded-md border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-950/20">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    % Set
                  </p>
                  <p className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                    {filledCells}
                    <span className="ml-1 text-sm font-medium text-emerald-700/70 dark:text-emerald-300/70">
                      / {totalQuartiles}
                    </span>
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">
                      Combined matrix
                    </h3>
                    <p className="text-sm text-foreground/70">
                      Same layout as the Performance Matrix — click a quartile
                      cell to set its increment percentage.
                    </p>
                  </div>
                </div>

                {matrixLoading || entriesLoading ? (
                  <p className="text-sm text-foreground/70">
                    Loading increment matrix…
                  </p>
                ) : matrixError ? (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Failed to load performance matrix structure.
                  </p>
                ) : !performanceMatrix?.length ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    No performance levels for matrix &quot;{selectedMatrixLabel}
                    &quot;. Configure levels and quartiles in the{" "}
                    <span className="font-medium">Performance Matrix</span> tab
                    first (same matrix label).
                  </div>
                ) : (
                  <PerformanceMatrixGrid
                    levels={performanceMatrix}
                    selectedLevelId={selectedLevelId}
                    selectedQuartileId={selectedQuartileId}
                    emptyHint="No performance levels for this matrix"
                    onSelectLevel={(levelId) => {
                      setSelectedLevelId(levelId);
                      setFormMessage(null);
                    }}
                    onSelectCell={openPercentDialog}
                    getCellValue={(quartile) => {
                      const entry = percentageByQuartileId.get(quartile.id);
                      if (!entry) {
                        return (
                          <span className="italic text-white/70">Set %</span>
                        );
                      }
                      return `${formatIncrementPercent(entry.incrementPercentage)}%`;
                    }}
                  />
                )}
              </div>

              {selectedLevel ? (
                <div
                  className={cn(
                    "rounded-md border p-4",
                    getPerformanceLevelTint(
                      selectedLevel.name,
                      Math.max(selectedLevelIndex, 0),
                    ),
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide opacity-70">
                        Selected level
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={cn(
                            "size-2.5 rounded-full",
                            getPerformanceLevelColor(
                              selectedLevel.name,
                              Math.max(selectedLevelIndex, 0),
                            ),
                          )}
                        />
                        <p className="text-base font-semibold">
                          {selectedLevel.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedLevel.quartiles.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedLevel.quartiles.map((quartile) => {
                        const entry = percentageByQuartileId.get(quartile.id);
                        return (
                          <button
                            key={quartile.id}
                            type="button"
                            onClick={() =>
                              openPercentDialog(selectedLevel, quartile)
                            }
                            className={cn(
                              "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition",
                              selectedQuartileId === quartile.id
                                ? "border-primary bg-primary/10"
                                : "border-slate-300/80 bg-background/80 hover:bg-primary/5 dark:border-white/15",
                            )}
                          >
                            <span className="font-semibold text-text-primary">
                              {quartile.name}
                            </span>
                            <span className="tabular-nums text-foreground/70">
                              {entry
                                ? `${formatIncrementPercent(entry.incrementPercentage)}%`
                                : "Set %"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm opacity-80">
                      No quartiles on this level yet.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {activePanel === "assign" ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  Assign matrix to employees
                </h3>
                <p className="mt-1 text-sm text-foreground/70">
                  Map employees to the currently selected increment matrix
                  label.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-sky-200 bg-sky-50/50 px-4 py-3 dark:border-sky-500/30 dark:bg-sky-950/20">
                  <p className="text-xs font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300">
                    Assigning
                  </p>
                  <p className="mt-1 text-lg font-bold text-sky-900 dark:text-sky-100">
                    {selectedMatrixLabel}
                  </p>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50/50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-950/20">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Currently assigned
                  </p>
                  <p className="mt-1 text-lg font-bold text-emerald-900 dark:text-emerald-100">
                    {assignedCount}
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="increment-assign-employees"
                  className="mb-1.5 block text-sm font-medium text-text-primary"
                >
                  Employees
                </label>
                <select
                  id="increment-assign-employees"
                  multiple
                  value={selectedEmployeeIds}
                  onChange={(event) => {
                    const selected = Array.from(
                      event.currentTarget.selectedOptions,
                    ).map((option) => option.value);
                    setSelectedEmployeeIds(selected);
                  }}
                  className="min-h-40 w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
                >
                  {(users ?? []).map((user) => (
                    <option key={user.id} value={user.employeeId}>
                      {user.employeeId} -{" "}
                      {`${user.firstName} ${user.lastName}`.trim()}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-foreground/60">
                  Hold Ctrl/Cmd to select multiple employees.
                  {selectedEmployeeIds.length > 0
                    ? ` ${selectedEmployeeIds.length} selected.`
                    : ""}
                </p>
              </div>

              <button
                type="button"
                disabled={
                  !selectedFinancialYearId ||
                  selectedEmployeeIds.length === 0 ||
                  assignMutation.isPending
                }
                onClick={() => {
                  if (!selectedFinancialYearId) return;
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
            </div>
          ) : null}

          {activePanel === "add-matrix" ? (
            <div className="mx-auto max-w-lg space-y-4">
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  Add increment matrix
                </h3>
                <p className="mt-1 text-sm text-foreground/70">
                  Create a new increment matrix label for the selected financial
                  year. Use the same label as a Performance Matrix to inherit
                  its levels and quartiles.
                </p>
              </div>

              <div className="rounded-md border border-slate-300/80 bg-slate-50/50 p-5 dark:border-white/15 dark:bg-white/5">
                <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2 dark:border-sky-500/30 dark:bg-sky-950/20">
                  <p className="text-xs font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300">
                    Financial year
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-sky-900 dark:text-sky-100">
                    {financialYears?.find(
                      (year) => year.id === selectedFinancialYearId,
                    )?.label ?? "Select a financial year first"}
                  </p>
                </div>

                <form onSubmit={handleCreateMatrixLabel} className="space-y-4">
                  <div>
                    <label
                      htmlFor="new-increment-matrix-label"
                      className="mb-1.5 block text-sm font-medium text-text-primary"
                    >
                      Matrix Label
                    </label>
                    <input
                      id="new-increment-matrix-label"
                      value={newMatrixLabel}
                      onChange={(event) => setNewMatrixLabel(event.target.value)}
                      placeholder="e.g. Academic"
                      className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!selectedFinancialYearId || !newMatrixLabel.trim()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    <Plus className="size-4" />
                    Create matrix label
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {percentDialogOpen && editingLevel && editingQuartile ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
            onClick={closePercentDialog}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="w-full max-w-md rounded-md border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                    Increment percentage
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-text-primary">
                    {editingLevel.name} · {editingQuartile.name}
                  </h3>
                  <p className="mt-0.5 text-sm text-foreground/60">
                    Matrix &quot;{selectedMatrixLabel}&quot;
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePercentDialog}
                  className="rounded-lg p-1.5 text-foreground/60 hover:bg-slate-100 dark:hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>

              {dialogError ? (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-300">
                  {dialogError}
                </div>
              ) : null}

              <form onSubmit={handlePercentSubmit} className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-2">
                    <Percent className="size-4 text-primary" />
                    <label
                      htmlFor="cell-increment-percentage"
                      className="text-sm font-semibold text-text-primary"
                    >
                      Recommended increment
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-foreground/60">
                    Value from 1% to 100% (decimals allowed, e.g. 7.5).
                  </p>

                  <div className="mt-4 space-y-4">
                    <input
                      id="cell-increment-percentage-range"
                      type="range"
                      min={1}
                      max={100}
                      step={0.01}
                      value={incrementPercentage}
                      onChange={(event) =>
                        setIncrementPercentage(Number(event.target.value))
                      }
                      className="w-full accent-primary"
                    />
                    <div className="flex items-center gap-3">
                      <input
                        id="cell-increment-percentage"
                        type="number"
                        min={1}
                        max={100}
                        step={0.01}
                        value={incrementPercentage}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (!Number.isNaN(value)) {
                            setIncrementPercentage(
                              Math.min(100, Math.max(1, value)),
                            );
                          }
                        }}
                        className="w-24 rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
                      />
                      <span className="text-sm font-semibold text-foreground/70">
                        %
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  {percentageByQuartileId.has(editingQuartile.id) ? (
                    <button
                      type="button"
                      onClick={handleClearPercentage}
                      disabled={deleteMutation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-60 dark:border-red-900"
                    >
                      <Trash2 className="size-3.5" />
                      Clear
                    </button>
                  ) : (
                    <span />
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closePercentDialog}
                      className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                    >
                      <Percent className="size-3.5" />
                      Save {formatIncrementPercent(incrementPercentage)}%
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
