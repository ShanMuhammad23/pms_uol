"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBulkReviewQueue,
  fetchBulkReviewQuestionData,
  finishBulkReview,
  saveBulkReviewQuestionScores,
  saveBulkAuthoredAnswers,
  type BulkReviewQueueItem,
  type BulkReviewQuestionData,
  type BulkAuthoredAnswerData,
  type SaveBulkReviewEntry,
  type SaveBulkAuthoredEntry,
} from "@/lib/queries/bulk-assessment-client";
import { confirmManager2OpenAssessment } from "@/lib/queries/direct-assessment-client";
import { cn } from "@/lib/utils";
import { QuestionRequiredIndicator } from "@/app/components/forms/QuestionRequiredIndicator";
import { FormDescription } from "@/app/components/forms/FormDescription";
import { HtmlTitle } from "@/app/components/forms/HtmlTitle";
import { RatingScoreField, AnswerScoreReadout } from "@/app/components/forms/RatingScoreField";
import {
  formatScoreValue,
  resolveDisplayedAnswerPoints,
} from "@/app/helpers/form-rating-scoring";
import { toast } from "react-hot-toast";
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

function missingBulkScoreMessage(
  missingCount: number,
  ratingBased: boolean,
): string {
  if (ratingBased) {
    return missingCount === 1
      ? "Select a rating for the highlighted employee before continuing."
      : `Select a rating for ${missingCount} highlighted employees before continuing.`;
  }
  return missingCount === 1
    ? "Enter a score for the highlighted employee before continuing. A mark of 0 is allowed."
    : `Enter a score for ${missingCount} highlighted employees before continuing. A mark of 0 is allowed.`;
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
/* Authored question drafts (open-assessment sections)                        */
/* -------------------------------------------------------------------------- */

interface AuthoredDraft {
  clientId: string;
  authoredQuestionText: string;
  authoredTotalMarks: string;
  pointsEarned: string;
  ratingValue: string;
  remarks: string;
}

let authoredClientIdCounter = 0;
function nextAuthoredClientId(): string {
  authoredClientIdCounter += 1;
  return `ba-authored-${Date.now()}-${authoredClientIdCounter}`;
}

/** Build initial authored drafts from question data.
 * submissionId → sectionId → drafts[] */
function buildInitialAuthoredDrafts(
  questions: BulkReviewQuestionData[],
): Map<number, Map<number, AuthoredDraft[]>> {
  const state = new Map<number, Map<number, AuthoredDraft[]>>();

  for (const q of questions) {
    if (!q.isOpenAssessment || q.openSectionId == null) continue;

    for (const row of q.rows) {
      // Seed from the current reviewer's authored answers first.
      // If the reviewer has none, fall back to Manager 1's authored answers
      // (for Manager 2 viewing Manager 1's questions).
      const ownAuthored = row.managerAuthoredAnswers ?? [];
      const mgr1Authored = row.manager1AuthoredAnswers ?? [];
      const source = ownAuthored.length > 0 ? ownAuthored : mgr1Authored;
      const usingFallback = ownAuthored.length === 0 && mgr1Authored.length > 0;

      const drafts: AuthoredDraft[] = source.map((a) => ({
        clientId: nextAuthoredClientId(),
        authoredQuestionText: a.authoredQuestionText ?? "",
        authoredTotalMarks: String(a.authoredTotalMarks ?? 0),
        pointsEarned: String(a.pointsEarned ?? 0),
        ratingValue: a.ratingValue == null ? "" : String(a.ratingValue),
        // Never copy remarks from the fallback source.
        remarks: usingFallback ? "" : (a.remarks ?? ""),
      }));

      let sectionMap = state.get(row.submissionId);
      if (!sectionMap) {
        sectionMap = new Map();
        state.set(row.submissionId, sectionMap);
      }
      sectionMap.set(q.openSectionId, drafts);
    }
  }

  return state;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function BulkAssessmentReview({
  role,
  userId,
}: BulkAssessmentReviewProps) {
  const queryClient = useQueryClient();

  // --- View state ---
  type ViewMode = "forms" | "select" | "workspace";
  const [viewMode, setViewMode] = useState<ViewMode>("forms");
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<Set<number>>(new Set());

  // --- Question navigation ---
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  // Furthest question the manager has unlocked by scoring+saving.
  // Questions at index <= maxUnlockedIdx are accessible.
  // Starts at 0 (only the first question is accessible).
  const [maxUnlockedIdx, setMaxUnlockedIdx] = useState(0);
  const [drafts, setDrafts] = useState<Map<number, BulkDraft>>(new Map());
  const [modifiedRows, setModifiedRows] = useState<Set<number>>(new Set());
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [finishResult, setFinishResult] = useState<{
    approved: Array<{ id: number; managerLevel: number; status: string }>;
    skipped: Array<{ id: number; reason: string }>;
  } | null>(null);

  // --- Authored draft state (open-assessment sections) ---
  // submissionId → sectionId → drafts[]
  const [authoredDrafts, setAuthoredDrafts] = useState<
    Map<number, Map<number, AuthoredDraft[]>>
  >(new Map());
  const authoredDraftsRef = useRef(authoredDrafts);
  authoredDraftsRef.current = authoredDrafts;
  // Track which submission+section pairs have been modified.
  const [authoredModified, setAuthoredModified] = useState<Set<string>>(new Set());
  // Manager 2 open assessment confirmation modal.
  const [confirmModalSubmissionId, setConfirmModalSubmissionId] = useState<number | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);

  // --- Queue query ---
  const {
    data: queueData,
    isLoading: queueLoading,
    refetch: refetchQueue,
  } = useQuery({
    queryKey: ["bulk-review-queue", userId],
    queryFn: fetchBulkReviewQueue,
    enabled: userId != null,
  });

  const queueItems = useMemo(
    () => queueData?.items ?? [],
    [queueData],
  );

    // --- Group selected employees by template for the forms view ---
  const formGroups = useMemo(() => {
    const groups = new Map<
      number,
      {
        templateId: number;
        templateTitle: string;
        templateCode: string | null;
        submissionIds: number[];
        employeeNames: string[];
      }
    >();
    for (const item of queueItems) {
      if (item.templateId == null) continue;
      const existing = groups.get(item.templateId);
      if (existing) {
        existing.submissionIds.push(item.id);
        existing.employeeNames.push(item.employeeName);
      } else {
        groups.set(item.templateId, {
          templateId: item.templateId,
          templateTitle: item.templateTitle ?? "Untitled Form",
          templateCode: item.templateCode,
          submissionIds: [item.id],
          employeeNames: [item.employeeName],
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) =>
      a.templateTitle.localeCompare(b.templateTitle),
    );
  }, [queueItems]);

  // --- Question data query (enabled when workspace is shown) ---
  const workspaceSubmissionIds = useMemo(() => {
    if (viewMode !== "workspace" || activeTemplateId == null) return [];
    return Array.from(selectedSubmissionIds).sort((a, b) => a - b);
  }, [selectedSubmissionIds, activeTemplateId, viewMode]);

  const {
    data: questionData,
    isLoading: questionsLoading,
    error: questionsError,
  } = useQuery({
    queryKey: ["bulk-review-questions", workspaceSubmissionIds],
    queryFn: () => fetchBulkReviewQuestionData(workspaceSubmissionIds),
    enabled: viewMode === "workspace" && workspaceSubmissionIds.length > 0,
  });

  const questions = questionData?.questions ?? [];
  const totalQuestions = questions.length;
  const currentQuestion: BulkReviewQuestionData | null =
    questions[currentQuestionIdx] ?? null;

  // Initialize authored drafts when question data loads.
  const [prevQuestionData, setPrevQuestionData] = useState(questionData);
  if (questionData !== prevQuestionData) {
    setPrevQuestionData(questionData);
    if (questionData) {
      const initial = buildInitialAuthoredDrafts(questionData.questions);
      setAuthoredDrafts(initial);
      setAuthoredModified(new Set());
    }
  }

  // Open assessment sections in the current template.
  const openAssessmentSections = useMemo(
    () => questions.filter((q) => q.isOpenAssessment),
    [questions],
  );

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
        // Remarks are NOT copied from the previous stage — each manager
        // writes their own remarks.
        const points = row.managerScore ?? fallbackScore;
        const rating = row.managerRating ?? fallbackRating;
        const remarks = row.managerRemarks ?? "";
        const computedPoints =
          points == null && rating == null
            ? null
            : resolveDisplayedAnswerPoints(
                {
                  totalMarks: currentQuestion.totalMarks,
                  ratingScaleId: currentQuestion.ratingScale?.id ?? null,
                },
                currentQuestion.ratingBased,
                currentQuestion.ratingScale
                  ? [currentQuestion.ratingScale]
                  : [],
                { pointsEarned: points, ratingValue: rating },
              );
        next.set(row.submissionId, {
          pointsEarned: computedPoints == null ? "" : String(computedPoints),
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

  // --- Authored draft helpers (open-assessment sections) ---

  const addAuthoredRow = useCallback(
    (submissionId: number, sectionId: number, budget: number) => {
      // Enforce section budget — block adding when allocated >= budget.
      const existing =
        authoredDraftsRef.current.get(submissionId)?.get(sectionId) ?? [];
      const allocated = existing.reduce(
        (sum, d) => sum + (Number(d.authoredTotalMarks) || 0),
        0,
      );
      if (budget > 0 && allocated >= budget) {
        toast.error(
          `Section budget of ${budget} marks is fully allocated. Reduce the marks of existing questions to add more.`,
        );
        return;
      }
      setAuthoredDrafts((prev) => {
        const next = new Map(prev);
        let sectionMap = next.get(submissionId);
        if (!sectionMap) {
          sectionMap = new Map();
          next.set(submissionId, sectionMap);
        }
        const drafts = sectionMap.get(sectionId) ?? [];
        sectionMap.set(sectionId, [
          ...drafts,
          {
            clientId: nextAuthoredClientId(),
            authoredQuestionText: "",
            authoredTotalMarks: "",
            pointsEarned: "",
            ratingValue: "",
            remarks: "",
          },
        ]);
        return next;
      });
      setAuthoredModified((prev) => {
        const next = new Set(prev);
        next.add(`${submissionId}:${sectionId}`);
        return next;
      });
    },
    [],
  );

  const removeAuthoredRow = useCallback(
    (submissionId: number, sectionId: number, clientId: string) => {
      setAuthoredDrafts((prev) => {
        const next = new Map(prev);
        const sectionMap = next.get(submissionId);
        if (!sectionMap) return prev;
        const drafts = sectionMap.get(sectionId) ?? [];
        sectionMap.set(
          sectionId,
          drafts.filter((d) => d.clientId !== clientId),
        );
        return next;
      });
      setAuthoredModified((prev) => {
        const next = new Set(prev);
        next.add(`${submissionId}:${sectionId}`);
        return next;
      });
    },
    [],
  );

  const updateAuthoredDraft = useCallback(
    (
      submissionId: number,
      sectionId: number,
      clientId: string,
      field: keyof AuthoredDraft,
      value: string,
    ) => {
      setAuthoredDrafts((prev) => {
        const next = new Map(prev);
        let sectionMap = next.get(submissionId);
        if (!sectionMap) {
          sectionMap = new Map();
          next.set(submissionId, sectionMap);
        }
        const drafts = sectionMap.get(sectionId) ?? [];
        sectionMap.set(
          sectionId,
          drafts.map((d) =>
            d.clientId === clientId ? { ...d, [field]: value } : d,
          ),
        );
        return next;
      });
      setAuthoredModified((prev) => {
        const next = new Set(prev);
        next.add(`${submissionId}:${sectionId}`);
        return next;
      });
    },
    [],
  );

  // --- Manager 2 open assessment confirmation mutation ---
  const confirmOpenAssessmentMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      return confirmManager2OpenAssessment(submissionId);
    },
    onSuccess: () => {
      toast.success("Open assessment confirmed.");
      void queryClient.invalidateQueries({
        queryKey: ["bulk-review-questions", workspaceSubmissionIds],
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to confirm open assessment.");
    },
  });

  // --- Save mutation ---
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentQuestion) return;

      // Open assessment section — save authored answers.
      if (currentQuestion.isOpenAssessment && currentQuestion.openSectionId != null) {
        const sectionId = currentQuestion.openSectionId;
        const entries: SaveBulkAuthoredEntry[] = [];
        for (const row of currentQuestion.rows) {
          const drafts = authoredDraftsRef.current.get(row.submissionId)?.get(sectionId) ?? [];
          const authoredQuestions = drafts
            .map((d) => {
              const text = d.authoredQuestionText.trim();
              const totalMarks = Number(d.authoredTotalMarks) || 0;
              const points = d.pointsEarned !== "" ? Number(d.pointsEarned) : 0;
              const rating = d.ratingValue !== "" ? Number(d.ratingValue) : null;
              const remarks = d.remarks.trim() || null;
              // Skip blank rows — no text, no marks, no points, no remarks.
              if (!text && !totalMarks && !points && !remarks) return null;
              return {
                authoredQuestionText: text || null,
                authoredTotalMarks: totalMarks,
                pointsEarned: points,
                ratingValue: rating,
                remarks,
              };
            })
            .filter((q): q is NonNullable<typeof q> => q !== null);
          if (authoredQuestions.length === 0) continue;
          entries.push({ submissionId: row.submissionId, authoredQuestions });
        }
        if (entries.length === 0) return;
        return saveBulkAuthoredAnswers(sectionId, entries);
      }

      // Normal question — save scores.
      const entries: SaveBulkReviewEntry[] = [];
      for (const [submissionId, draft] of drafts) {
        const hasPoints =
          draft.pointsEarned !== "" && Number.isFinite(Number(draft.pointsEarned));
        const ratingValue =
          draft.ratingValue === "" ? null : Number(draft.ratingValue);
        const hasRating = ratingValue != null && !Number.isNaN(ratingValue);
        const remarks = draft.remarks.trim() || null;
        if (!hasPoints && !hasRating && !remarks) continue;
        entries.push({
          submissionId,
          pointsEarned: hasPoints ? Number(draft.pointsEarned) : 0,
          ratingValue: hasRating ? ratingValue : null,
          remarks,
        });
      }
      if (entries.length === 0) return;
      return saveBulkReviewQuestionScores(currentQuestion.questionId, entries);
    },
    onSuccess: (result) => {
      if (result) {
        toast.success("Scores saved.");
      }
      // Invalidate question data to refetch saved scores
      void queryClient.invalidateQueries({
        queryKey: ["bulk-review-questions", workspaceSubmissionIds],
      });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save scores.");
    },
  });

  // --- Finish mutation ---
  const finishMutation = useMutation({
    mutationFn: () => finishBulkReview(workspaceSubmissionIds),
    onSuccess: (result) => {
      setFinishResult(result);
      const approvedCount = result.approved.length;
      const skippedCount = result.skipped.length;
      if (skippedCount > 0) {
        toast.error(
          `${approvedCount} approved, ${skippedCount} skipped. Check the summary for details.`,
        );
      } else {
        toast.success(
          `${approvedCount} submission${approvedCount !== 1 ? "s" : ""} approved.`,
        );
      }
      void queryClient.invalidateQueries({
        queryKey: ["bulk-review-queue", userId],
      });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to finish the review.",
      );
    },
  });

  // --- Navigation ---


  const handleOpenForm = useCallback((templateId: number) => {
    setActiveTemplateId(templateId);
    // Pre-select all employees for this form by default.
    const group = formGroups.find((g) => g.templateId === templateId);
    setSelectedSubmissionIds(new Set(group?.submissionIds ?? []));
    setViewMode("select");
  }, [formGroups]);

  const handleStartReview = useCallback(() => {
    if (selectedSubmissionIds.size === 0) return;
    setCurrentQuestionIdx(0);
    setMaxUnlockedIdx(0);
    setViewMode("workspace");
  }, [selectedSubmissionIds.size]);

  const handleBackToForms = useCallback(() => {
    setViewMode("forms");
    setActiveTemplateId(null);
    setSelectedSubmissionIds(new Set());
  }, []);

  const handleBackToSelect = useCallback(() => {
    setViewMode("select");
  }, []);

  const handleFinishConfirm = useCallback(() => {
    finishMutation.mutate();
  }, [finishMutation]);

  const handleFinishClose = useCallback(() => {
    setFinishDialogOpen(false);
    if (finishResult) {
      setFinishResult(null);
      // Remove approved submissions from selection
      const approvedIds = new Set(finishResult.approved.map((r) => r.id));
      setSelectedSubmissionIds((prev) => {
        const next = new Set(prev);
        for (const id of approvedIds) next.delete(id);
        return next;
      });
      // Refetch the queue so approved submissions disappear.
      void queryClient.invalidateQueries({
        queryKey: ["bulk-review-queue", userId],
      });
      // If no more selected submissions remain, go back to forms.
      if (selectedSubmissionIds.size - approvedIds.size === 0) {
        setViewMode("forms");
        setActiveTemplateId(null);
      } else {
        // Go back to the selection view to continue with remaining employees.
        setViewMode("select");
      }
    }
  }, [finishResult, queryClient, userId, selectedSubmissionIds.size]);

  // --- Progress ---
  const progressPercent =
    totalQuestions > 0
      ? Math.round(((currentQuestionIdx + 1) / totalQuestions) * 100)
      : 0;

  const isLastQuestion = currentQuestionIdx === totalQuestions - 1;

  // --- Validation ---
  const missingScores = useMemo(() => {
    if (!currentQuestion) return new Set<number>();
    // Open assessment sections don't block forward navigation —
    // authored questions are optional (matching DirectAssessment behavior).
    if (currentQuestion.isOpenAssessment) return new Set<number>();
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

  const currentQuestionIsRating = Boolean(
    currentQuestion?.ratingBased && currentQuestion.ratingScale,
  );

  const saveAndNavigate = useCallback(
    async (targetQuestionIdx: number) => {
      if (saveMutation.isPending || targetQuestionIdx === currentQuestionIdx) return;
      // Block navigation to questions beyond the furthest unlocked one.
      if (targetQuestionIdx > maxUnlockedIdx) return;
      // For forward navigation, the current question must be fully scored.
      const isForward = targetQuestionIdx > currentQuestionIdx;
      if (isForward && missingScores.size > 0) {
        toast.error(
          missingBulkScoreMessage(missingScores.size, currentQuestionIsRating),
        );
        return;
      }
      try {
        await saveMutation.mutateAsync();
      } catch {
        return;
      }
      // After a successful save, unlock the next question if we're moving forward.
      if (isForward && targetQuestionIdx > maxUnlockedIdx) {
        setMaxUnlockedIdx(targetQuestionIdx);
      }
      setCurrentQuestionIdx(targetQuestionIdx);
    },
    [
      currentQuestionIdx,
      currentQuestionIsRating,
      maxUnlockedIdx,
      missingScores.size,
      saveMutation,
    ],
  );

  const goPrev = useCallback(() => {
    if (currentQuestionIdx > 0) {
      void saveAndNavigate(currentQuestionIdx - 1);
    }
  }, [currentQuestionIdx, saveAndNavigate]);

  const handleJumpToQuestion = useCallback(
    (targetQuestionIdx: number) => {
      void saveAndNavigate(targetQuestionIdx);
    },
    [saveAndNavigate],
  );

  const goNext = useCallback(async () => {
    if (saveMutation.isPending) return;
    if (missingScores.size > 0) {
      toast.error(
        missingBulkScoreMessage(missingScores.size, currentQuestionIsRating),
      );
      return;
    }
    try {
      await saveMutation.mutateAsync();
    } catch {
      return;
    }
    if (currentQuestionIdx < totalQuestions - 1) {
      const nextIdx = currentQuestionIdx + 1;
      if (nextIdx > maxUnlockedIdx) {
        setMaxUnlockedIdx(nextIdx);
      }
      setCurrentQuestionIdx(nextIdx);
    }
  }, [
    saveMutation,
    currentQuestionIsRating,
    missingScores.size,
    currentQuestionIdx,
    totalQuestions,
    maxUnlockedIdx,
  ]);

  const handleFinishClick = useCallback(async () => {
    if (missingScores.size > 0) {
      toast.error(
        missingBulkScoreMessage(missingScores.size, currentQuestionIsRating),
      );
      return;
    }
    // Save the current question's scores before opening the finish dialog.
    // Without this, the last question's scores are never persisted and the
    // server-side approval validation rejects the submission as incomplete.
    if (modifiedRows.size > 0) {
      try {
        await saveMutation.mutateAsync();
      } catch {
        // Error toast is already shown by the mutation's onError handler.
        return;
      }
    }
    setFinishDialogOpen(true);
  }, [currentQuestion, currentQuestionIsRating, missingScores.size, modifiedRows.size, saveMutation]);

  /* -------------------------------------------------------------------------- */
  /* Render                                                                      */
  /* -------------------------------------------------------------------------- */

  if (viewMode === "workspace") {
    return (
      <WorkspaceView
        questions={questions}
        templateDescription={questionData?.templateDescription}
        currentQuestionIdx={currentQuestionIdx}
        currentQuestion={currentQuestion}
        drafts={drafts}
        modifiedRows={modifiedRows}
        missingScores={missingScores}
        hasMissingRequired={missingScores.size > 0}
        maxUnlockedIdx={maxUnlockedIdx}
        progressPercent={progressPercent}
        totalQuestions={totalQuestions}
        isLastQuestion={isLastQuestion}
        isLoading={questionsLoading}
        error={questionsError}
        savePending={saveMutation.isPending}
        finishPending={finishMutation.isPending}
        finishDialogOpen={finishDialogOpen}
        finishResult={finishResult}
        selectedCount={workspaceSubmissionIds.length}
        onUpdateDraft={updateDraft}
        onPrev={goPrev}
        onNext={goNext}
        onFinish={handleFinishClick}
        onFinishConfirm={handleFinishConfirm}
        onFinishClose={handleFinishClose}
        onBackToList={handleBackToSelect}
        onJumpToQuestion={handleJumpToQuestion}
        authoredDrafts={authoredDrafts}
        authoredModified={authoredModified}
        onAddAuthoredRow={addAuthoredRow}
        onRemoveAuthoredRow={removeAuthoredRow}
        onUpdateAuthoredDraft={updateAuthoredDraft}
        managerLevelBySubmissionId={managerLevelBySubmissionId}
        confirmModalSubmissionId={confirmModalSubmissionId}
        confirmSaving={confirmSaving}
        onSetConfirmModal={setConfirmModalSubmissionId}
        onSetConfirmSaving={setConfirmSaving}
        onConfirmOpenAssessment={(submissionId) => {
          setConfirmSaving(true);
          confirmOpenAssessmentMutation.mutate(submissionId, {
            onSuccess: () => {
              setConfirmSaving(false);
              setConfirmModalSubmissionId(null);
            },
            onError: () => {
              setConfirmSaving(false);
            },
          });
        }}
      />
    );
  }

  if (viewMode === "select" && activeTemplateId != null) {
    const activeGroup = formGroups.find((g) => g.templateId === activeTemplateId);
    const employeesForForm = queueItems.filter(
      (item) => item.templateId === activeTemplateId,
    );
    return (
      <EmployeeSelectionView
        templateTitle={activeGroup?.templateTitle ?? "Form"}
        templateCode={activeGroup?.templateCode ?? null}
        employees={employeesForForm}
        selectedIds={selectedSubmissionIds}
        onSelect={setSelectedSubmissionIds}
        onStartReview={handleStartReview}
        onBack={handleBackToForms}
      />
    );
  }

  return (
    <FormsView
      formGroups={formGroups}
      isLoading={queueLoading}
      onOpenForm={handleOpenForm}
      onRefresh={() => refetchQueue()}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Employee Selection View (pick employees to assess for a form)              */
/* -------------------------------------------------------------------------- */

interface EmployeeSelectionViewProps {
  templateTitle: string;
  templateCode: string | null;
  employees: BulkReviewQueueItem[];
  selectedIds: Set<number>;
  onSelect: (ids: Set<number>) => void;
  onStartReview: () => void;
  onBack: () => void;
}

function EmployeeSelectionView({
  templateTitle,
  templateCode,
  employees,
  selectedIds,
  onSelect,
  onStartReview,
  onBack,
}: EmployeeSelectionViewProps) {
  const [search, setSearch] = useState("");

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.employeeName.toLowerCase().includes(q) ||
        e.employeeId.toLowerCase().includes(q),
    );
  }, [employees, search]);

  const allFilteredSelected = useMemo(
    () =>
      filteredEmployees.length > 0 &&
      filteredEmployees.every((e) => selectedIds.has(e.id)),
    [filteredEmployees, selectedIds],
  );

  const toggleSelectAll = useCallback(() => {
    if (allFilteredSelected) {
      // Deselect only the filtered ones
      onSelect(new Set([...selectedIds].filter((id) => !filteredEmployees.some((e) => e.id === id))));
    } else {
      // Select all filtered + already selected
      const next = new Set(selectedIds);
      for (const e of filteredEmployees) next.add(e.id);
      onSelect(next);
    }
  }, [allFilteredSelected, filteredEmployees, selectedIds, onSelect]);

  const toggleSelect = useCallback(
    (id: number) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelect(next);
    },
    [selectedIds, onSelect],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
          >
            <ArrowLeft className="size-4" />
            Back to forms
          </button>
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              {templateTitle}
            </h1>
            <p className="mt-0.5 text-sm text-foreground/70">
              {templateCode && <span className="font-mono">{templateCode} · </span>}
              {employees.length} employee{employees.length !== 1 ? "s" : ""} pending
              review · {selectedIds.size} selected
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onStartReview}
          disabled={selectedIds.size === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          <CheckCircle2 className="size-4" />
          Start Review ({selectedIds.size})
        </button>
      </div>

      {/* Search + Select All */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID..."
            className="w-full rounded-lg border border-slate-300 bg-background py-2 pl-9 pr-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
          />
        </div>
        <button
          type="button"
          onClick={toggleSelectAll}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
        >
          {allFilteredSelected ? (
            <CheckSquare className="size-4 text-primary" />
          ) : (
            <Square className="size-4" />
          )}
          {allFilteredSelected ? "Deselect All" : "Select All"}
        </button>
      </div>

      {/* Employee table */}
      {filteredEmployees.length === 0 ? (
        <div className="rounded-lg border border-slate-300/80 p-12 text-center dark:border-white/15">
          <Users className="mx-auto size-8 text-foreground/50" />
          <p className="mt-3 text-sm font-medium text-text-primary">
            {search ? "No employees match your search." : "No employees pending review."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-300/80 dark:border-white/15">
          <table className="min-w-full text-sm">
            <thead className="bg-primary text-white">
              <tr>
                <th className="w-10 px-4 py-3 text-left">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="inline-flex items-center"
                  >
                    {allFilteredSelected ? (
                      <CheckSquare className="size-4" />
                    ) : (
                      <Square className="size-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-semibold">Employee</th>
                <th className="px-4 py-3 text-left font-semibold">Designation</th>
                <th className="px-4 py-3 text-left font-semibold">Entity</th>
                <th className="px-4 py-3 text-left font-semibold">Level</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
                const isSelected = selectedIds.has(emp.id);
                return (
                  <tr
                    key={emp.id}
                    onClick={() => toggleSelect(emp.id)}
                    className={cn(
                      "cursor-pointer border-t border-slate-300/80 transition-colors dark:border-white/15",
                      isSelected
                        ? "bg-primary/5"
                        : "hover:bg-slate-50/60 dark:hover:bg-slate-800/20",
                    )}
                  >
                    <td className="px-4 py-3">
                      {isSelected ? (
                        <CheckSquare className="size-4 text-primary" />
                      ) : (
                        <Square className="size-4 text-foreground/40" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">
                        {emp.employeeName}
                      </div>
                      <div className="text-xs text-foreground/60">
                        {emp.employeeId}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {emp.designation ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {emp.orgLevel1Name ?? emp.entityName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        M{emp.managerLevel ?? 1}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Forms View (intermediate layer — pick a form to assess)                    */
/* -------------------------------------------------------------------------- */

interface FormGroup {
  templateId: number;
  templateTitle: string;
  templateCode: string | null;
  submissionIds: number[];
  employeeNames: string[];
}

interface FormsViewProps {
  formGroups: FormGroup[];
  isLoading: boolean;
  onOpenForm: (templateId: number) => void;
  onRefresh: () => void;
}

function FormsView({
  formGroups,
  isLoading,
  onOpenForm,
  onRefresh,
}: FormsViewProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary">
            Bulk Assessment Review
          </h1>
          <p className="mt-0.5 text-sm text-foreground/70">
            {formGroups.length} form{formGroups.length !== 1 ? "s" : ""} with
            pending reviews. Open a form to assess its employees in bulk.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
        >
          <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-foreground/70">Loading forms...</span>
        </div>
      ) : formGroups.length === 0 ? (
        <div className="rounded-lg border border-slate-300/80 p-12 text-center dark:border-white/15">
          <FileText className="mx-auto size-8 text-foreground/50" />
          <p className="mt-3 text-sm font-medium text-text-primary">
            No pending reviews
          </p>
          <p className="mt-1 text-sm text-foreground/70">
            There are no submissions awaiting your review at this time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {formGroups.map((group) => (
            <button
              key={group.templateId}
              type="button"
              onClick={() => onOpenForm(group.templateId)}
              className="group flex flex-col gap-3 rounded-xl border border-slate-300/80 bg-white p-5 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md dark:border-white/15 dark:bg-slate-900/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-text-primary group-hover:text-primary">
                      {group.templateTitle}
                    </h3>
                    {group.templateCode && (
                      <p className="mt-0.5 text-xs text-foreground/60">
                        {group.templateCode}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-foreground/70">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" />
                  {group.submissionIds.length} employee{group.submissionIds.length !== 1 ? "s" : ""}
                </span>
              </div>

              {group.employeeNames.length <= 5 ? (
                <p className="truncate text-xs text-foreground/50">
                  {group.employeeNames.join(", ")}
                </p>
              ) : (
                <p className="truncate text-xs text-foreground/50">
                  {group.employeeNames.slice(0, 5).join(", ")}, +{group.employeeNames.length - 5} more
                </p>
              )}

              <div className="mt-auto flex items-center gap-1 pt-2 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                Open form
                <ArrowRight className="size-4" />
              </div>
            </button>
          ))}
        </div>
      )}
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
  hasMissingRequired: boolean;
  maxUnlockedIdx: number;
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
  // Open assessment props
  authoredDrafts: Map<number, Map<number, AuthoredDraft[]>>;
  authoredModified: Set<string>;
  onAddAuthoredRow: (submissionId: number, sectionId: number, budget: number) => void;
  onRemoveAuthoredRow: (submissionId: number, sectionId: number, clientId: string) => void;
  onUpdateAuthoredDraft: (
    submissionId: number,
    sectionId: number,
    clientId: string,
    field: keyof AuthoredDraft,
    value: string,
  ) => void;
  managerLevelBySubmissionId: Map<number, number>;
  confirmModalSubmissionId: number | null;
  confirmSaving: boolean;
  onSetConfirmModal: (id: number | null) => void;
  onSetConfirmSaving: (saving: boolean) => void;
  onConfirmOpenAssessment: (submissionId: number) => void;
}

function WorkspaceView({
  questions,
  templateDescription,
  currentQuestionIdx,
  currentQuestion,
  drafts,
  modifiedRows,
  missingScores,
  hasMissingRequired,
  maxUnlockedIdx,
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
  authoredDrafts,
  authoredModified,
  onAddAuthoredRow,
  onRemoveAuthoredRow,
  onUpdateAuthoredDraft,
  managerLevelBySubmissionId,
  confirmModalSubmissionId,
  confirmSaving,
  onSetConfirmModal,
  onSetConfirmSaving,
  onConfirmOpenAssessment,
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
          {questions.map((q, idx) => {
            // A question button is accessible if:
            //   - it's the current question, OR
            //   - it's at or before the furthest unlocked question
            // Questions beyond maxUnlockedIdx are locked.
            const isLocked = idx > maxUnlockedIdx;
            const isBlocked = isLocked || (hasMissingRequired && idx > currentQuestionIdx);
            return (
              <button
                key={q.questionId}
                type="button"
                onClick={() => onJumpToQuestion(idx)}
                disabled={isBlocked}
                title={isLocked ? "Complete the current question first" : q.questionText.slice(0, 80)}
                className={cn(
                  "size-7 rounded text-xs font-medium transition-colors",
                  idx === currentQuestionIdx
                    ? "bg-primary text-white"
                    : isBlocked
                      ? "cursor-not-allowed bg-slate-100 text-slate-300 opacity-50 dark:bg-slate-800 dark:text-slate-600"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
                )}
              >
                {idx + 1}
              </button>
            );
          })}
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
              <div className="text-xs font-semibold tracking-wide text-amber-600 dark:text-amber-400">
                <HtmlTitle html={currentQuestion.sectionTitle} />
              </div>
            ) : null}
            <h2 className="mt-1 whitespace-pre-wrap text-base font-semibold text-slate-900 dark:text-white">
              Question {currentQuestionIdx + 1}: {currentQuestion.questionText}
              <QuestionRequiredIndicator isRequired={currentQuestion.isRequired} />
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Max marks: {currentQuestion.totalMarks}
            </p>
          </div>

          {/* Open assessment section — per-employee authored question cards */}
          {currentQuestion.isOpenAssessment && currentQuestion.openSectionId != null ? (
            <OpenAssessmentContent
              currentQuestion={currentQuestion}
              authoredDrafts={authoredDrafts}
              authoredModified={authoredModified}
              managerLevelBySubmissionId={managerLevelBySubmissionId}
              onAddAuthoredRow={onAddAuthoredRow}
              onRemoveAuthoredRow={onRemoveAuthoredRow}
              onUpdateAuthoredDraft={onUpdateAuthoredDraft}
              confirmModalSubmissionId={confirmModalSubmissionId}
              confirmSaving={confirmSaving}
              onSetConfirmModal={onSetConfirmModal}
              onSetConfirmSaving={onSetConfirmSaving}
              onConfirmOpenAssessment={onConfirmOpenAssessment}
            />
          ) : (
          <>
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
                      <td className="min-w-0 max-w-[12rem] overflow-hidden px-3 py-3 text-right tabular-nums font-semibold text-teal-700 dark:text-teal-300">
                        {currentQuestion.ratingBased && currentQuestion.ratingScale ? (
                          <AnswerScoreReadout
                            question={{
                              totalMarks: currentQuestion.totalMarks,
                              ratingScaleId: currentQuestion.ratingScale.id,
                            }}
                            ratingBased
                            ratingScales={[currentQuestion.ratingScale]}
                            answer={
                              row.selfRating == null && row.selfScore == null
                                ? undefined
                                : {
                                    pointsEarned: row.selfScore,
                                    ratingValue: row.selfRating,
                                  }
                            }
                            tone="teal"
                          />
                        ) : row.selfScore != null ? (
                          formatScoreValue(row.selfScore)
                        ) : (
                          "—"
                        )}
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
              {missingBulkScoreMessage(
                missingScores.size,
                Boolean(
                  currentQuestion.ratingBased && currentQuestion.ratingScale,
                ),
              )}
            </p>
          ) : null}
          </>
          )}
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
            disabled={savePending || finishPending || totalQuestions === 0 || hasMissingRequired}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle2 className="size-4" />
            Finish Review
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={savePending || totalQuestions === 0 || hasMissingRequired}
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

/* -------------------------------------------------------------------------- */
/* Open Assessment Content (per-employee authored question cards)            */
/* -------------------------------------------------------------------------- */

interface OpenAssessmentContentProps {
  currentQuestion: BulkReviewQuestionData;
  authoredDrafts: Map<number, Map<number, AuthoredDraft[]>>;
  authoredModified: Set<string>;
  managerLevelBySubmissionId: Map<number, number>;
  onAddAuthoredRow: (submissionId: number, sectionId: number, budget: number) => void;
  onRemoveAuthoredRow: (submissionId: number, sectionId: number, clientId: string) => void;
  onUpdateAuthoredDraft: (
    submissionId: number,
    sectionId: number,
    clientId: string,
    field: keyof AuthoredDraft,
    value: string,
  ) => void;
  confirmModalSubmissionId: number | null;
  confirmSaving: boolean;
  onSetConfirmModal: (id: number | null) => void;
  onSetConfirmSaving: (saving: boolean) => void;
  onConfirmOpenAssessment: (submissionId: number) => void;
}

function OpenAssessmentContent({
  currentQuestion,
  authoredDrafts,
  authoredModified,
  managerLevelBySubmissionId,
  onAddAuthoredRow,
  onRemoveAuthoredRow,
  onUpdateAuthoredDraft,
  confirmModalSubmissionId,
  confirmSaving,
  onSetConfirmModal,
  onSetConfirmSaving,
  onConfirmOpenAssessment,
}: OpenAssessmentContentProps) {
  const sectionId = currentQuestion.openSectionId!;
  const budget = currentQuestion.openAssessmentTotalMarks ?? 0;
  const confirmEmp = currentQuestion.rows.find(
    (r) => r.submissionId === confirmModalSubmissionId,
  );

  return (
    <div className="space-y-4">
      {currentQuestion.rows.map((row) => {
        const drafts = authoredDrafts.get(row.submissionId)?.get(sectionId) ?? [];
        const allocated = drafts.reduce(
          (sum, d) => sum + (Number(d.authoredTotalMarks) || 0),
          0,
        );
        const remaining = budget - allocated;
        const totalScore = drafts.reduce(
          (sum, d) => sum + (d.pointsEarned !== "" ? Number(d.pointsEarned) : 0),
          0,
        );
        const managerLevel = managerLevelBySubmissionId.get(row.submissionId) ?? 1;
        const isMgr2 = managerLevel === 2;
        const isModified = authoredModified.has(`${row.submissionId}:${sectionId}`);
        const mgr1Authored = row.manager1AuthoredAnswers ?? [];
        const usingMgr1Fallback =
          (row.managerAuthoredAnswers ?? []).length === 0 && mgr1Authored.length > 0;

        return (
          <div
            key={row.submissionId}
            className={cn(
              "rounded-lg border bg-white p-4 dark:bg-slate-900",
              isModified
                ? "border-amber-300 dark:border-amber-700"
                : "border-slate-200 dark:border-white/10",
            )}
          >
            {/* Employee header */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  M{managerLevel}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {row.employeeName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {row.employeeId}
                  </p>
                </div>
                {usingMgr1Fallback ? (
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">
                    Viewing Manager 1's questions
                  </span>
                ) : null}
              </div>
              {drafts.length > 0 ? (
                <span className="text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {totalScore}/{allocated}
                </span>
              ) : null}
            </div>

            {/* Authored questions */}
            {drafts.length > 0 ? (
              <div className="space-y-2">
                {drafts.map((draft, qIdx) => {
                  const maxMarks = Number(draft.authoredTotalMarks) || 0;
                  return (
                    <div
                      key={draft.clientId}
                      className="flex items-start gap-2 rounded-md border border-slate-100 p-2 dark:border-slate-700/40"
                    >
                      <span className="mt-1.5 w-5 shrink-0 text-xs font-bold tabular-nums text-slate-400 dark:text-slate-500">
                        {qIdx + 1}
                      </span>
                      <textarea
                        value={draft.authoredQuestionText}
                        rows={2}
                        onChange={(e) =>
                          onUpdateAuthoredDraft(
                            row.submissionId,
                            sectionId,
                            draft.clientId,
                            "authoredQuestionText",
                            e.target.value,
                          )
                        }
                        placeholder="Question text..."
                        className="min-w-0 flex-1 resize-y rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:border-white/15 dark:bg-slate-800 dark:text-slate-200"
                      />
                      <div className="flex shrink-0 items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={draft.authoredTotalMarks}
                          onChange={(e) =>
                            onUpdateAuthoredDraft(
                              row.submissionId,
                              sectionId,
                              draft.clientId,
                              "authoredTotalMarks",
                              e.target.value,
                            )
                          }
                          className="h-8 w-16 rounded border border-slate-200 bg-white px-1 text-right text-xs font-bold tabular-nums text-amber-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:border-white/15 dark:bg-slate-800 dark:text-amber-300"
                          placeholder="Marks"
                        />
                        <input
                          type="number"
                          min={0}
                          max={maxMarks || undefined}
                          step="0.5"
                          value={draft.pointsEarned}
                          onChange={(e) =>
                            onUpdateAuthoredDraft(
                              row.submissionId,
                              sectionId,
                              draft.clientId,
                              "pointsEarned",
                              clampScore(e.target.value, maxMarks),
                            )
                          }
                          className="h-8 w-16 rounded border border-slate-200 bg-white px-1 text-right text-xs font-bold tabular-nums text-teal-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-400 dark:border-white/15 dark:bg-slate-800 dark:text-teal-300"
                          placeholder="Score"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            onRemoveAuthoredRow(row.submissionId, sectionId, draft.clientId)
                          }
                          className="flex size-8 shrink-0 items-center justify-center rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                          title="Remove question"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-3 text-center text-xs text-slate-400 dark:text-slate-500">
                No questions authored yet.
              </p>
            )}

            {/* Footer: budget + add question + Manager 2 confirm */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-700/40">
              <div className="flex items-center gap-3">
                {budget > 0 ? (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Allocated:{" "}
                    <span
                      className={cn(
                        "font-bold",
                        remaining < 0
                          ? "text-red-600"
                          : "text-slate-700 dark:text-slate-300",
                      )}
                    >
                      {allocated}
                    </span>
                    {" / "}
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {budget}
                    </span>
                    {remaining < 0 ? (
                      <span className="ml-1 text-red-600">(over budget)</span>
                    ) : null}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onAddAuthoredRow(row.submissionId, sectionId, budget)}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
                >
                  <Plus className="size-3" />
                  Add Question
                </button>
              </div>
              {/* Manager 2 confirmation */}
              {isMgr2 ? (
                <button
                  type="button"
                  onClick={() => onSetConfirmModal(row.submissionId)}
                  disabled={confirmSaving}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="size-3" />
                  Confirm Open Assessment
                </button>
              ) : null}
            </div>
          </div>
        );
      })}

      {/* Manager 2 confirmation modal */}
      {confirmModalSubmissionId != null ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => !confirmSaving && onSetConfirmModal(null)}
        >
          <div
            className="mx-4 max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Confirm Open Assessment Review
              </h3>
              <button
                type="button"
                onClick={() => !confirmSaving && onSetConfirmModal(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-4 text-xs text-slate-600 dark:text-slate-400">
              You are about to confirm that you have reviewed the open/free
              assessment sections for{" "}
              <span className="font-bold">{confirmEmp?.employeeName ?? "this employee"}</span>.
              This action records your review confirmation.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onSetConfirmModal(null)}
                disabled={confirmSaving}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onConfirmOpenAssessment(confirmModalSubmissionId)}
                disabled={confirmSaving}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {confirmSaving ? "Confirming..." : "Confirm Review"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function saveMutation_pending(pending: boolean): boolean {
  return pending;
}
