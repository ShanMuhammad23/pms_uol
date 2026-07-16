"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Grid3X3, Pencil, Plus, Trash2, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { fetchFinancialYears } from "@/lib/queries/financial-years-client";
import {
  assignPerformanceMatrixToEmployees,
  createPerformanceLevel,
  createPerformanceQuartile,
  fetchPerformanceMatrixLabels,
  deletePerformanceLevel,
  deletePerformanceQuartile,
  fetchPerformanceMatrix,
  updatePerformanceLevel,
  updatePerformanceQuartile,
} from "@/lib/queries/performance-matrices-client";
import { fetchUsers } from "@/lib/queries/users-client";
import {
  formatPerformanceScore,
  type PerformanceLevelRecord,
  type PerformanceLevelWithQuartiles,
  type PerformanceQuartileRecord,
} from "@/types/performance-matrices";
import PerformanceMatrixGrid from "./PerformanceMatrixGrid";

type MessageTone = "success" | "error";

interface FormMessage {
  tone: MessageTone;
  text: string;
}

export default function PerformanceMatricesManager() {
  const queryClient = useQueryClient();
  const [selectedFinancialYearId, setSelectedFinancialYearId] = useState<
    number | null
  >(null);

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
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

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

  const createLevelMutation = useMutation({
    mutationFn: createPerformanceLevel,
    onSuccess: (level) => {
      setFormMessage({
        tone: "success",
        text: `Performance level "${level.name}" created successfully.`,
      });
      resetLevelForm();
      invalidateMatrix();
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
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
      input: { name: string; sortOrder: number };
    }) => updatePerformanceLevel(id, input),
    onSuccess: (level) => {
      setFormMessage({
        tone: "success",
        text: `Performance level "${level.name}" updated successfully.`,
      });
      resetLevelForm();
      invalidateMatrix();
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const deleteLevelMutation = useMutation({
    mutationFn: deletePerformanceLevel,
    onSuccess: () => {
      setFormMessage({
        tone: "success",
        text: "Performance level deleted successfully.",
      });
      if (editingLevel) {
        resetLevelForm();
      }
      if (selectedLevelId) {
        setSelectedLevelId(null);
        resetQuartileForm();
      }
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
      resetQuartileForm();
      invalidateMatrix();
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
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
      resetQuartileForm();
      invalidateMatrix();
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const deleteQuartileMutation = useMutation({
    mutationFn: deletePerformanceQuartile,
    onSuccess: () => {
      setFormMessage({
        tone: "success",
        text: "Quartile deleted successfully.",
      });
      if (editingQuartile) {
        resetQuartileForm();
      }
      invalidateMatrix();
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const selectedLevelQuartiles =
    matrix?.find((level) => level.id === selectedLevelId)?.quartiles ?? [];

  const handleLevelSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);

    if (!selectedFinancialYearId) {
      setFormMessage({
        tone: "error",
        text: "Select a financial year first.",
      });
      return;
    }

    if (!levelName.trim()) {
      setFormMessage({ tone: "error", text: "Level name is required." });
      return;
    }

    const sortOrder = Number(levelSortOrder);

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setFormMessage({
        tone: "error",
        text: "Sort order must be a non-negative integer.",
      });
      return;
    }

    if (editingLevel) {
      updateLevelMutation.mutate({
        id: editingLevel.id,
        input: { matrixLabel: matrixLabel.trim(), name: levelName.trim(), sortOrder },
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
    setFormMessage(null);

    if (!selectedLevelId) {
      setFormMessage({
        tone: "error",
        text: "Select a performance level first.",
      });
      return;
    }

    if (!quartileName.trim()) {
      setFormMessage({ tone: "error", text: "Quartile name is required." });
      return;
    }

    const parsedMin = Number(scoreMin);
    const parsedMax = Number(scoreMax);
    const sortOrder = Number(quartileSortOrder);

    if (!Number.isFinite(parsedMin) || !Number.isFinite(parsedMax)) {
      setFormMessage({
        tone: "error",
        text: "Score min and max must be valid numbers.",
      });
      return;
    }

    if (parsedMin < 0 || parsedMax < 0) {
      setFormMessage({
        tone: "error",
        text: "Scores must be zero or greater.",
      });
      return;
    }

    if (parsedMin >= parsedMax) {
      setFormMessage({
        tone: "error",
        text: "Minimum score must be less than maximum score.",
      });
      return;
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setFormMessage({
        tone: "error",
        text: "Sort order must be a non-negative integer.",
      });
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

  const handleEditLevel = (level: PerformanceLevelWithQuartiles) => {
    setEditingLevel(level);
    setMatrixLabel(level.matrixLabel);
    setLevelName(level.name);
    setLevelSortOrder(String(level.sortOrder));
    setFormMessage(null);
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

  const handleEditQuartile = (quartile: PerformanceQuartileRecord) => {
    setEditingQuartile(quartile);
    setQuartileName(quartile.name);
    setScoreMin(formatPerformanceScore(quartile.scoreMin));
    setScoreMax(formatPerformanceScore(quartile.scoreMax));
    setQuartileSortOrder(String(quartile.sortOrder));
    setFormMessage(null);
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
  const matrixOptions = Array.from(
    new Set([...(matrixLabels ?? []), "Default"]),
  ).sort((a, b) => a.localeCompare(b));

  const handleCreateMatrixLabel = () => {
    const label = newMatrixLabel.trim();
    if (!label) {
      setFormMessage({ tone: "error", text: "Matrix label is required." });
      return;
    }

    setSelectedMatrixLabel(label);
    setMatrixLabel(label);
    setNewMatrixLabel("");
    setSelectedLevelId(null);
    resetQuartileForm();
    setFormMessage({
      tone: "success",
      text: `Matrix "${label}" selected. Add performance levels to initialize it.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-300/80 p-6 dark:border-white/15">
        <h2 className="text-lg font-semibold text-text-primary">
          Performance Matrix Configuration
        </h2>
        <p className="mt-1 text-sm text-foreground/70">
          Select a financial year, define performance levels, and assign quartile
          score ranges. The combined matrix appears below.
        </p>

        <div className="mt-4 max-w-xs">
          <label
            htmlFor="matrix-financial-year"
            className="mb-1.5 block text-sm font-medium text-text-primary"
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
            disabled={yearsLoading || !financialYears?.length}
            className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
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
        <div className="mt-4 max-w-xs">
          <label
            htmlFor="matrix-label-filter"
            className="mb-1.5 block text-sm font-medium text-text-primary"
          >
            Performance Matrix
          </label>
          <select
            id="matrix-label-filter"
            value={selectedMatrixLabel}
            onChange={(event) => {
              setSelectedMatrixLabel(event.target.value);
              setMatrixLabel(event.target.value);
              setSelectedLevelId(null);
              resetQuartileForm();
              setFormMessage(null);
            }}
            className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
          >
            {matrixOptions.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 dark:border-white/20">
          <p className="text-sm font-semibold text-text-primary">
            Add Another Performance Matrix
          </p>
          <p className="mt-1 text-xs text-foreground/70">
            Create a new matrix label for this financial year (for example: Matrix A, Matrix B).
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={newMatrixLabel}
              onChange={(event) => setNewMatrixLabel(event.target.value)}
              placeholder="Enter new matrix label"
              className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15 sm:max-w-sm"
            />
            <button
              type="button"
              onClick={handleCreateMatrixLabel}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            >
              <Plus className="size-4" />
              Add Matrix
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {formMessage ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`overflow-hidden rounded-xl border px-4 py-3 text-sm font-medium ${
              formMessage.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/30 dark:bg-emerald-950/20 dark:text-emerald-300"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-300"
            }`}
          >
            {formMessage.text}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-300/80 p-6 dark:border-white/15">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                {editingLevel ? "Edit Performance Level" : "Add Performance Level"}
              </h3>
              <p className="mt-1 text-sm text-foreground/70">
                Levels define the rows in the performance matrix.
              </p>
            </div>

            {editingLevel ? (
              <button
                type="button"
                onClick={() => {
                  resetLevelForm();
                  setFormMessage(null);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
              >
                <X className="size-3.5" />
                Cancel
              </button>
            ) : null}
          </div>

          <form onSubmit={handleLevelSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="matrix-label"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                Matrix Label
              </label>
              <input
                id="matrix-label"
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
                htmlFor="level-name"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                Level Name
              </label>
              <input
                id="level-name"
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
                htmlFor="level-sort-order"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                Sort Order
              </label>
              <input
                id="level-sort-order"
                type="number"
                min={0}
                value={levelSortOrder}
                onChange={(event) => setLevelSortOrder(event.target.value)}
                disabled={!selectedFinancialYearId}
                className="w-full max-w-xs rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
              />
            </div>

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
          </form>

          {matrixLoading ? (
            <p className="mt-6 text-sm text-foreground/70">Loading levels...</p>
          ) : null}

          {matrixError ? (
            <p className="mt-6 text-sm text-red-600 dark:text-red-400">
              Failed to load performance levels.
            </p>
          ) : null}

          {!matrixLoading && matrix && matrix.length > 0 ? (
            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-300/80 dark:border-white/15">
              <table className="min-w-full text-sm">
                <thead className="bg-primary/5">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-text-primary">
                      Matrix
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-text-primary">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-text-primary">
                      Sort
                    </th>
                   
                    <th className="px-4 py-3 text-right font-semibold text-text-primary">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((level) => (
                    <tr
                      key={level.id}
                      className={`border-t border-slate-300/80 dark:border-white/15 ${
                        selectedLevelId === level.id ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {level.matrixLabel}
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {level.name}
                      </td>
                      <td className="px-4 py-3 text-text-primary">
                        {level.sortOrder}
                      </td>
                      
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLevelId(level.id);
                              resetQuartileForm();
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                          >
                            Quartiles
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditLevel(level)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLevel(level)}
                            disabled={deleteLevelMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-60 dark:border-red-900"
                          >
                            <Trash2 className="size-3.5" />
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

        <div className="rounded-xl border border-slate-300/80 p-6 dark:border-white/15">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                {editingQuartile ? "Edit Quartile" : "Add Quartile"}
              </h3>
              <p className="mt-1 text-sm text-foreground/70">
                Quartiles define score ranges within a performance level.
              </p>
            </div>

            {editingQuartile ? (
              <button
                type="button"
                onClick={() => {
                  resetQuartileForm();
                  setFormMessage(null);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
              >
                <X className="size-3.5" />
                Cancel
              </button>
            ) : null}
          </div>

          <div className="mt-4 max-w-xs">
            <label
              htmlFor="quartile-level"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Performance Level
            </label>
            <select
              id="quartile-level"
              value={selectedLevelId ?? ""}
              onChange={(event) => {
                setSelectedLevelId(Number(event.target.value));
                resetQuartileForm();
                setFormMessage(null);
              }}
              disabled={!matrix?.length}
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

          <form onSubmit={handleQuartileSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="quartile-name"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                Quartile Name
              </label>
              <input
                id="quartile-name"
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
                  htmlFor="score-min"
                  className="mb-1.5 block text-sm font-medium text-text-primary"
                >
                  Score Min
                </label>
                <input
                  id="score-min"
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
                  htmlFor="score-max"
                  className="mb-1.5 block text-sm font-medium text-text-primary"
                >
                  Score Max
                </label>
                <input
                  id="score-max"
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
                htmlFor="quartile-sort-order"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                Sort Order
              </label>
              <input
                id="quartile-sort-order"
                type="number"
                min={0}
                value={quartileSortOrder}
                onChange={(event) => setQuartileSortOrder(event.target.value)}
                disabled={!selectedLevelId}
                className="w-full max-w-xs rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-white/15"
              />
            </div>

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
          </form>

          {selectedLevelId && selectedLevelQuartiles.length > 0 ? (
            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-300/80 dark:border-white/15">
              <table className="min-w-full text-sm">
                <thead className="bg-primary/5">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-text-primary">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-text-primary">
                      Score Range
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-text-primary">
                      Sort
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-text-primary">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedLevelQuartiles.map((quartile) => (
                    <tr
                      key={quartile.id}
                      className="border-t border-slate-300/80 dark:border-white/15"
                    >
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {quartile.name}
                      </td>
                      <td className="px-4 py-3 text-text-primary">
                        {formatPerformanceScore(quartile.scoreMin)} –{" "}
                        {formatPerformanceScore(quartile.scoreMax)}
                      </td>
                      <td className="px-4 py-3 text-text-primary">
                        {quartile.sortOrder}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditQuartile(quartile)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuartile(quartile)}
                            disabled={deleteQuartileMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-60 dark:border-red-900"
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : selectedLevelId ? (
            <p className="mt-6 text-sm text-foreground/70">
              No quartiles defined for this level yet.
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-slate-300/80 p-6 dark:border-white/15">
          <h3 className="text-base font-semibold text-text-primary">
            Assign Performance Matrix to Employees
          </h3>
          <p className="mt-1 text-sm text-foreground/70">
            Assign the selected performance matrix label to multiple employees.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <select
              value={selectedMatrixLabel}
              onChange={(event) => setSelectedMatrixLabel(event.target.value)}
              className="rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
            >
              {[...(matrixLabels ?? []), "Default"]
                .filter((value, idx, arr) => arr.indexOf(value) === idx)
                .map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
            </select>
            <select
              multiple
              value={selectedEmployeeIds}
              onChange={(event) => {
                const selected = Array.from(event.currentTarget.selectedOptions).map(
                  (option) => option.value,
                );
                setSelectedEmployeeIds(selected);
              }}
              className="min-h-28 rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
            >
              {(users ?? []).map((user) => (
                <option key={user.id} value={user.employeeId}>
                  {user.employeeId} - {`${user.firstName} ${user.lastName}`.trim()}
                </option>
              ))}
            </select>
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
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            Assign Selected Employees
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Grid3X3 className="size-5 text-primary" />
          <h3 className="text-base font-semibold text-text-primary">
            Combined Performance Matrix
          </h3>
        </div>
        <p className="text-sm text-foreground/70">
          Levels and quartiles combined into a single matrix view for the selected
          financial year.
        </p>
        <PerformanceMatrixGrid levels={matrix ?? []} />
      </div>
    </div>
  );
}
