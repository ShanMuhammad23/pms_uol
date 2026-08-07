"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBulkReviewQueue,
  fetchBulkReviewQuestionData,
  finishBulkReview,
  saveBulkReviewQuestionScores,
  type BulkReviewQueueItem,
  type BulkReviewQuestionData,
  type SaveBulkReviewEntry,
} from "@/lib/queries/bulk-assessment-client";
import { APPRAISAL_STATUS_LABELS } from "@/types/forms";
import { cn } from "@/lib/utils";
import { QuestionRequiredIndicator } from "@/app/components/forms/QuestionRequiredIndicator";

interface BulkAssessmentReviewProps {
  role: string | null;
  userId: number | null;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function clampScore(value: string, maxMarks: number): string {
  if (value === "") return "";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "";
  if (parsed < 0) return "0";
  if (parsed > maxMarks) return String(maxMarks);
  return value;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function BulkAssessmentReview({
  role,
  userId,
}: BulkAssessmentReviewProps) {
  const queryClient = useQueryClient();

  // --- Queue state ---
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // --- Selection state ---
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showWorkspace, setShowWorkspace] = useState(false);

  // --- Question navigation ---
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [drafts, setDrafts] = useState<
    Map<number, { pointsEarned: string; remarks: string }>
  >(new Map());
  const [modifiedRows, setModifiedRows] = useState<Set<number>>(new Set());
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [finishResult, setFinishResult] = useState<{
    approved: Array<{ id: number; managerLevel: number; status: string }>;
    skipped: Array<{ id: number; reason: string }>;
  } | null>(null);

  // --- Queue query ---
  const {
    data: queueData,
    isLoading: queueLoading,
    refetch: refetchQueue,
    isFetching: queueFetching,
  } = useQuery({
    queryKey: ["bulk-review-queue", userId],
    queryFn: fetchBulkReviewQueue,
    enabled: userId != null,
  });

  const queueItems = useMemo(
    () => queueData?.items ?? [],
    [queueData],
  );

  // --- Department options ---
  const departmentOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const item of queueItems) {
      const dept = item.orgLevel1Name ?? item.entityName ?? null;
      if (dept) set.set(dept, dept);
    }
    return Array.from(set.entries()).map(([value, label]) => ({ value, label }));
  }, [queueItems]);

  // --- Filtered queue ---
  const filteredQueue = useMemo(() => {
    const q = search.trim().toLowerCase();
    return queueItems.filter((item) => {
      if (q) {
        const matches =
          item.employeeName.toLowerCase().includes(q) ||
          item.employeeId.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (departmentFilter) {
        const dept = item.orgLevel1Name ?? item.entityName ?? "";
        if (dept !== departmentFilter) return false;
      }
      if (dateFilter) {
        if (!item.submittedAt) return false;
        const itemDate = item.submittedAt.slice(0, 10);
        if (itemDate !== dateFilter) return false;
      }
      return true;
    });
  }, [queueItems, search, departmentFilter, dateFilter]);

  // --- Pagination ---
  const totalPages = Math.max(1, Math.ceil(filteredQueue.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedQueue = useMemo(
    () =>
      filteredQueue.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize,
      ),
    [filteredQueue, currentPage],
  );

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, departmentFilter, dateFilter]);

  // --- Selection ---
  const allOnPageSelected = useMemo(
    () =>
      paginatedQueue.length > 0 &&
      paginatedQueue.every((item) => selectedIds.has(item.id)),
    [paginatedQueue, selectedIds],
  );

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const item of paginatedQueue) next.delete(item.id);
      } else {
        for (const item of paginatedQueue) next.add(item.id);
      }
      return next;
    });
  }, [allOnPageSelected, paginatedQueue]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setShowWorkspace(false);
  }, []);

  // --- Question data query (enabled when workspace is shown) ---
  const selectedIdArray = useMemo(
    () => Array.from(selectedIds).sort((a, b) => a - b),
    [selectedIds],
  );

  const {
    data: questionData,
    isLoading: questionsLoading,
    error: questionsError,
  } = useQuery({
    queryKey: ["bulk-review-questions", selectedIdArray],
    queryFn: () => fetchBulkReviewQuestionData(selectedIdArray),
    enabled: showWorkspace && selectedIdArray.length > 0,
  });

  const questions = questionData?.questions ?? [];
  const totalQuestions = questions.length;
  const currentQuestion: BulkReviewQuestionData | null =
    questions[currentQuestionIdx] ?? null;

  // --- Draft management ---
  // When question data loads or question changes, initialize drafts from
  // saved scores. Mirrors the individual assessment flow's buildManagerDraftMap:
  //   - Manager 1: managerScore → selfScore → ""
  //   - Manager 2: managerScore → manager1Score → selfScore → ""
  // This pre-fills the manager assessment column with the employee's
  // self-assessment (or Manager 1's score for Manager 2) when the manager
  // hasn't saved their own score yet — exactly like the individual flow.
  const managerLevelBySubmissionId = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of questionData?.submissions ?? []) {
      map.set(s.id, s.managerLevel ?? 1);
    }
    return map;
  }, [questionData?.submissions]);

  useEffect(() => {
    if (!currentQuestion) {
      setDrafts(new Map());
      setModifiedRows(new Set());
      return;
    }

    const next = new Map<number, { pointsEarned: string; remarks: string }>();
    for (const row of currentQuestion.rows) {
      const managerLevel = managerLevelBySubmissionId.get(row.submissionId) ?? 1;

      // Fallback chain mirrors buildManagerDraftMap in SubmissionDetailView:
      //   Manager 1: managerScore → selfScore → ""
      //   Manager 2: managerScore → manager1Score → selfScore → ""
      //   Remarks follow the same chain: managerRemarks → (mgr1Remarks) → selfRemarks → ""
      const fallbackScore =
        managerLevel === 2
          ? (row.manager1Score ?? row.selfScore)
          : row.selfScore;
      const fallbackRemarks =
        managerLevel === 2
          ? (row.manager1Remarks ?? row.selfRemarks)
          : row.selfRemarks;

      const points = row.managerScore ?? fallbackScore;
      const remarks = row.managerRemarks ?? fallbackRemarks;

      next.set(row.submissionId, {
        pointsEarned: points != null ? String(points) : "",
        remarks: remarks ?? "",
      });
    }
    setDrafts(next);
    setModifiedRows(new Set());
  }, [currentQuestion?.questionId, managerLevelBySubmissionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDraft = useCallback(
    (submissionId: number, field: "pointsEarned" | "remarks", value: string) => {
      setDrafts((prev) => {
        const next = new Map(prev);
        const existing = next.get(submissionId) ?? {
          pointsEarned: "",
          remarks: "",
        };
        next.set(submissionId, { ...existing, [field]: value });
        return next;
      });
      setModifiedRows((prev) => {
        const next = new Set(prev);
        next.add(submissionId);
        return next;
      });
    },
    [],
  );

  // --- Save mutation ---
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentQuestion) return;
      const entries: SaveBulkReviewEntry[] = [];
      for (const [submissionId, draft] of drafts) {
        const points = Number(draft.pointsEarned);
        if (Number.isNaN(points)) continue;
        entries.push({
          submissionId,
          pointsEarned: points,
          remarks: draft.remarks.trim() || null,
        });
      }
      if (entries.length === 0) return;
      return saveBulkReviewQuestionScores(currentQuestion.questionId, entries);
    },
    onSuccess: () => {
      // Invalidate question data to refetch saved scores
      void queryClient.invalidateQueries({
        queryKey: ["bulk-review-questions", selectedIdArray],
      });
    },
  });

  // --- Finish mutation ---
  const finishMutation = useMutation({
    mutationFn: () => finishBulkReview(selectedIdArray),
    onSuccess: (result) => {
      setFinishResult(result);
      void queryClient.invalidateQueries({
        queryKey: ["bulk-review-queue", userId],
      });
    },
  });

  // --- Navigation ---
  const goNext = useCallback(() => {
    if (saveMutation.isPending) return;
    saveMutation.mutate();
    if (currentQuestionIdx < totalQuestions - 1) {
      setCurrentQuestionIdx((idx) => idx + 1);
    }
  }, [saveMutation, currentQuestionIdx, totalQuestions]);

  const goPrev = useCallback(() => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx((idx) => idx - 1);
    }
  }, [currentQuestionIdx]);

  const handleStartReview = useCallback(() => {
    if (selectedIds.size === 0) return;
    setCurrentQuestionIdx(0);
    setShowWorkspace(true);
  }, [selectedIds.size]);

  const handleBackToList = useCallback(() => {
    setShowWorkspace(false);
  }, []);

  const handleFinishConfirm = useCallback(() => {
    finishMutation.mutate();
  }, [finishMutation]);

  const handleFinishClose = useCallback(() => {
    setFinishDialogOpen(false);
    if (finishResult) {
      // Clear approved submissions from selection
      const approvedIds = new Set(finishResult.approved.map((r) => r.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of approvedIds) next.delete(id);
        return next;
      });
      setFinishResult(null);
      if (selectedIds.size - approvedIds.size === 0) {
        setShowWorkspace(false);
      }
    }
  }, [finishResult, selectedIds.size]);

  // --- Progress ---
  const progressPercent =
    totalQuestions > 0
      ? Math.round(((currentQuestionIdx + 1) / totalQuestions) * 100)
      : 0;

  const isLastQuestion = currentQuestionIdx === totalQuestions - 1;

  // --- Validation ---
  const missingScores = useMemo(() => {
    if (!currentQuestion) return new Set<number>();
    const missing = new Set<number>();
    for (const row of currentQuestion.rows) {
      const draft = drafts.get(row.submissionId);
      if (!draft || draft.pointsEarned === "" || Number.isNaN(Number(draft.pointsEarned))) {
        missing.add(row.submissionId);
      }
    }
    return missing;
  }, [currentQuestion, drafts]);

  /* -------------------------------------------------------------------------- */
  /* Render                                                                      */
  /* -------------------------------------------------------------------------- */

  if (showWorkspace) {
    return (
      <WorkspaceView
        questions={questions}
        currentQuestionIdx={currentQuestionIdx}
        currentQuestion={currentQuestion}
        drafts={drafts}
        modifiedRows={modifiedRows}
        missingScores={missingScores}
        progressPercent={progressPercent}
        totalQuestions={totalQuestions}
        isLastQuestion={isLastQuestion}
        isLoading={questionsLoading}
        error={questionsError}
        savePending={saveMutation.isPending}
        finishPending={finishMutation.isPending}
        finishDialogOpen={finishDialogOpen}
        finishResult={finishResult}
        selectedCount={selectedIdArray.length}
        onUpdateDraft={updateDraft}
        onPrev={goPrev}
        onNext={goNext}
        onFinish={() => setFinishDialogOpen(true)}
        onFinishConfirm={handleFinishConfirm}
        onFinishClose={handleFinishClose}
        onBackToList={handleBackToList}
        onJumpToQuestion={setCurrentQuestionIdx}
      />
    );
  }

  return (
    <ListView
      queueItems={paginatedQueue}
      selectedIds={selectedIds}
      allOnPageSelected={allOnPageSelected}
      selectedCount={selectedIds.size}
      isLoading={queueLoading}
      isFetching={queueFetching}
      search={search}
      departmentFilter={departmentFilter}
      dateFilter={dateFilter}
      departmentOptions={departmentOptions}
      currentPage={currentPage}
      totalPages={totalPages}
      totalFiltered={filteredQueue.length}
      role={role}
      onSearch={setSearch}
      onDepartmentFilter={setDepartmentFilter}
      onDateFilter={setDateFilter}
      onToggleSelectAll={toggleSelectAll}
      onToggleSelect={toggleSelect}
      onClearSelection={clearSelection}
      onRefresh={() => refetchQueue()}
      onPageChange={setPage}
      onStartReview={handleStartReview}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* List View (Left Panel)                                                      */
/* -------------------------------------------------------------------------- */

interface ListViewProps {
  queueItems: BulkReviewQueueItem[];
  selectedIds: Set<number>;
  allOnPageSelected: boolean;
  selectedCount: number;
  isLoading: boolean;
  isFetching: boolean;
  search: string;
  departmentFilter: string;
  dateFilter: string;
  departmentOptions: Array<{ value: string; label: string }>;
  currentPage: number;
  totalPages: number;
  totalFiltered: number;
  role: string | null;
  onSearch: (value: string) => void;
  onDepartmentFilter: (value: string) => void;
  onDateFilter: (value: string) => void;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: number) => void;
  onClearSelection: () => void;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
  onStartReview: () => void;
}

function ListView({
  queueItems,
  selectedIds,
  allOnPageSelected,
  selectedCount,
  isLoading,
  isFetching,
  search,
  departmentFilter,
  dateFilter,
  departmentOptions,
  currentPage,
  totalPages,
  totalFiltered,
  role,
  onSearch,
  onDepartmentFilter,
  onDateFilter,
  onToggleSelectAll,
  onToggleSelect,
  onClearSelection,
  onRefresh,
  onPageChange,
  onStartReview,
}: ListViewProps) {
  return (
    <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Bulk Assessment Review
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Review multiple submitted assessments question-by-question.
            {role === "MANAGER" ? " You are signed in as a Manager." : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
        >
          <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search employee name or ID..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <select
          value={departmentFilter}
          onChange={(e) => onDepartmentFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 dark:border-white/10 dark:bg-slate-950 dark:text-white"
        >
          <option value="">All Departments</option>
          {departmentOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFilter}
          onChange={(e) => onDateFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 dark:border-white/10 dark:bg-slate-950 dark:text-white"
        />

        {(search || departmentFilter || dateFilter) && (
          <button
            type="button"
            onClick={() => {
              onSearch("");
              onDepartmentFilter("");
              onDateFilter("");
            }}
            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Selection bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={onToggleSelectAll}
              className="size-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 dark:border-white/20"
            />
            <span>Select all on page</span>
          </label>
          {selectedCount > 0 ? (
            <span className="font-medium text-amber-700 dark:text-amber-300">
              {selectedCount} selected
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={onClearSelection}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Clear selection
            </button>
          ) : null}
          <button
            type="button"
            onClick={onStartReview}
            disabled={selectedCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowRight className="size-4" />
            Start Review ({selectedCount})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/60 dark:border-white/10 dark:bg-slate-800/40">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="px-3 py-3 w-10"></th>
              <th className="px-3 py-3">Employee</th>
              <th className="px-3 py-3">Department</th>
              <th className="px-3 py-3">Designation</th>
              <th className="px-3 py-3">Submitted</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center text-slate-400">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </td>
              </tr>
            ) : queueItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center text-slate-400">
                  No pending submissions to review.
                </td>
              </tr>
            ) : (
              queueItems.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "transition-colors",
                      isSelected
                        ? "bg-amber-50/60 dark:bg-amber-950/15"
                        : "hover:bg-slate-50/60 dark:hover:bg-slate-800/20",
                    )}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(item.id)}
                        className="size-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 dark:border-white/20"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {item.employeeName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {item.employeeId}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                      {item.orgLevel1Name ?? item.entityName ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                      {item.designation ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                      {formatDate(item.submittedAt)}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        {APPRAISAL_STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                      M{item.managerLevel ?? 1}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {totalFiltered} submission{totalFiltered !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 text-sm text-slate-600 dark:text-slate-300">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Workspace View (Right Panel)                                                */
/* -------------------------------------------------------------------------- */

interface WorkspaceViewProps {
  questions: BulkReviewQuestionData[];
  currentQuestionIdx: number;
  currentQuestion: BulkReviewQuestionData | null;
  drafts: Map<number, { pointsEarned: string; remarks: string }>;
  modifiedRows: Set<number>;
  missingScores: Set<number>;
  progressPercent: number;
  totalQuestions: number;
  isLastQuestion: boolean;
  isLoading: boolean;
  error: Error | null;
  savePending: boolean;
  finishPending: boolean;
  finishDialogOpen: boolean;
  finishResult: {
    approved: Array<{ id: number; managerLevel: number; status: string }>;
    skipped: Array<{ id: number; reason: string }>;
  } | null;
  selectedCount: number;
  onUpdateDraft: (
    submissionId: number,
    field: "pointsEarned" | "remarks",
    value: string,
  ) => void;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
  onFinishConfirm: () => void;
  onFinishClose: () => void;
  onBackToList: () => void;
  onJumpToQuestion: (idx: number) => void;
}

function WorkspaceView({
  questions,
  currentQuestionIdx,
  currentQuestion,
  drafts,
  modifiedRows,
  missingScores,
  progressPercent,
  totalQuestions,
  isLastQuestion,
  isLoading,
  error,
  savePending,
  finishPending,
  finishDialogOpen,
  finishResult,
  selectedCount,
  onUpdateDraft,
  onPrev,
  onNext,
  onFinish,
  onFinishConfirm,
  onFinishClose,
  onBackToList,
  onJumpToQuestion,
}: WorkspaceViewProps) {
  return (
    <div className="flex flex-col h-full px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToList}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <ArrowLeft className="size-4" />
            Back to List
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              Assessment Workspace
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedCount} submission{selectedCount !== 1 ? "s" : ""} selected
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Question {Math.min(currentQuestionIdx + 1, totalQuestions)} of {totalQuestions}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {progressPercent}% complete
            </p>
          </div>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question navigation bar */}
      {totalQuestions > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-slate-900">
          {questions.map((q, idx) => (
            <button
              key={q.questionId}
              type="button"
              onClick={() => onJumpToQuestion(idx)}
              title={q.questionText.slice(0, 80)}
              className={cn(
                "size-7 rounded text-xs font-medium transition-colors",
                idx === currentQuestionIdx
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
              )}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      ) : null}

      {/* Question content */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-red-600 dark:text-red-400">
            {error.message}
          </p>
        </div>
      ) : !currentQuestion ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-slate-400">
            No scored questions found for the selected submissions.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Question header */}
          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            {currentQuestion.sectionTitle ? (
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {currentQuestion.sectionTitle}
              </p>
            ) : null}
            <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
              Question {currentQuestionIdx + 1}: {currentQuestion.questionText}
              <QuestionRequiredIndicator isRequired={currentQuestion.isRequired} />
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Max marks: {currentQuestion.totalMarks}
            </p>
          </div>

          {/* Score table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/60 dark:border-white/10 dark:bg-slate-800/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-3 w-10"></th>
                  <th className="px-3 py-3">Employee</th>
                  <th className="px-3 py-3 text-right">Self Score</th>
                  <th className="px-3 py-3 text-right">Manager Score</th>
                  <th className="px-3 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                {currentQuestion.rows.map((row) => {
                  const draft = drafts.get(row.submissionId);
                  const isModified = modifiedRows.has(row.submissionId);
                  const isMissing = missingScores.has(row.submissionId);
                  return (
                    <tr
                      key={row.submissionId}
                      className={cn(
                        "transition-colors",
                        isMissing
                          ? "bg-red-50/60 dark:bg-red-950/20"
                          : isModified
                            ? "bg-amber-50/40 dark:bg-amber-950/10"
                            : "hover:bg-slate-50/60 dark:hover:bg-slate-800/20",
                      )}
                    >
                      <td className="px-3 py-3">
                        {isModified ? (
                          <span className="inline-flex size-2 rounded-full bg-amber-500" title="Modified" />
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {row.employeeName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {row.employeeId}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold text-teal-700 dark:text-teal-300">
                        {row.selfScore != null ? row.selfScore : "—"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          max={currentQuestion.totalMarks}
                          step="0.5"
                          value={draft?.pointsEarned ?? ""}
                          onChange={(e) =>
                            onUpdateDraft(
                              row.submissionId,
                              "pointsEarned",
                              clampScore(e.target.value, currentQuestion.totalMarks),
                            )
                          }
                          className={cn(
                            "h-8 w-20 rounded border bg-white px-2 text-right text-sm font-bold tabular-nums outline-none focus:ring-2 dark:bg-slate-800",
                            isMissing
                              ? "border-red-400 text-red-700 focus:ring-red-400 dark:border-red-700 dark:text-red-300"
                              : "border-slate-300 text-violet-700 focus:ring-violet-400 dark:border-white/15 dark:text-violet-300",
                          )}
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          value={draft?.remarks ?? ""}
                          onChange={(e) =>
                            onUpdateDraft(
                              row.submissionId,
                              "remarks",
                              e.target.value,
                            )
                          }
                          className="w-full min-w-[160px] rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-violet-400 dark:border-white/15 dark:bg-slate-800 dark:text-slate-300"
                          placeholder="Optional remarks"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Validation warning */}
          {missingScores.size > 0 ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {missingScores.size} submission{missingScores.size !== 1 ? "s" : ""} missing a manager score. Please fill in all scores before continuing.
            </p>
          ) : null}
        </div>
      )}

      {/* Footer navigation */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentQuestionIdx <= 0 || savePending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
        >
          <ChevronLeft className="size-4" />
          Previous
        </button>

        <div className="flex items-center gap-2">
          {saveMutation_pending(savePending) ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="inline size-3.5 animate-spin" /> Saving...
            </span>
          ) : null}
          {modifiedRows.size > 0 ? (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {modifiedRows.size} unsaved change{modifiedRows.size !== 1 ? "s" : ""}
            </span>
          ) : null}
        </div>

        {isLastQuestion ? (
          <button
            type="button"
            onClick={onFinish}
            disabled={savePending || finishPending || totalQuestions === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle2 className="size-4" />
            Finish Review
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={savePending || totalQuestions === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            Save & Next
            <ChevronRight className="size-4" />
          </button>
        )}
      </div>

      {/* Finish confirmation dialog */}
      <AnimatePresence>
        {finishDialogOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.button
              type="button"
              onClick={() => !finishPending ? onFinishClose() : undefined}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
              aria-label="Close"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-slate-900"
            >
              {finishResult ? (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Review Complete
                  </h3>
                  <div className="mt-4 space-y-2 text-sm">
                    <p className="text-green-600 dark:text-green-400">
                      {finishResult.approved.length} submission{finishResult.approved.length !== 1 ? "s" : ""} approved successfully.
                    </p>
                    {finishResult.skipped.length > 0 ? (
                      <div className="mt-2">
                        <p className="font-medium text-amber-600 dark:text-amber-400">
                          {finishResult.skipped.length} skipped:
                        </p>
                        <ul className="mt-1 space-y-1">
                          {finishResult.skipped.map((s) => (
                            <li key={s.id} className="text-xs text-slate-600 dark:text-slate-400">
                              Submission #{s.id}: {s.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={onFinishClose}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Finish Bulk Review?
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    This will approve the manager review for {selectedCount} submission{selectedCount !== 1 ? "s" : ""}.
                    Each submission will advance to the next workflow stage (Manager 2 or HR Alignment)
                    using the existing approval logic.
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Make sure all scores have been saved before finishing.
                  </p>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={onFinishClose}
                      disabled={finishPending}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={onFinishConfirm}
                      disabled={finishPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {finishPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      Confirm & Approve
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function saveMutation_pending(pending: boolean): boolean {
  return pending;
}
