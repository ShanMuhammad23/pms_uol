"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Grid3X3, Percent, Plus, Trash2, UserCheck, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import {
  getPerformanceLevelColor,
  getPerformanceLevelTint,
} from "@/app/helpers/dashboard-helpers";
import { fetchFinancialYears } from "@/lib/queries/financial-years-client";
import {
  fetchPerformanceMatrix,
  fetchPerformanceMatrixLabels,
} from "@/lib/queries/performance-matrices-client";
import {
  assignIncrementMatrixToEmployees,
  copyIncrementMatrixDef,
  createIncrementMatrixDef,
  createSubCategoryIncrementMatrix,
  deleteIncrementMatrix,
  deleteSubCategoryIncrementMatrix,
  fetchIncrementMatrixAssignments,
  fetchIncrementMatrixSummaries,
  fetchSubCategoryIncrementMatrices,
  unassignIncrementMatrixFromEmployees,
  updateIncrementMatrixIdentity,
  updateSubCategoryIncrementMatrix,
} from "@/lib/queries/sub-category-increment-matrices-client";
import { cn } from "@/lib/utils";
import type { SubCategoryIncrementMatrixRecord } from "@/types/sub-category-increment-matrices";
import type {
  PerformanceLevelWithQuartiles,
  PerformanceQuartileRecord,
} from "@/types/performance-matrices";
import PerformanceMatrixGrid from "./PerformanceMatrixGrid";
import MatrixEmployeeAssignment from "./MatrixEmployeeAssignment";
import MatrixCopyDialog from "./MatrixCopyDialog";
import MatrixIdentityEditor from "./MatrixIdentityEditor";
import MatrixListTable, { type MatrixListRow } from "./MatrixListTable";

type MessageTone = "success" | "error";
type MatricesPanel = "list" | "overview" | "assign" | "add-matrix";

interface FormMessage {
  tone: MessageTone;
  text: string;
}

const panels: Array<{
  id: Exclude<MatricesPanel, "list">;
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
  const [selectedYearOverride, setSelectedFinancialYearId] = useState<
    number | null
  >(null);
  const [activePanel, setActivePanel] = useState<MatricesPanel>("list");
  const [selectedMatrixLabel, setSelectedMatrixLabel] = useState("Default");
  const [performanceMatrixOverride, setSelectedPerformanceMatrixLabel] =
    useState("Default");
  const [newMatrixLabel, setNewMatrixLabel] = useState("");
  const [newMatrixTitle, setNewMatrixTitle] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editLabel, setEditLabel] = useState("");
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
  const [copyRow, setCopyRow] = useState<MatrixListRow | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const { data: financialYears } = useQuery({
    queryKey: ["financial-years"],
    queryFn: fetchFinancialYears,
  });

  const selectedFinancialYearId =
    selectedYearOverride ??
    financialYears?.find((year) => year.isActive)?.id ??
    financialYears?.[0]?.id ??
    null;

  const { data: performanceMatrixLabels } = useQuery({
    queryKey: ["performance-matrix-labels", selectedFinancialYearId],
    queryFn: () => fetchPerformanceMatrixLabels(selectedFinancialYearId!),
    enabled: selectedFinancialYearId !== null,
  });

  const selectedPerformanceMatrixLabel =
    performanceMatrixLabels?.length &&
    !performanceMatrixLabels.includes(performanceMatrixOverride)
      ? performanceMatrixLabels[0]
      : performanceMatrixOverride;

  const {
    data: performanceMatrix,
    isLoading: matrixLoading,
    error: matrixError,
  } = useQuery({
    queryKey: [
      "performance-matrix",
      selectedFinancialYearId,
      selectedPerformanceMatrixLabel,
    ],
    queryFn: () =>
      fetchPerformanceMatrix(
        selectedFinancialYearId!,
        selectedPerformanceMatrixLabel || undefined,
      ),
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
    enabled: selectedFinancialYearId !== null && activePanel === "assign",
  });

  const {
    data: matrixSummaries,
    isLoading: summariesLoading,
    error: summariesError,
  } = useQuery({
    queryKey: ["increment-matrix-summaries"],
    queryFn: fetchIncrementMatrixSummaries,
  });

  const incrementMatrixOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (matrixSummaries ?? [])
            .filter((item) => item.financialYearId === selectedFinancialYearId)
            .map((item) => item.matrixLabel)
            .concat(selectedMatrixLabel ? [selectedMatrixLabel] : []),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [matrixSummaries, selectedFinancialYearId, selectedMatrixLabel],
  );

  const performanceMatrixOptions = useMemo(
    () =>
      Array.from(new Set(performanceMatrixLabels ?? [])).sort((a, b) =>
        a.localeCompare(b),
      ),
    [performanceMatrixLabels],
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

  const selectedLevel = performanceMatrix?.find(
    (level) => level.id === selectedLevelId,
  );
  const selectedLevelIndex =
    performanceMatrix?.findIndex((level) => level.id === selectedLevelId) ?? -1;

  const invalidateEntries = () => {
    void queryClient.invalidateQueries({
      queryKey: ["sub-category-increment-matrices", selectedFinancialYearId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["increment-matrix-summaries"],
    });
  };

  const invalidateAssignments = () => {
    void queryClient.invalidateQueries({
      queryKey: ["increment-matrix-assignments", selectedFinancialYearId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["increment-matrix-summaries"],
    });
  };

  const deleteMatrixMutation = useMutation({
    mutationFn: deleteIncrementMatrix,
    onSuccess: () => {
      setFormMessage({
        tone: "success",
        text: "Increment matrix deleted.",
      });
      void queryClient.invalidateQueries({
        queryKey: ["increment-matrix-summaries"],
      });
      invalidateEntries();
    },
    onError: (error: Error) => {
      setFormMessage({ tone: "error", text: error.message });
    },
  });

  const copyMatrixMutation = useMutation({
    mutationFn: copyIncrementMatrixDef,
    onSuccess: (copied) => {
      setCopyRow(null);
      setCopyError(null);
      invalidateEntries();
      openMatrix(
        {
          financialYearId: copied.financialYearId,
          financialYearLabel: copied.financialYearLabel,
          isActiveYear: copied.isActiveYear,
          matrixLabel: copied.matrixLabel,
          title: copied.title,
          assignedEmployeeCount: copied.assignedEmployeeCount,
          updatedAt: copied.updatedAt,
          metricLabel: "% Set",
          metricValue: copied.cellCount,
        },
        "overview",
      );
      setFormMessage({
        tone: "success",
        text: `Copied to "${copied.title}". You can edit any field on this copy.`,
      });
    },
    onError: (error: Error) => {
      setCopyError(error.message);
    },
  });

  const openMatrix = (row: MatrixListRow, panel: "overview" | "assign") => {
    setSelectedFinancialYearId(row.financialYearId);
    setSelectedMatrixLabel(row.matrixLabel);
    setEditTitle(row.title);
    setEditLabel(row.matrixLabel);
    setSelectedLevelId(null);
    setSelectedQuartileId(null);
    setFormMessage(null);
    setActivePanel(panel);
  };

  const closeCopyDialog = () => {
    setCopyRow(null);
    setCopyError(null);
  };

  const goToList = () => {
    setActivePanel("list");
    setFormMessage(null);
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

  const createMatrixMutation = useMutation({
    mutationFn: createIncrementMatrixDef,
    onSuccess: (created) => {
      setSelectedFinancialYearId(created.financialYearId);
      setSelectedMatrixLabel(created.matrixLabel);
      setEditTitle(created.title);
      setEditLabel(created.matrixLabel);
      setNewMatrixLabel("");
      setNewMatrixTitle("");
      setSelectedLevelId(null);
      setSelectedQuartileId(null);
      invalidateEntries();
      setActivePanel("overview");
      setFormMessage({
        tone: "success",
        text: `Increment matrix "${created.title}" created. Choose a performance matrix and click quartile cells to set percentages.`,
      });
    },
    onError: (error: Error) => {
      setFormMessage({ tone: "error", text: error.message });
    },
  });

  const updateIdentityMutation = useMutation({
    mutationFn: updateIncrementMatrixIdentity,
    onSuccess: (updated) => {
      setSelectedMatrixLabel(updated.matrixLabel);
      setEditTitle(updated.title);
      setEditLabel(updated.matrixLabel);
      invalidateEntries();
      setFormMessage({
        tone: "success",
        text: "Matrix title and label updated.",
      });
    },
    onError: (error: Error) => {
      setFormMessage({ tone: "error", text: error.message });
    },
  });

  const handleCreateMatrixLabel = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!selectedFinancialYearId) {
      setFormMessage({ tone: "error", text: "Financial year is required." });
      return;
    }
    const label = newMatrixLabel.trim();
    const title = newMatrixTitle.trim() || label;
    if (!label) {
      setFormMessage({ tone: "error", text: "Matrix label is required." });
      return;
    }

    createMatrixMutation.mutate({
      financialYearId: selectedFinancialYearId,
      matrixLabel: label,
      title,
    });
  };

  const currentSummary = matrixSummaries?.find(
    (item) =>
      item.financialYearId === selectedFinancialYearId &&
      item.matrixLabel === selectedMatrixLabel,
  );
  const identityDirty =
    editTitle.trim() !== (currentSummary?.title ?? selectedMatrixLabel) ||
    editLabel.trim() !== selectedMatrixLabel;

  const listRows: MatrixListRow[] = (matrixSummaries ?? []).map((item) => ({
    financialYearId: item.financialYearId,
    financialYearLabel: item.financialYearLabel,
    isActiveYear: item.isActiveYear,
    matrixLabel: item.matrixLabel,
    title: item.title,
    assignedEmployeeCount: item.assignedEmployeeCount,
    updatedAt: item.updatedAt,
    metricLabel: "% Set",
    metricValue: item.cellCount,
  }));

  const handleDeleteMatrix = (row: MatrixListRow) => {
    const assignedNote =
      row.assignedEmployeeCount > 0
        ? `This matrix is assigned to ${row.assignedEmployeeCount} employee(s). Assignments will be removed.`
        : "This action cannot be undone.";
    const confirmed = window.confirm(
      `Delete increment matrix "${row.matrixLabel}" for ${row.financialYearLabel}?\n\n${assignedNote}`,
    );
    if (!confirmed) {
      return;
    }
    deleteMatrixMutation.mutate({
      financialYearId: row.financialYearId,
      matrixLabel: row.matrixLabel,
    });
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

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
        {activePanel === "list" ? (
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-foreground/70">
                Design and manage increment matrices and assign them to employees.
              </p>
              <button
                type="button"
                onClick={() => {
                  setNewMatrixLabel("");
                  setNewMatrixTitle("");
                  setFormMessage(null);
                  setActivePanel("add-matrix");
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
              >
                <Plus className="size-4" />
                Create Matrix
              </button>
            </div>
            <MatrixListTable
              rows={listRows}
              isLoading={summariesLoading}
              error={Boolean(summariesError)}
              emptyTitle="No increment matrices yet"
              emptyDescription="Create your first increment matrix to get started."
              createLabel="Create Matrix"
              onCreate={() => {
                setNewMatrixLabel("");
                setNewMatrixTitle("");
                setFormMessage(null);
                setActivePanel("add-matrix");
              }}
              onEdit={(row) => openMatrix(row, "overview")}
              onCopy={(row) => {
                setCopyError(null);
                setCopyRow(row);
              }}
              onAssign={(row) => openMatrix(row, "assign")}
              onDelete={handleDeleteMatrix}
              deletePending={deleteMatrixMutation.isPending}
              copyPending={copyMatrixMutation.isPending}
            />
          </div>
        ) : (
          <>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-300/80 p-2 dark:border-white/15">
          <button
            type="button"
            onClick={goToList}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 hover:bg-primary/10 hover:text-text-primary"
          >
            <ArrowLeft className="size-4" />
            Back to list
          </button>
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
                    setNewMatrixTitle("");
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
              <MatrixIdentityEditor
                idPrefix="increment-matrix"
                financialYearLabel={
                  financialYears?.find((year) => year.id === selectedFinancialYearId)
                    ?.label ?? "—"
                }
                title={editTitle}
                label={editLabel}
                onTitleChange={setEditTitle}
                onLabelChange={setEditLabel}
                dirty={identityDirty}
                isSaving={updateIdentityMutation.isPending}
                performanceMatrixLabel={selectedPerformanceMatrixLabel}
                performanceMatrixOptions={performanceMatrixOptions}
                onPerformanceMatrixChange={(nextLabel) => {
                  setSelectedPerformanceMatrixLabel(nextLabel);
                  setSelectedLevelId(null);
                  setSelectedQuartileId(null);
                  setFormMessage(null);
                }}
                onSave={(event) => {
                  event.preventDefault();
                  if (!selectedFinancialYearId) {
                    return;
                  }
                  updateIdentityMutation.mutate({
                    financialYearId: selectedFinancialYearId,
                    matrixLabel: selectedMatrixLabel,
                    newMatrixLabel: editLabel.trim(),
                    title: editTitle.trim(),
                  });
                }}
              />

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">
                      {editTitle.trim() || selectedMatrixLabel}
                    </h3>
                    <p className="text-sm text-foreground/70">
                      Choose any performance matrix, then click a quartile cell
                      to set its increment percentage.
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
                    No performance levels for &quot;
                    {selectedPerformanceMatrixLabel}&quot;. Configure levels and
                    quartiles in the{" "}
                    <span className="font-medium">Performance Matrix</span> tab,
                    then return here to set increment percentages.
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-300/80 bg-background px-3 py-2.5 dark:border-white/15">
                  <label
                    htmlFor="assign-increment-financial-year"
                    className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground/60"
                  >
                    Financial Year
                  </label>
                  <select
                    id="assign-increment-financial-year"
                    value={selectedFinancialYearId ?? ""}
                    onChange={(event) => {
                      setSelectedFinancialYearId(Number(event.target.value));
                      setSelectedMatrixLabel("Default");
                      setSelectedPerformanceMatrixLabel("Default");
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
                    htmlFor="assign-increment-matrix-label"
                    className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground/60"
                  >
                    Increment Matrix
                  </label>
                  <select
                    id="assign-increment-matrix-label"
                    value={selectedMatrixLabel}
                    onChange={(event) => {
                      const nextLabel = event.target.value;
                      setSelectedMatrixLabel(nextLabel);
                      const summary = matrixSummaries?.find(
                        (item) =>
                          item.financialYearId === selectedFinancialYearId &&
                          item.matrixLabel === nextLabel,
                      );
                      setEditTitle(summary?.title ?? nextLabel);
                      setEditLabel(nextLabel);
                      setFormMessage(null);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-background px-2.5 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
                  >
                    {incrementMatrixOptions.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <MatrixEmployeeAssignment
                targetLabel={selectedMatrixLabel}
                description="Select employees to assign or unassign the increment matrix"
                assignments={(assignments ?? []).map((row) => ({
                  employeeId: row.employeeCode,
                  matrixLabel: row.matrixLabel,
                }))}
                disabled={!selectedFinancialYearId}
                onAssign={async (employeeIds) => {
                  if (!selectedFinancialYearId) {
                    throw new Error("Select a financial year first.");
                  }
                  return assignIncrementMatrixToEmployees({
                    financialYearId: selectedFinancialYearId,
                    matrixLabel: selectedMatrixLabel,
                    employeeCodes: employeeIds,
                  });
                }}
                onUnassign={async (employeeIds) => {
                  if (!selectedFinancialYearId) {
                    throw new Error("Select a financial year first.");
                  }
                  return unassignIncrementMatrixFromEmployees({
                    financialYearId: selectedFinancialYearId,
                    employeeCodes: employeeIds,
                    matrixLabel: selectedMatrixLabel,
                  });
                }}
                onSettled={invalidateAssignments}
              />
            </div>
          ) : null}

          {activePanel === "add-matrix" ? (
            <div className="mx-auto max-w-lg space-y-4">
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  Add increment matrix
                </h3>
                <p className="mt-1 text-sm text-foreground/70">
                  Create a new increment matrix for the selected financial year.
                  You can edit the title and label later, then choose quartiles
                  from any performance matrix to set percentages.
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
                      htmlFor="new-increment-matrix-title"
                      className="mb-1.5 block text-sm font-medium text-text-primary"
                    >
                      Title
                    </label>
                    <input
                      id="new-increment-matrix-title"
                      type="text"
                      value={newMatrixTitle}
                      onChange={(event) => setNewMatrixTitle(event.target.value)}
                      disabled={!selectedFinancialYearId}
                      placeholder="e.g. Academic Increment Matrix"
                      className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="new-increment-matrix-label"
                      className="mb-1.5 block text-sm font-medium text-text-primary"
                    >
                      Label
                    </label>
                    <input
                      id="new-increment-matrix-label"
                      value={newMatrixLabel}
                      onChange={(event) => setNewMatrixLabel(event.target.value)}
                      required
                      disabled={!selectedFinancialYearId}
                      placeholder="e.g. Academic"
                      className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
                    />
                  </div>

                  {incrementMatrixOptions.length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/60">
                        Existing matrices
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {incrementMatrixOptions.map((label, index) => (
                          <span
                            key={label}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                              getPerformanceLevelTint(label, index),
                            )}
                          >
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                getPerformanceLevelColor(label, index),
                              )}
                            />
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={
                      !selectedFinancialYearId ||
                      !newMatrixLabel.trim() ||
                      createMatrixMutation.isPending
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    <Plus className="size-4" />
                    {createMatrixMutation.isPending
                      ? "Creating..."
                      : "Create matrix"}
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </div>
          </>
        )}
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
                    Increment matrix &quot;{selectedMatrixLabel}&quot;
                    {editingLevel.matrixLabel
                      ? ` · Performance matrix "${editingLevel.matrixLabel}"`
                      : ""}
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

      <MatrixCopyDialog
        key={
          copyRow
            ? `${copyRow.financialYearId}:${copyRow.matrixLabel}`
            : "closed"
        }
        open={Boolean(copyRow)}
        kind="increment"
        idPrefix="copy-increment-matrix"
        sourceTitle={copyRow?.title ?? ""}
        sourceLabel={copyRow?.matrixLabel ?? ""}
        sourceFinancialYearId={copyRow?.financialYearId ?? 0}
        financialYears={financialYears ?? []}
        isSaving={copyMatrixMutation.isPending}
        error={copyError}
        onClose={closeCopyDialog}
        onCopy={({ targetFinancialYearId, title, newMatrixLabel }) => {
          if (!copyRow) {
            return;
          }
          copyMatrixMutation.mutate({
            sourceFinancialYearId: copyRow.financialYearId,
            sourceMatrixLabel: copyRow.matrixLabel,
            targetFinancialYearId,
            newMatrixLabel,
            title,
          });
        }}
      />
    </div>
  );
}
