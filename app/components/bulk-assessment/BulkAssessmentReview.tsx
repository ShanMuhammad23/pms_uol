"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
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
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/app/hooks/use-is-client";
import { QuestionRequiredIndicator } from "@/app/components/forms/QuestionRequiredIndicator";
import { FormDescription } from "@/app/components/forms/FormDescription";
import { RatingScoreField } from "@/app/components/forms/RatingScoreField";
import AttachmentList from "@/app/components/attachments/AttachmentList";
import { getSubmissionAttachmentDownloadUrl } from "@/app/helpers/attachments";

interface BulkAssessmentReviewProps {
  role: string | null;
  userId: number | null;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

type BulkDraft = {
  pointsEarned: string;
  ratingValue: string;
  remarks: string;
};

function emptyBulkDraft(): BulkDraft {
  return { pointsEarned: "", ratingValue: "", remarks: "" };
}

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
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [designationFilter, setDesignationFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // --- Selection state ---
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showWorkspace, setShowWorkspace] = useState(false);

  // --- Question navigation ---
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [drafts, setDrafts] = useState<Map<number, BulkDraft>>(new Map());
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

  // --- Filter options (derived from queue data) ---
  const departmentOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const item of queueItems) {
      const dept = item.orgLevel1Name ?? item.entityName ?? null;
      if (dept) set.set(dept, dept);
    }
    return Array.from(set.entries()).map(([value, label]) => ({ value, label }));
  }, [queueItems]);

  const designationOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const item of queueItems) {
      if (item.designation) set.set(item.designation, item.designation);
    }
    return Array.from(set.entries()).map(([value, label]) => ({ value, label }));
  }, [queueItems]);

  const statusOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const item of queueItems) {
      const label = APPRAISAL_STATUS_LABELS[item.status] ?? item.status;
      set.set(item.status, label);
    }
    return Array.from(set.entries()).map(([value, label]) => ({ value, label }));
  }, [queueItems]);

  const levelOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const item of queueItems) {
      const lvl = item.managerLevel ?? 1;
      const value = String(lvl);
      set.set(value, `M${lvl}`);
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
      if (departmentFilter.length > 0) {
        const dept = item.orgLevel1Name ?? item.entityName ?? "";
        if (!departmentFilter.includes(dept)) return false;
      }
      if (designationFilter.length > 0) {
        if (!item.designation || !designationFilter.includes(item.designation)) return false;
      }
      if (statusFilter.length > 0) {
        if (!statusFilter.includes(item.status)) return false;
      }
      if (levelFilter.length > 0) {
        const lvl = String(item.managerLevel ?? 1);
        if (!levelFilter.includes(lvl)) return false;
      }
      if (dateFilter) {
        if (!item.submittedAt) return false;
        const itemDate = item.submittedAt.slice(0, 10);
        if (itemDate !== dateFilter) return false;
      }
      return true;
    });
  }, [queueItems, search, departmentFilter, designationFilter, statusFilter, levelFilter, dateFilter]);

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

  const filterResetKey = `${search}\0${departmentFilter.join(",")}\0${designationFilter.join(",")}\0${statusFilter.join(",")}\0${levelFilter.join(",")}\0${dateFilter}`;
  const [prevFilterResetKey, setPrevFilterResetKey] = useState(filterResetKey);
  if (filterResetKey !== prevFilterResetKey) {
    setPrevFilterResetKey(filterResetKey);
    setPage(1);
  }

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

  const [prevQuestion, setPrevQuestion] = useState(currentQuestion);
  if (currentQuestion !== prevQuestion) {
    setPrevQuestion(currentQuestion);
    if (!currentQuestion) {
      setDrafts(new Map());
      setModifiedRows(new Set());
    } else {
      const next = new Map<number, BulkDraft>();
      for (const row of currentQuestion.rows) {
        const managerLevel = managerLevelBySubmissionId.get(row.submissionId) ?? 1;
        const fallbackScore =
          managerLevel === 2
            ? (row.manager1Score ?? row.selfScore)
            : row.selfScore;
        const fallbackRating =
          managerLevel === 2
            ? (row.manager1Rating ?? row.selfRating)
            : row.selfRating;
        const fallbackRemarks =
          managerLevel === 2
            ? (row.manager1Remarks ?? row.selfRemarks)
            : row.selfRemarks;
        const points = row.managerScore ?? fallbackScore;
        const rating = row.managerRating ?? fallbackRating;
        const remarks = row.managerRemarks ?? fallbackRemarks;
        next.set(row.submissionId, {
          pointsEarned: points == null ? "" : String(points),
          ratingValue: rating == null ? "" : String(rating),
          remarks: remarks ?? "",
        });
      }
      setDrafts(next);
      setModifiedRows(new Set());
    }
  }

  const updateDraft = useCallback(
    (submissionId: number, patch: Partial<BulkDraft>) => {
      setDrafts((prev) => {
        const next = new Map(prev);
        const existing = next.get(submissionId) ?? emptyBulkDraft();
        next.set(submissionId, { ...existing, ...patch });
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
        const ratingValue =
          draft.ratingValue === "" ? null : Number(draft.ratingValue);
        entries.push({
          submissionId,
          pointsEarned: points,
          ratingValue:
            ratingValue != null && !Number.isNaN(ratingValue) ? ratingValue : null,
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
      const ratingQuestion = Boolean(
        currentQuestion.ratingBased && currentQuestion.ratingScale,
      );
      if (ratingQuestion) {
        if (!draft || draft.ratingValue === "") {
          missing.add(row.submissionId);
        }
      } else if (
        !draft ||
        draft.pointsEarned === "" ||
        Number.isNaN(Number(draft.pointsEarned))
      ) {
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
        templateDescription={questionData?.templateDescription}
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
      designationFilter={designationFilter}
      statusFilter={statusFilter}
      levelFilter={levelFilter}
      dateFilter={dateFilter}
      departmentOptions={departmentOptions}
      designationOptions={designationOptions}
      statusOptions={statusOptions}
      levelOptions={levelOptions}
      currentPage={currentPage}
      totalPages={totalPages}
      totalFiltered={filteredQueue.length}
      role={role}
      onSearch={setSearch}
      onDepartmentFilter={setDepartmentFilter}
      onDesignationFilter={setDesignationFilter}
      onStatusFilter={setStatusFilter}
      onLevelFilter={setLevelFilter}
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
  departmentFilter: string[];
  designationFilter: string[];
  statusFilter: string[];
  levelFilter: string[];
  dateFilter: string;
  departmentOptions: Array<{ value: string; label: string }>;
  designationOptions: Array<{ value: string; label: string }>;
  statusOptions: Array<{ value: string; label: string }>;
  levelOptions: Array<{ value: string; label: string }>;
  currentPage: number;
  totalPages: number;
  totalFiltered: number;
  role: string | null;
  onSearch: (value: string) => void;
  onDepartmentFilter: (value: string[]) => void;
  onDesignationFilter: (value: string[]) => void;
  onStatusFilter: (value: string[]) => void;
  onLevelFilter: (value: string[]) => void;
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
  designationFilter,
  statusFilter,
  levelFilter,
  dateFilter,
  departmentOptions,
  designationOptions,
  statusOptions,
  levelOptions,
  currentPage,
  totalPages,
  totalFiltered,
  role,
  onSearch,
  onDepartmentFilter,
  onDesignationFilter,
  onStatusFilter,
  onLevelFilter,
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
          {(search || departmentFilter.length > 0 || designationFilter.length > 0 || statusFilter.length > 0 || levelFilter.length > 0 || dateFilter) && (
            <button
              type="button"
              onClick={() => {
                onSearch("");
                onDepartmentFilter([]);
                onDesignationFilter([]);
                onStatusFilter([]);
                onLevelFilter([]);
                onDateFilter("");
              }}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Clear filters
            </button>
          )}
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
          <thead className="border-b border-slate-200 bg-primary dark:border-white/10">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-white">
              <th className="px-3 py-3 w-10"></th>
              <th className="px-3 py-3">
                <BulkHeaderFilter
                  label="Employee"
                  type="text"
                  value={search}
                  onChange={onSearch}
                />
              </th>
              <th className="px-3 py-3">
                <BulkHeaderFilter
                  label="Department"
                  type="multi"
                  options={departmentOptions}
                  selected={departmentFilter}
                  onChange={onDepartmentFilter}
                />
              </th>
              <th className="px-3 py-3">
                <BulkHeaderFilter
                  label="Designation"
                  type="multi"
                  options={designationOptions}
                  selected={designationFilter}
                  onChange={onDesignationFilter}
                />
              </th>
              <th className="px-3 py-3">
                <BulkHeaderFilter
                  label="Submitted"
                  type="date"
                  value={dateFilter}
                  onChange={onDateFilter}
                />
              </th>
              <th className="px-3 py-3">
                <BulkHeaderFilter
                  label="Status"
                  type="multi"
                  options={statusOptions}
                  selected={statusFilter}
                  onChange={onStatusFilter}
                />
              </th>
              <th className="px-3 py-3">
                <BulkHeaderFilter
                  label="Level"
                  type="multi"
                  options={levelOptions}
                  selected={levelFilter}
                  onChange={onLevelFilter}
                />
              </th>
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
/* Header Filter Dropdown                                                      */
/* -------------------------------------------------------------------------- */

interface FilterOption {
  value: string;
  label: string;
}

type BulkHeaderFilterType = "text" | "multi" | "date";

interface BulkHeaderFilterProps {
  label: string;
  type: BulkHeaderFilterType;
  /** For text/date filters */
  value?: string;
  /** For multi-select filters */
  selected?: string[];
  options?: FilterOption[];
  onChange: (value: string) => void;
}

interface BulkHeaderFilterMultiProps {
  label: string;
  type: "multi";
  selected: string[];
  options: FilterOption[];
  onChange: (value: string[]) => void;
}

function getMenuPosition(trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const gap = 4;
  const preferredMaxHeight = 300;
  const preferredWidth = 240;
  const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
  const spaceAbove = rect.top - gap - 8;
  const openUpward = spaceBelow < 200 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    180,
    Math.min(preferredMaxHeight, openUpward ? spaceAbove : spaceBelow),
  );

  let left = rect.left;
  if (left + preferredWidth > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - preferredWidth - 8);
  }

  return {
    top: openUpward ? rect.top - gap : rect.bottom + gap,
    left,
    width: preferredWidth,
    maxHeight,
    openUpward,
  };
}

function BulkHeaderFilter(props: BulkHeaderFilterProps | BulkHeaderFilterMultiProps) {
  const { label, type } = props;
  const value = "value" in props ? props.value ?? "" : "";
  const selected = "selected" in props ? props.selected ?? [] : [];
  const options = "options" in props ? props.options ?? [] : [];
  const onChange = props.onChange;
  // Normalize onChange to accept both string and string[] depending on type
  const onChangeAny = onChange as (value: string | string[]) => void;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draftText, setDraftText] = useState("");
  const [position, setPosition] = useState<ReturnType<typeof getMenuPosition> | null>(null);
  const mounted = useIsClient();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const isActive = useMemo(() => {
    if (type === "text") return value.trim().length > 0;
    if (type === "date") return value.length > 0;
    return selected.length > 0;
  }, [type, value, selected.length]);

  // Sync draft text when opening text filter
  const draftSyncKey = open && type === "text" ? `${label}:${value}` : "";
  const [prevDraftSyncKey, setPrevDraftSyncKey] = useState(draftSyncKey);
  if (draftSyncKey !== prevDraftSyncKey) {
    setPrevDraftSyncKey(draftSyncKey);
    if (open && type === "text") {
      setDraftText(value);
    }
  }

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const updatePosition = () => {
      if (triggerRef.current) {
        setPosition(getMenuPosition(triggerRef.current));
      }
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setQuery("");
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selectedSet = new Set(selected);
  const allSelected = options.length > 0 && selected.length === options.length;
  const noneSelected = selected.length === 0;

  const filteredOptions = options.filter((opt) => {
    if (!query.trim()) return true;
    return opt.label.toLowerCase().includes(query.trim().toLowerCase());
  });

  const handleToggle = (val: string) => {
    const next = selected.includes(val)
      ? selected.filter((v) => v !== val)
      : [...selected, val];
    onChangeAny(next);
  };

  const clearFilter = () => {
    if (type === "text" || type === "date") {
      onChangeAny("");
    } else {
      onChangeAny([]);
    }
    setQuery("");
    setOpen(false);
  };

  const applyTextFilter = () => {
    onChangeAny(draftText);
    setOpen(false);
  };

  const menu =
    open && mounted && position
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="dialog"
            aria-label={`Filter ${label}`}
            style={{
              position: "fixed",
              top: position.openUpward ? undefined : position.top,
              bottom: position.openUpward
                ? window.innerHeight - position.top
                : undefined,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              zIndex: 1000,
            }}
            className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-white/5">
              <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                {label}
              </p>
              <button
                type="button"
                onClick={clearFilter}
                disabled={!isActive}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            </div>

            {type === "text" ? (
              <div className="space-y-2 p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    autoFocus
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyTextFilter();
                      }
                    }}
                    placeholder="Contains..."
                    className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300/60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyTextFilter}
                  className="w-full rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
                >
                  Apply
                </button>
              </div>
            ) : type === "date" ? (
              <div className="p-3">
                <input
                  type="date"
                  autoFocus
                  value={value}
                  onChange={(e) => onChangeAny(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 px-3 text-xs text-slate-700 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300/60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
                />
              </div>
            ) : (
              <>
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => onChangeAny(options.map((o) => o.value))}
                    disabled={allSelected || options.length === 0}
                    className="text-[11px] font-semibold text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline dark:text-slate-300"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeAny([])}
                    disabled={noneSelected || options.length === 0}
                    className="text-[11px] font-semibold text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline dark:text-slate-300"
                  >
                    Unselect all
                  </button>
                </div>

                {options.length > 8 ? (
                  <div className="relative shrink-0 border-b border-slate-100 px-2 py-2 dark:border-white/5">
                    <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search..."
                      className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300/60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
                    />
                  </div>
                ) : null}

                <ul className="min-h-0 flex-1 overflow-y-auto py-1">
                  {filteredOptions.length === 0 ? (
                    <li className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                      No options
                    </li>
                  ) : (
                    filteredOptions.map((opt) => {
                      const checked = selectedSet.has(opt.value);
                      return (
                        <li key={opt.value}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={checked}
                            onClick={() => handleToggle(opt.value)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/4"
                          >
                            <span
                              className={cn(
                                "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                                checked
                                  ? "border-slate-700 bg-slate-700 text-white dark:border-slate-300 dark:bg-slate-300 dark:text-slate-900"
                                  : "border-slate-300 dark:border-white/20",
                              )}
                            >
                              {checked ? (
                                <Check className="h-2.5 w-2.5" strokeWidth={3} />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              {opt.label}
                            </span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="inline-flex items-center gap-1">
      <span>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Filter by ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((c) => !c)}
        onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded transition-colors",
          isActive
            ? "bg-white text-primary"
            : "text-white/70 hover:bg-white/15 hover:text-white",
          open && !isActive && "bg-white/15 text-white",
        )}
      >
        <Filter className="h-3 w-3" />
      </button>
      {menu}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Workspace View (Right Panel)                                                */
/* -------------------------------------------------------------------------- */

interface WorkspaceViewProps {
  questions: BulkReviewQuestionData[];
  templateDescription?: string | null;
  currentQuestionIdx: number;
  currentQuestion: BulkReviewQuestionData | null;
  drafts: Map<number, BulkDraft>;
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
  onUpdateDraft: (submissionId: number, patch: Partial<BulkDraft>) => void;
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
  templateDescription,
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

      <FormDescription description={templateDescription} className="mb-4" />

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
              <p className="whitespace-pre-wrap text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {currentQuestion.sectionTitle}
              </p>
            ) : null}
            <h2 className="mt-1 whitespace-pre-wrap text-base font-semibold text-slate-900 dark:text-white">
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
                  <th className="px-3 py-3 min-w-[180px]">Self Remarks</th>
                  <th className="min-w-[12rem] px-3 py-3 text-right">Manager Score</th>
                  <th className="px-3 py-3">Remarks</th>
                  <th className="px-3 py-3 min-w-[160px]">Attachments</th>
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
                      <td className="px-3 py-3">
                        {row.selfRemarks ? (
                          <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                            {row.selfRemarks}
                          </p>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="min-w-0 max-w-[14rem] overflow-hidden px-3 py-3 text-right">
                        {currentQuestion.ratingBased && currentQuestion.ratingScale ? (
                          <RatingScoreField
                            scale={currentQuestion.ratingScale}
                            weight={currentQuestion.totalMarks}
                            ratingValue={draft?.ratingValue ?? ""}
                            onRatingChange={(ratingValue, pointsEarned) =>
                              onUpdateDraft(row.submissionId, {
                                ratingValue,
                                pointsEarned,
                              })
                            }
                            className={cn(
                              isMissing && "[&_select]:border-red-400",
                            )}
                          />
                        ) : (
                        <input
                          type="number"
                          min={0}
                          max={currentQuestion.totalMarks}
                          step="0.5"
                          value={draft?.pointsEarned ?? ""}
                          onChange={(e) =>
                            onUpdateDraft(row.submissionId, {
                              pointsEarned: clampScore(
                                e.target.value,
                                currentQuestion.totalMarks,
                              ),
                            })
                          }
                          className={cn(
                            "h-8 w-20 rounded border bg-white px-2 text-right text-sm font-bold tabular-nums outline-none focus:ring-2 dark:bg-slate-800",
                            isMissing
                              ? "border-red-400 text-red-700 focus:ring-red-400 dark:border-red-700 dark:text-red-300"
                              : "border-slate-300 text-violet-700 focus:ring-violet-400 dark:border-white/15 dark:text-violet-300",
                          )}
                          placeholder="0"
                        />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          value={draft?.remarks ?? ""}
                          onChange={(e) =>
                            onUpdateDraft(row.submissionId, {
                              remarks: e.target.value,
                            })
                          }
                          className="w-full min-w-[160px] rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-violet-400 dark:border-white/15 dark:bg-slate-800 dark:text-slate-300"
                          placeholder="Optional remarks"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <AttachmentList
                          attachments={row.attachments}
                          buildDownloadUrl={(attachmentId) =>
                            getSubmissionAttachmentDownloadUrl(
                              row.submissionId,
                              attachmentId,
                            )
                          }
                          compact
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
