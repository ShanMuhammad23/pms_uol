"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Grid3X3, Pencil, Plus, Trash2, UserCheck, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  getPerformanceLevelColor,
  getPerformanceLevelTint,
} from "@/app/helpers/dashboard-helpers";
import { fetchFinancialYears } from "@/lib/queries/financial-years-client";
import {
  assignPerformanceMatrixToEmployees,
  createPerformanceLevel,
  createPerformanceQuartile,
  deletePerformanceLevel,
  deletePerformanceQuartile,
  fetchPerformanceMatrix,
  fetchPerformanceMatrixLabels,
  updatePerformanceLevel,
  updatePerformanceQuartile,
} from "@/lib/queries/performance-matrices-client";
import { fetchUsers } from "@/lib/queries/users-client";
import { cn } from "@/lib/utils";
import {
  formatPerformanceScore,
  type PerformanceLevelRecord,
  type PerformanceLevelWithQuartiles,
  type PerformanceQuartileRecord,
} from "@/types/performance-matrices";
import PerformanceMatrixGrid from "./PerformanceMatrixGrid";

type MessageTone = "success" | "error";
type MatricesPanel = "overview" | "assign" | "add-matrix";
type DialogKind = "level" | "quartile" | null;

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

export default function PerformanceMatricesManager() {
  const queryClient = useQueryClient();
  const [selectedFinancialYearId, setSelectedFinancialYearId] = useState<
    number | null
  >(null);
  const [activePanel, setActivePanel] = useState<MatricesPanel>("overview");
  const [openDialog, setOpenDialog] = useState<DialogKind>(null);

  const [levelName, setLevelName] = useState("");
  const [matrixLabel, setMatrixLabel] = useState("Default");
  const [selectedMatrixLabel, setSelectedMatrixLabel] = useState("Default");
  const [newMatrixLabel, setNewMatrixLabel] = useState("");
  const [levelSortOrder, setLevelSortOrder] = useState("0");
  const [editingLevel, setEditingLevel] =
    useState<PerformanceLevelRecord | null>(null);

  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
  const [quartileName, setQuartileName] = useState("");
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [quartileSortOrder, setQuartileSortOrder] = useState("0");
  const [editingQuartile, setEditingQuartile] =
    useState<PerformanceQuartileRecord | null>(null);

  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
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
    data: matrix,
    isLoading: matrixLoading,
    error: matrixError,
  } = useQuery({
    queryKey: ["performance-matrix", selectedFinancialYearId, selectedMatrixLabel],
    queryFn: () =>
      fetchPerformanceMatrix(
        selectedFinancialYearId!,
        selectedMatrixLabel || undefined,
      ),
    enabled: selectedFinancialYearId !== null,
  });

  const { data: matrixLabels } = useQuery({
    queryKey: ["performance-matrix-labels", selectedFinancialYearId],
    queryFn: () => fetchPerformanceMatrixLabels(selectedFinancialYearId!),
    enabled: selectedFinancialYearId !== null,
  });

  const { data: users } = useQuery({
    queryKey: ["users-for-performance-assignment"],
    queryFn: fetchUsers,
  });

  const invalidateMatrix = () => {
    queryClient.invalidateQueries({
      queryKey: ["performance-matrix", selectedFinancialYearId],
    });
    queryClient.invalidateQueries({
      queryKey: ["performance-matrix-labels", selectedFinancialYearId],
    });
  };

  const resetLevelForm = () => {
    setMatrixLabel(selectedMatrixLabel || "Default");
    setLevelName("");
    setLevelSortOrder("0");
    setEditingLevel(null);
  };

  const resetQuartileForm = () => {
    setQuartileName("");
    setScoreMin("");
    setScoreMax("");
    setQuartileSortOrder("0");
    setEditingQuartile(null);
  };

  const closeDialog = () => {
    setOpenDialog(null);
    setDialogError(null);
    resetLevelForm();
    resetQuartileForm();
  };

  const selectedLevelQuartiles =
    matrix?.find((level) => level.id === selectedLevelId)?.quartiles ?? [];
  const selectedLevel = matrix?.find((level) => level.id === selectedLevelId);
  const selectedLevelIndex =
    matrix?.findIndex((level) => level.id === selectedLevelId) ?? -1;

  const openLevelDialog = (level?: PerformanceLevelWithQuartiles) => {
    setDialogError(null);
    setFormMessage(null);
    if (level) {
      setEditingLevel(level);
      setMatrixLabel(level.matrixLabel);
      setLevelName(level.name);
      setLevelSortOrder(String(level.sortOrder));
    } else {
      resetLevelForm();
      setLevelSortOrder(String(matrix?.length ?? 0));
    }
    setOpenDialog("level");
  };

  const openQuartileDialog = (quartile?: PerformanceQuartileRecord) => {
    setDialogError(null);
    setFormMessage(null);

    if (!selectedLevelId && !quartile && (!matrix || matrix.length === 0)) {
      setFormMessage({
        tone: "error",
        text: "Add a performance level before creating quartiles.",
      });
      return;
    }

    if (quartile) {
      setEditingQuartile(quartile);
      setQuartileName(quartile.name);
      setScoreMin(formatPerformanceScore(quartile.scoreMin));
      setScoreMax(formatPerformanceScore(quartile.scoreMax));
      setQuartileSortOrder(String(quartile.sortOrder));
    } else {
      resetQuartileForm();
      const levelId = selectedLevelId ?? matrix?.[0]?.id ?? null;
      if (levelId) {
        setSelectedLevelId(levelId);
      }
      const quartiles =
        matrix?.find((level) => level.id === (levelId ?? selectedLevelId))
          ?.quartiles ?? [];
      setQuartileSortOrder(String(quartiles.length));
    }
    setOpenDialog("quartile");
  };

  const createLevelMutation = useMutation({
    mutationFn: createPerformanceLevel,
    onSuccess: (level) => {
      setFormMessage({
        tone: "success",
        text: `Performance level "${level.name}" created successfully.`,
      });
      closeDialog();
      setSelectedLevelId(level.id);
      invalidateMatrix();
    },
    onError: (mutationError: Error) => {
      setDialogError(mutationError.message);
    },
  });

  const assignMatrixMutation = useMutation({
    mutationFn: assignPerformanceMatrixToEmployees,
    onSuccess: (result) => {
      setFormMessage({
        tone: "success",
        text: `Performance matrix "${result.matrixLabel}" assigned to ${result.updatedCount} employees.`,
      });
      setSelectedEmployeeIds([]);
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const updateLevelMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: { matrixLabel: string; name: string; sortOrder: number };
    }) => updatePerformanceLevel(id, input),
    onSuccess: (level) => {
      setFormMessage({
        tone: "success",
        text: `Performance level "${level.name}" updated successfully.`,
      });
      closeDialog();
      invalidateMatrix();
    },
    onError: (mutationError: Error) => {
      setDialogError(mutationError.message);
    },
  });

  const deleteLevelMutation = useMutation({
    mutationFn: deletePerformanceLevel,
    onSuccess: () => {
      setFormMessage({
        tone: "success",
        text: "Performance level deleted successfully.",
      });
      closeDialog();
      setSelectedLevelId(null);
      invalidateMatrix();
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const createQuartileMutation = useMutation({
    mutationFn: createPerformanceQuartile,
    onSuccess: (quartile) => {
      setFormMessage({
        tone: "success",
        text: `Quartile "${quartile.name}" created successfully.`,
      });
      closeDialog();
      invalidateMatrix();
    },
    onError: (mutationError: Error) => {
      setDialogError(mutationError.message);
    },
  });

  const updateQuartileMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: {
        name: string;
        scoreMin: number;
        scoreMax: number;
        sortOrder: number;
      };
    }) => updatePerformanceQuartile(id, input),
    onSuccess: (quartile) => {
      setFormMessage({
        tone: "success",
        text: `Quartile "${quartile.name}" updated successfully.`,
      });
      closeDialog();
      invalidateMatrix();
    },
    onError: (mutationError: Error) => {
      setDialogError(mutationError.message);
    },
  });

  const deleteQuartileMutation = useMutation({
    mutationFn: deletePerformanceQuartile,
    onSuccess: () => {
      setFormMessage({
        tone: "success",
        text: "Quartile deleted successfully.",
      });
      closeDialog();
      invalidateMatrix();
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const handleLevelSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDialogError(null);

    if (!selectedFinancialYearId) {
      setDialogError("Select a financial year first.");
      return;
    }

    if (!levelName.trim()) {
      setDialogError("Level name is required.");
      return;
    }

    const sortOrder = Number(levelSortOrder);

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setDialogError("Sort order must be a non-negative integer.");
      return;
    }

    if (editingLevel) {
      updateLevelMutation.mutate({
        id: editingLevel.id,
        input: {
          matrixLabel: matrixLabel.trim(),
          name: levelName.trim(),
          sortOrder,
        },
      });
      return;
    }

    createLevelMutation.mutate({
      financialYearId: selectedFinancialYearId,
      matrixLabel: matrixLabel.trim(),
      name: levelName.trim(),
      sortOrder,
    });
  };

  const handleQuartileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDialogError(null);

    if (!selectedLevelId) {
      setDialogError("Select a performance level first.");
      return;
    }

    if (!quartileName.trim()) {
      setDialogError("Quartile name is required.");
      return;
    }

    const parsedMin = Number(scoreMin);
    const parsedMax = Number(scoreMax);
    const sortOrder = Number(quartileSortOrder);

    if (!Number.isFinite(parsedMin) || !Number.isFinite(parsedMax)) {
      setDialogError("Score min and max must be valid numbers.");
      return;
    }

    if (parsedMin < 0 || parsedMax < 0) {
      setDialogError("Scores must be zero or greater.");
      return;
    }

    if (parsedMin >= parsedMax) {
      setDialogError("Minimum score must be less than maximum score.");
      return;
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setDialogError("Sort order must be a non-negative integer.");
      return;
    }

    const payload = {
      name: quartileName.trim(),
      scoreMin: parsedMin,
      scoreMax: parsedMax,
      sortOrder,
    };

    if (editingQuartile) {
      updateQuartileMutation.mutate({
        id: editingQuartile.id,
        input: payload,
      });
      return;
    }

    createQuartileMutation.mutate({
      performanceLevelId: selectedLevelId,
      ...payload,
    });
  };

  const handleDeleteLevel = (level: PerformanceLevelWithQuartiles) => {
    const confirmed = window.confirm(
      `Delete performance level "${level.name}"?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setFormMessage(null);
    deleteLevelMutation.mutate(level.id);
  };

  const handleDeleteQuartile = (quartile: PerformanceQuartileRecord) => {
    const confirmed = window.confirm(
      `Delete quartile "${quartile.name}"?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setFormMessage(null);
    deleteQuartileMutation.mutate(quartile.id);
  };

  const isLevelSubmitting =
    createLevelMutation.isPending || updateLevelMutation.isPending;
  const isQuartileSubmitting =
    createQuartileMutation.isPending || updateQuartileMutation.isPending;

  const matrixOptions = useMemo(
    () =>
      Array.from(new Set([...(matrixLabels ?? []), "Default"])).sort((a, b) =>
        a.localeCompare(b),
      ),
    [matrixLabels],
  );

  const totalQuartiles = useMemo(
    () => matrix?.reduce((sum, level) => sum + level.quartiles.length, 0) ?? 0,
    [matrix],
  );

  const handleCreateMatrixLabel = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const label = newMatrixLabel.trim();
    if (!label) {
      setFormMessage({ tone: "error", text: "Matrix label is required." });
      return;
    }

    if (matrixOptions.some((option) => option.toLowerCase() === label.toLowerCase())) {
      setFormMessage({
        tone: "error",
        text: `Matrix "${label}" already exists for this financial year.`,
      });
      return;
    }

    setSelectedMatrixLabel(label);
    setMatrixLabel(label);
    setNewMatrixLabel("");
    setSelectedLevelId(null);
    resetQuartileForm();
    setActivePanel("overview");
    setFormMessage({
      tone: "success",
      text: `Matrix "${label}" created. Add performance levels to initialize it.`,
    });
  };

  return (
    <div className="space-y-5">
      <AnimatePresence>
        {formMessage ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={cn(
              "overflow-hidden rounded-xl border px-4 py-3 text-sm font-medium",
              formMessage.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/30 dark:bg-emerald-950/20 dark:text-emerald-300"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-300",
            )}
          >
            {formMessage.text}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="rounded-xl border border-slate-300/80 dark:border-white/15">
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
                <div className="rounded-xl border border-slate-300/80 bg-background px-3 py-2.5 dark:border-white/15">
                  <label
                    htmlFor="matrix-financial-year"
                    className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground/60"
                  >
                    Financial Year
                  </label>
                  <select
                    id="matrix-financial-year"
                    value={selectedFinancialYearId ?? ""}
                    onChange={(event) => {
                      setSelectedFinancialYearId(Number(event.target.value));
                      setSelectedMatrixLabel("Default");
                      setSelectedLevelId(null);
                      resetLevelForm();
                      resetQuartileForm();
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

                <div className="rounded-xl border border-slate-300/80 bg-background px-3 py-2.5 dark:border-white/15">
                  <label
                    htmlFor="overview-matrix-label"
                    className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground/60"
                  >
                    Matrix
                  </label>
                  <select
                    id="overview-matrix-label"
                    value={selectedMatrixLabel}
                    onChange={(event) => {
                      setSelectedMatrixLabel(event.target.value);
                      setMatrixLabel(event.target.value);
                      setSelectedLevelId(null);
                      resetQuartileForm();
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

                <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-3 dark:border-violet-500/30 dark:bg-violet-950/20">
                  <p className="text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    Levels
                  </p>
                  <p className="mt-1 text-2xl font-bold text-violet-900 dark:text-violet-100">
                    {matrix?.length ?? 0}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-950/20">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Quartiles
                  </p>
                  <p className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                    {totalQuartiles}
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
                      Click a level row to select it, then edit or add quartiles.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openLevelDialog()}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                    >
                      <Plus className="size-4" />
                      Add Level
                    </button>
                    <button
                      type="button"
                      onClick={() => openQuartileDialog()}
                      disabled={!matrix?.length}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                    >
                      <Plus className="size-4" />
                      Add Quartile
                    </button>
                  </div>
                </div>

                {matrixLoading ? (
                  <p className="text-sm text-foreground/70">Loading matrix…</p>
                ) : matrixError ? (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Failed to load performance matrix.
                  </p>
                ) : (
                  <PerformanceMatrixGrid
                    levels={matrix ?? []}
                    selectedLevelId={selectedLevelId}
                    onSelectLevel={(levelId) => {
                      setSelectedLevelId(levelId);
                      setFormMessage(null);
                    }}
                  />
                )}
              </div>

              {selectedLevel ? (
                <div
                  className={cn(
                    "rounded-xl border p-4",
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openLevelDialog(selectedLevel)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-background px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                      >
                        <Pencil className="size-3.5" />
                        Edit level
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLevel(selectedLevel)}
                        disabled={deleteLevelMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-60 dark:border-red-900"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => openQuartileDialog()}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                      >
                        <Plus className="size-3.5" />
                        Add quartile
                      </button>
                    </div>
                  </div>

                  {selectedLevelQuartiles.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedLevelQuartiles.map((quartile) => (
                        <div
                          key={quartile.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-300/80 bg-background/80 px-2.5 py-1.5 text-xs dark:border-white/15"
                        >
                          <span className="font-semibold text-text-primary">
                            {quartile.name}
                          </span>
                          <span className="tabular-nums text-foreground/70">
                            {formatPerformanceScore(quartile.scoreMin)}–
                            {formatPerformanceScore(quartile.scoreMax)}
                          </span>
                          <button
                            type="button"
                            onClick={() => openQuartileDialog(quartile)}
                            className="rounded p-0.5 text-foreground/60 hover:bg-primary/10 hover:text-primary"
                            aria-label={`Edit ${quartile.name}`}
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuartile(quartile)}
                            disabled={deleteQuartileMutation.isPending}
                            className="rounded p-0.5 text-red-500 hover:bg-red-500/10 disabled:opacity-60"
                            aria-label={`Delete ${quartile.name}`}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      ))}
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
                  Map employees to the currently selected performance matrix
                  label.
                </p>
              </div>

              <div className="rounded-xl border border-sky-200 bg-sky-50/50 px-4 py-3 dark:border-sky-500/30 dark:bg-sky-950/20">
                <p className="text-xs font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300">
                  Assigning
                </p>
                <p className="mt-1 text-lg font-bold text-sky-900 dark:text-sky-100">
                  {selectedMatrixLabel}
                </p>
              </div>

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
                  assignMatrixMutation.isPending
                }
                onClick={() => {
                  if (!selectedFinancialYearId) {
                    return;
                  }
                  setFormMessage(null);
                  assignMatrixMutation.mutate({
                    financialYearId: selectedFinancialYearId,
                    matrixLabel: selectedMatrixLabel,
                    employeeIds: selectedEmployeeIds,
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
                  Add performance matrix
                </h3>
                <p className="mt-1 text-sm text-foreground/70">
                  Create a new matrix label for the selected financial year,
                  then add levels to initialize it.
                </p>
              </div>

              <div className="rounded-xl border border-slate-300/80 bg-slate-50/50 p-5 dark:border-white/15 dark:bg-white/5">
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
                      htmlFor="new-matrix-label"
                      className="mb-1.5 block text-sm font-medium text-text-primary"
                    >
                      Matrix Label
                    </label>
                    <input
                      id="new-matrix-label"
                      type="text"
                      value={newMatrixLabel}
                      onChange={(event) => setNewMatrixLabel(event.target.value)}
                      required
                      disabled={!selectedFinancialYearId}
                      placeholder="e.g. Matrix A / Faculty Matrix"
                      className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
                    />
                  </div>

                  {matrixOptions.length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/60">
                        Existing matrices
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {matrixOptions.map((label, index) => (
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
                      !selectedFinancialYearId || !newMatrixLabel.trim()
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    <Plus className="size-4" />
                    Create matrix
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {openDialog === "level" ? (
          <motion.div
            key="level-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="level-dialog-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-100 flex items-center justify-center p-4"
          >
            <motion.button
              type="button"
              aria-label="Close level dialog"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDialog}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-300/80 bg-surface p-6 shadow-2xl shadow-slate-900/10 dark:border-white/15 dark:shadow-black/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    id="level-dialog-title"
                    className="text-lg font-semibold text-text-primary"
                  >
                    {editingLevel
                      ? "Edit performance level"
                      : "Add performance level"}
                  </h2>
                  <p className="mt-1 text-sm text-foreground/70">
                    Levels become the colored rows in the combined matrix.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDialog}
                  aria-label="Close"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-foreground/70 hover:bg-primary/10 hover:text-text-primary dark:border-white/15"
                >
                  <X className="size-4" />
                </button>
              </div>

              {dialogError ? (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300">
                  {dialogError}
                </p>
              ) : null}

              <form onSubmit={handleLevelSubmit} className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="dialog-matrix-label"
                    className="mb-1.5 block text-sm font-medium text-text-primary"
                  >
                    Matrix Label
                  </label>
                  <input
                    id="dialog-matrix-label"
                    type="text"
                    value={matrixLabel}
                    onChange={(event) => setMatrixLabel(event.target.value)}
                    required
                    disabled={!selectedFinancialYearId}
                    className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
                    placeholder="Default / Matrix A"
                  />
                </div>

                <div>
                  <label
                    htmlFor="dialog-level-name"
                    className="mb-1.5 block text-sm font-medium text-text-primary"
                  >
                    Level Name
                  </label>
                  <input
                    id="dialog-level-name"
                    type="text"
                    value={levelName}
                    onChange={(event) => setLevelName(event.target.value)}
                    required
                    disabled={!selectedFinancialYearId}
                    className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
                    placeholder="Excellent"
                  />
                </div>

                <div>
                  <label
                    htmlFor="dialog-level-sort-order"
                    className="mb-1.5 block text-sm font-medium text-text-primary"
                  >
                    Sort Order
                  </label>
                  <input
                    id="dialog-level-sort-order"
                    type="number"
                    min={0}
                    value={levelSortOrder}
                    onChange={(event) => setLevelSortOrder(event.target.value)}
                    disabled={!selectedFinancialYearId}
                    className="w-full max-w-xs rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={!selectedFinancialYearId || isLevelSubmitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    {editingLevel ? (
                      <>
                        <Pencil className="size-4" />
                        Update Level
                      </>
                    ) : (
                      <>
                        <Plus className="size-4" />
                        Add Level
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {openDialog === "quartile" ? (
          <motion.div
            key="quartile-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quartile-dialog-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-100 flex items-center justify-center p-4"
          >
            <motion.button
              type="button"
              aria-label="Close quartile dialog"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDialog}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-300/80 bg-surface p-6 shadow-2xl shadow-slate-900/10 dark:border-white/15 dark:shadow-black/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    id="quartile-dialog-title"
                    className="text-lg font-semibold text-text-primary"
                  >
                    {editingQuartile ? "Edit quartile" : "Add quartile"}
                  </h2>
                  <p className="mt-1 text-sm text-foreground/70">
                    Quartiles define score ranges within a performance level.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDialog}
                  aria-label="Close"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-foreground/70 hover:bg-primary/10 hover:text-text-primary dark:border-white/15"
                >
                  <X className="size-4" />
                </button>
              </div>

              {dialogError ? (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300">
                  {dialogError}
                </p>
              ) : null}

              <form onSubmit={handleQuartileSubmit} className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="dialog-quartile-level"
                    className="mb-1.5 block text-sm font-medium text-text-primary"
                  >
                    Performance Level
                  </label>
                  <select
                    id="dialog-quartile-level"
                    value={selectedLevelId ?? ""}
                    onChange={(event) => {
                      setSelectedLevelId(Number(event.target.value));
                      setDialogError(null);
                    }}
                    disabled={!!editingQuartile || !matrix?.length}
                    className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
                  >
                    <option value="">Select a level</option>
                    {matrix?.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="dialog-quartile-name"
                    className="mb-1.5 block text-sm font-medium text-text-primary"
                  >
                    Quartile Name
                  </label>
                  <input
                    id="dialog-quartile-name"
                    type="text"
                    value={quartileName}
                    onChange={(event) => setQuartileName(event.target.value)}
                    required
                    disabled={!selectedLevelId}
                    className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
                    placeholder="Q1"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="dialog-score-min"
                      className="mb-1.5 block text-sm font-medium text-text-primary"
                    >
                      Score Min
                    </label>
                    <input
                      id="dialog-score-min"
                      type="number"
                      min={0}
                      step="0.01"
                      value={scoreMin}
                      onChange={(event) => setScoreMin(event.target.value)}
                      required
                      disabled={!selectedLevelId}
                      className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="dialog-score-max"
                      className="mb-1.5 block text-sm font-medium text-text-primary"
                    >
                      Score Max
                    </label>
                    <input
                      id="dialog-score-max"
                      type="number"
                      min={0}
                      step="0.01"
                      value={scoreMax}
                      onChange={(event) => setScoreMax(event.target.value)}
                      required
                      disabled={!selectedLevelId}
                      className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="dialog-quartile-sort-order"
                    className="mb-1.5 block text-sm font-medium text-text-primary"
                  >
                    Sort Order
                  </label>
                  <input
                    id="dialog-quartile-sort-order"
                    type="number"
                    min={0}
                    value={quartileSortOrder}
                    onChange={(event) =>
                      setQuartileSortOrder(event.target.value)
                    }
                    disabled={!selectedLevelId}
                    className="w-full max-w-xs rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={!selectedLevelId || isQuartileSubmitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    {editingQuartile ? (
                      <>
                        <Pencil className="size-4" />
                        Update Quartile
                      </>
                    ) : (
                      <>
                        <Plus className="size-4" />
                        Add Quartile
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
