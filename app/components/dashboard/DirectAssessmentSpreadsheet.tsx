"use client";

import { Fragment, useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchDirectAssessmentData,
  saveDirectAssessmentScores,
  approveDirectAssessment,
  type DirectAssessmentData,
  type DirectAssessmentScope,
} from "@/lib/queries/direct-assessment-client";
import { fetchDashboardEntities } from "@/lib/queries/entities-client";
import { isScoredQuestion } from "@/app/helpers/form-questions";
import {
  formatScoreValue,
  getQuestionRatingScale,
  hasProvidedAnswerScore,
  incompleteRequiredReviewMessage,
  parseDraftScoreAnswer,
  resolveDisplayedAnswerPoints,
  usesRatingScore,
} from "@/app/helpers/form-rating-scoring";
import { toast } from "react-hot-toast";
import {
  AnswerScoreReadout,
  RatingScoreField,
} from "@/app/components/forms/RatingScoreField";
import { QuestionRequiredIndicator } from "@/app/components/forms/QuestionRequiredIndicator";
import { FormDescription } from "@/app/components/forms/FormDescription";
import { cn } from "@/lib/utils";
import {
  buildFormTableRows,
  formatSectionLabel,
  formatSubsectionLabel,
  type FormTableRow,
} from "@/app/helpers/form-table-rows";
import { ArrowLeft, Save, CheckCircle, MessageSquareText } from "lucide-react";
import { DirectAssessmentFilterBar } from "@/app/components/dashboard/DirectAssessmentFilterBar";
import {
  filterDirectAssessmentEmployees,
  useDirectAssessmentFilters,
} from "@/app/queries/direct-assessment-filters";
import DirectAssessmentRemarksModal, {
  type DirectAssessmentRemarksModalValue,
} from "@/app/components/dashboard/DirectAssessmentRemarksModal";
import { ResizableHeader } from "@/app/components/common/ResizableHeader";

interface DirectAssessmentSpreadsheetProps {
  templateId: number;
  onBack: () => void;
  /** Admin split: `managed` is only employees this user manages. */
  scope?: DirectAssessmentScope;
}

/** Default widths for the fixed left columns. */
const DEFAULT_SR_WIDTH = 48;
const DEFAULT_KPI_WIDTH = 320;
const DEFAULT_MAX_WIDTH = 64;
const DEFAULT_EMPLOYEE_WIDTH = 140;
const RATING_EMPLOYEE_WIDTH = 200;
const MIN_COL_WIDTH = 60;
const MAX_COL_WIDTH = 500;
const FROZEN_EDGE_SHADOW =
  "shadow-[6px_0_12px_-8px_rgba(15,23,42,0.28)] dark:shadow-[6px_0_12px_-8px_rgba(0,0,0,0.55)]";

type ScoreDraft = {
  pointsEarned: string;
  ratingValue: string;
  remarks: string;
};

function ratingValueFromDraft(draft: ScoreDraft | undefined): number | null {
  if (!draft?.ratingValue) {
    return null;
  }
  const parsed = Number(draft.ratingValue);
  return Number.isNaN(parsed) ? null : parsed;
}

function draftToSaveAnswer(
  question: { id: number },
  draft: ScoreDraft | undefined,
) {
  const pointsRaw = draft?.pointsEarned;
  const pointsEarned =
    pointsRaw === "" || pointsRaw == null ? undefined : Number(pointsRaw);
  return {
    questionId: question.id,
    pointsEarned:
      pointsEarned != null && Number.isFinite(pointsEarned)
        ? pointsEarned
        : undefined,
    ratingValue: ratingValueFromDraft(draft),
    remarks: draft?.remarks?.trim() || null,
  };
}

type RemarksDraft = {
  manager1: string;
  manager2: string;
};

function clampScore(value: string, maxMarks: number): string {
  if (value === "") return "";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "";
  if (parsed < 0) return "0";
  if (parsed > maxMarks) return String(maxMarks);
  return value;
}

type TableRow = FormTableRow;

function buildTableRows(
  data: DirectAssessmentData,
): TableRow[] {
  return buildFormTableRows(data.sections, data.rootQuestions);
}

function buildInitialDrafts(
  data: DirectAssessmentData,
): Record<number, Record<number, ScoreDraft>> {
  const result: Record<number, Record<number, ScoreDraft>> = {};

  for (const emp of data.employees) {
    if (emp.submissionId === 0) continue;

    const myAnswers = data.managerAnswersBySubmission[emp.submissionId] ?? [];
    const mgr1Answers =
      data.manager1AnswersBySubmission[emp.submissionId] ?? [];

    const myMap = new Map(myAnswers.map((a) => [a.questionId, a]));
    const mgr1Map = new Map(mgr1Answers.map((a) => [a.questionId, a]));

    const drafts: Record<number, ScoreDraft> = {};

    for (const question of data.questions) {
      if (!isScoredQuestion(question)) continue;

      const my = myMap.get(question.id);
      const mgr1 = mgr1Map.get(question.id);

      // For Manager 2, fall back to Manager 1's answers
      const fallback =
        (emp.managerLevel ?? 1) === 2 ? mgr1 : null;
      const source = my ?? fallback;
      const ratingValue = my?.ratingValue ?? fallback?.ratingValue ?? null;
      const remarks = my?.remarks ?? fallback?.remarks ?? "";
      const computedPoints = source
        ? resolveDisplayedAnswerPoints(
            question,
            data.ratingBased,
            data.ratingScales,
            source,
          )
        : 0;

      drafts[question.id] = {
        pointsEarned: source ? String(computedPoints) : "",
        ratingValue: ratingValue == null ? "" : String(ratingValue),
        remarks: remarks ?? "",
      };
    }

    result[emp.submissionId] = drafts;
  }

  return result;
}

function buildInitialRemarksDrafts(
  data: DirectAssessmentData,
): Record<number, RemarksDraft> {
  const result: Record<number, RemarksDraft> = {};
  for (const emp of data.employees) {
    if (emp.submissionId === 0) continue;
    const remarks = data.overallRemarksBySubmission[emp.submissionId];
    result[emp.submissionId] = {
      manager1: remarks?.manager1 ?? "",
      manager2: remarks?.manager2 ?? "",
    };
  }
  return result;
}

/**
 * Returns the overall remarks value to persist for the given submission,
 * based on the assessment stage (Manager 1 vs Manager 2). The manager-review
 * API writes to manager1_overall_remarks or manager2_overall_remarks based on
 * the submission's manager_level, so we pass the matching draft field. This
 * keeps Direct Assessment on the same data path as the standard workflow.
 */
function overallRemarksForSubmission(
  data: DirectAssessmentData,
  remarksDrafts: Record<number, RemarksDraft>,
  submissionId: number,
): string | null {
  const emp = data.employees.find((e) => e.submissionId === submissionId);
  const draft = remarksDrafts[submissionId];
  if (!emp || !draft) return null;
  const value =
    (emp.managerLevel ?? 1) === 2 ? draft.manager2 : draft.manager1;
  return value.trim() || null;
}

function collectIncompleteRequiredQuestionIds(
  questions: DirectAssessmentData["questions"],
  empDrafts: Record<number, ScoreDraft> | undefined,
  ratingBased: boolean,
  ratingScales: DirectAssessmentData["ratingScales"],
): number[] {
  return questions
    .filter(
      (question) =>
        isScoredQuestion(question) &&
        question.isRequired &&
        !hasProvidedAnswerScore(
          question,
          ratingBased,
          ratingScales,
          parseDraftScoreAnswer(empDrafts?.[question.id]),
        ),
    )
    .map((question) => question.id);
}

function scoreDraftHasInput(draft: ScoreDraft | undefined): boolean {
  if (!draft) return false;
  return (
    draft.ratingValue !== "" ||
    (draft.pointsEarned !== "" && Number.isFinite(Number(draft.pointsEarned))) ||
    Boolean(draft.remarks.trim())
  );
}

function mergeDirectAssessmentDrafts(
  current: Record<number, Record<number, ScoreDraft>>,
  incoming: Record<number, Record<number, ScoreDraft>>,
): Record<number, Record<number, ScoreDraft>> {
  if (Object.keys(current).length === 0) {
    return incoming;
  }
  const next: Record<number, Record<number, ScoreDraft>> = {};
  for (const [submissionKey, questions] of Object.entries(incoming)) {
    const submissionId = Number(submissionKey);
    const currentEmp = current[submissionId] ?? {};
    const merged: Record<number, ScoreDraft> = { ...questions };
    for (const [questionKey, draft] of Object.entries(currentEmp)) {
      const questionId = Number(questionKey);
      if (scoreDraftHasInput(draft) && !scoreDraftHasInput(merged[questionId])) {
        merged[questionId] = draft;
      }
    }
    next[submissionId] = merged;
  }
  for (const [submissionKey, questions] of Object.entries(current)) {
    const submissionId = Number(submissionKey);
    if (next[submissionId] == null) {
      next[submissionId] = questions;
    }
  }
  return next;
}

export default function DirectAssessmentSpreadsheet({
  templateId,
  onBack,
  scope = "all",
}: DirectAssessmentSpreadsheetProps) {
  const queryClient = useQueryClient();
  const [incompleteCells, setIncompleteCells] = useState<{
    submissionId: number;
    questionIds: Set<number>;
  } | null>(null);
  const [drafts, setDrafts] = useState<
    Record<number, Record<number, ScoreDraft>>
  >({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const [remarksDrafts, setRemarksDrafts] = useState<
    Record<number, RemarksDraft>
  >({});
  const remarksDraftsRef = useRef(remarksDrafts);
  remarksDraftsRef.current = remarksDrafts;
  // Modal state for the compact Additional Remarks flow. Only one modal is
  // open at a time; remarksSubmissionId identifies the active employee.
  const [remarksModalOpen, setRemarksModalOpen] = useState(false);
  const [remarksModalSubmissionId, setRemarksModalSubmissionId] = useState<
    number | null
  >(null);
  // Tracks whether the modal is currently saving (separate from score save).
  const [remarksSaving, setRemarksSaving] = useState(false);

  // Column resize state — keyed by column id ("sr", "kpi", "max", or
  // `emp-${submissionId}` for employee columns).
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  const getColumnWidth = useCallback(
    (columnId: string, defaultWidth: number): number => {
      const w = columnWidths[columnId];
      if (w != null) {
        return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, Math.round(w)));
      }
      return defaultWidth;
    },
    [columnWidths],
  );

  const handleColumnResize = useCallback(
    (columnId: string, width: number) => {
      setColumnWidths((prev) => ({
        ...prev,
        [columnId]: Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, Math.round(width))),
      }));
    },
    [],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["direct-assessment", templateId, scope],
    queryFn: () => fetchDirectAssessmentData(templateId, scope),
  });

  const { data: entities = [] } = useQuery({
    queryKey: ["entities"],
    queryFn: fetchDashboardEntities,
  });

  const filters = useDirectAssessmentFilters(data?.employees ?? [], entities);

  const filteredEmployees = useMemo(
    () =>
      data
        ? filterDirectAssessmentEmployees(
            data.employees,
            filters.filterState,
            entities,
          )
        : [],
    [data, filters.filterState, entities],
  );

  const initializeDrafts = useCallback((d: DirectAssessmentData) => {
    setDrafts((current) => mergeDirectAssessmentDrafts(current, buildInitialDrafts(d)));
    setRemarksDrafts((current) => {
      const incoming = buildInitialRemarksDrafts(d);
      if (Object.keys(current).length === 0) {
        return incoming;
      }
      const next = { ...incoming };
      for (const [key, draft] of Object.entries(current)) {
        const id = Number(key);
        const saved = next[id];
        const hasLocal =
          Boolean(draft.manager1.trim()) || Boolean(draft.manager2.trim());
        const savedEmpty =
          !saved ||
          (!saved.manager1.trim() && !saved.manager2.trim());
        if (hasLocal && savedEmpty) {
          next[id] = draft;
        }
      }
      return next;
    });
  }, []);

  const [prevAssessmentData, setPrevAssessmentData] = useState(data);
  if (data !== prevAssessmentData) {
    setPrevAssessmentData(data);
    if (data) {
      initializeDrafts(data);
    }
  }

  const rows = useMemo(() => (data ? buildTableRows(data) : []), [data]);

  const saveMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      const empDrafts = draftsRef.current[submissionId];
      if (!empDrafts || !data) throw new Error("No drafts to save.");

      const answers = data.questions
        .filter(isScoredQuestion)
        .map((q) => {
          const draft = empDrafts[q.id];
          return draftToSaveAnswer(q, draft);
        });

      const overallRemarks = overallRemarksForSubmission(
        data,
        remarksDraftsRef.current,
        submissionId,
      );

      return saveDirectAssessmentScores(submissionId, answers, overallRemarks);
    },
    onSuccess: (_result, submissionId) => {
      toast.success(`Saved scores for submission ${data?.employees.find((e) => e.submissionId === submissionId)?.employeeName}.`);
      queryClient.invalidateQueries({
        queryKey: ["direct-assessment", templateId],
      });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save scores.");
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      if (!data) {
        throw new Error("Assessment data is not loaded.");
      }
      const empDrafts = draftsRef.current[submissionId];
      if (!empDrafts) {
        throw new Error("Select ratings before approving this assessment.");
      }
      const answers = data.questions
        .filter(isScoredQuestion)
        .map((q) => {
          const draft = empDrafts[q.id];
          return draftToSaveAnswer(q, draft);
        });
      const overallRemarks = overallRemarksForSubmission(
        data,
        remarksDraftsRef.current,
        submissionId,
      );
      await saveDirectAssessmentScores(submissionId, answers, overallRemarks);
      return approveDirectAssessment(submissionId);
    },
    onSuccess: (_result, submissionId) => {
      toast.success(`Approved review for submission ${data?.employees.find((e) => e.submissionId === submissionId)?.employeeName}.`);
      queryClient.invalidateQueries({
        queryKey: ["direct-assessment", templateId],
      });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to approve this assessment.",
      );
    },
  });

  const updateDraft = (
    submissionId: number,
    questionId: number,
    patch: Partial<ScoreDraft>,
  ) => {
    const existing = draftsRef.current[submissionId]?.[questionId] ?? {
      pointsEarned: "",
      ratingValue: "",
      remarks: "",
    };
    const merged = { ...existing, ...patch };
    setDrafts((current) => {
      const next = { ...current };
      const empDrafts = next[submissionId] ?? {};
      next[submissionId] = {
        ...empDrafts,
        [questionId]: merged,
      };
      return next;
    });
    setIncompleteCells((current) => {
      if (!current || current.submissionId !== submissionId) {
        return current;
      }
      if (!current.questionIds.has(questionId)) {
        return current;
      }
      const assessment = data;
      const question = assessment?.questions.find((item) => item.id === questionId);
      if (
        !assessment ||
        !question ||
        !hasProvidedAnswerScore(
          question,
          assessment.ratingBased,
          assessment.ratingScales,
          parseDraftScoreAnswer(merged),
        )
      ) {
        return current;
      }
      const nextIds = new Set(current.questionIds);
      nextIds.delete(questionId);
      return nextIds.size === 0
        ? null
        : { submissionId, questionIds: nextIds };
    });
  };

  const openRemarksModal = (submissionId: number) => {
    setRemarksModalSubmissionId(submissionId);
    setRemarksModalOpen(true);
  };

  const closeRemarksModal = () => {
    setRemarksModalOpen(false);
    setRemarksModalSubmissionId(null);
  };

  const assertRequiredScoresFilled = (
    submissionId: number,
    action: "save" | "approve",
  ): boolean => {
    if (!data) {
      toast.error("Assessment data is not loaded.");
      return false;
    }
    const missing = collectIncompleteRequiredQuestionIds(
      data.questions,
      draftsRef.current[submissionId],
      data.ratingBased,
      data.ratingScales,
    );
    if (missing.length === 0) {
      setIncompleteCells((current) =>
        current?.submissionId === submissionId ? null : current,
      );
      return true;
    }
    setIncompleteCells({
      submissionId,
      questionIds: new Set(missing),
    });
    toast.error(
      incompleteRequiredReviewMessage(missing.length, data.ratingBased, action),
    );
    return false;
  };

  // Persist remarks from the modal via the same saveDirectAssessmentScores
  // API used by the inline flow. Reuses the existing overallRemarksForSubmission
  // helper so the manager-level column routing stays identical.
  const saveRemarksFromModal = async (
    submissionId: number,
    value: DirectAssessmentRemarksModalValue,
  ) => {
    if (!data) return;
    setRemarksSaving(true);
    try {
      const nextDrafts: Record<number, RemarksDraft> = {
        ...remarksDraftsRef.current,
        [submissionId]: {
          manager1: value.manager1,
          manager2: value.manager2,
        },
      };
      const empDrafts = draftsRef.current[submissionId] ?? {};
      const answers = data.questions
        .filter(isScoredQuestion)
        .map((q) => {
          const draft = empDrafts[q.id];
          return draftToSaveAnswer(q, draft);
        });
      const overallRemarks = overallRemarksForSubmission(
        data,
        nextDrafts,
        submissionId,
      );
      await saveDirectAssessmentScores(submissionId, answers, overallRemarks);
      setRemarksDrafts(nextDrafts);
      toast.success(`Saved remarks for submission ${data?.employees.find((e) => e.submissionId === submissionId)?.employeeName}.`);
      queryClient.invalidateQueries({
        queryKey: ["direct-assessment", templateId],
      });
      closeRemarksModal();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save remarks.",
      );
    } finally {
      setRemarksSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-md border border-slate-300/80 p-6 text-sm text-foreground/70 dark:border-white/15">
        Loading direct assessment data...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Failed to load direct assessment data.
      </div>
    );
  }

  if (data.employees.length === 0) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-foreground/70 hover:text-text-primary"
        >
          <ArrowLeft className="size-3.5" />
          Back to templates
        </button>
        <div className="rounded-md border border-slate-300/80 p-6 text-sm text-foreground/70 dark:border-white/15">
          {scope === "managed"
            ? "You are not assigned as Manager 1 or Manager 2 for any employee on this form."
            : "No employees are assigned to this form for direct assessment."}
        </div>
      </div>
    );
  }

  if (filteredEmployees.length === 0) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-foreground/70 hover:text-text-primary"
        >
          <ArrowLeft className="size-3.5" />
          Back to templates
        </button>
        <h2 className="text-lg font-semibold text-text-primary">
          Direct Assessment — {data.templateTitle}
        </h2>
        <DirectAssessmentFilterBar
          filterState={filters.filterState}
          selectedDesignations={filters.selectedDesignations}
          selectedRoleCategories={filters.selectedRoleCategories}
          selectedAssessmentStatuses={filters.selectedAssessmentStatuses}
          selectedCategory0EntityIds={filters.selectedCategory0EntityIds}
          selectedCategory1EntityIds={filters.selectedCategory1EntityIds}
          selectedCategory2EntityIds={filters.selectedCategory2EntityIds}
          designationOptions={filters.designationOptions}
          roleCategoryOptions={filters.roleCategoryOptions}
          assessmentStatusOptions={filters.assessmentStatusOptions}
          category0Options={filters.category0Options}
          category1Options={filters.category1Options}
          category2Options={filters.category2Options}
          onDesignationChange={filters.handleDesignationChange}
          onRoleCategoryChange={filters.handleRoleCategoryChange}
          onAssessmentStatusChange={filters.handleAssessmentStatusChange}
          onCategory0EntityChange={filters.handleCategory0EntityChange}
          onCategory1EntityChange={filters.handleCategory1EntityChange}
          onCategory2EntityChange={filters.handleCategory2EntityChange}
          onClearAllFilters={filters.clearAllFilters}
          onRemoveDesignation={() => filters.handleDesignationChange(null)}
          onRemoveRoleCategory={() => filters.handleRoleCategoryChange(null)}
          onRemoveAssessmentStatus={() => filters.handleAssessmentStatusChange(null)}
          onRemoveCategory0={() => filters.handleCategory0EntityChange(null)}
          onRemoveCategory1={() => filters.handleCategory1EntityChange(null)}
          onRemoveCategory2={() => filters.handleCategory2EntityChange(null)}
          onSearchQueryChange={filters.handleSearchQueryChange}
          onRemoveSearch={() => filters.handleSearchQueryChange("")}
          hasActiveFilters={filters.hasActiveFilters}
        />
        <div className="rounded-md border border-slate-300/80 p-6 text-sm text-foreground/70 dark:border-white/15">
          No employees match the selected filters.
        </div>
      </div>
    );
  }

  const scoredQuestions = data.questions.filter(isScoredQuestion);
  const maxRawScore = scoredQuestions.reduce(
    (sum, q) => sum + q.totalMarks,
    0,
  );
  const staffColumnWidth = data.ratingBased
    ? RATING_EMPLOYEE_WIDTH
    : DEFAULT_EMPLOYEE_WIDTH;
  const srWidth = getColumnWidth("sr", DEFAULT_SR_WIDTH);
  const kpiWidth = getColumnWidth("kpi", DEFAULT_KPI_WIDTH);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-foreground/70 hover:text-text-primary"
        >
          <ArrowLeft className="size-3.5" />
          Back to templates
        </button>
        <div className="text-right">
          <h2 className="text-lg font-semibold text-text-primary">
            Direct Assessment — {data.templateTitle}
          </h2>
          {scope === "managed" ? (
            <p className="text-xs text-foreground/60">
              Showing employees you manage as Manager 1 or Manager 2.
            </p>
          ) : null}
        </div>
      </div>
      <FormDescription description={data.templateDescription} />

      <DirectAssessmentFilterBar
        filterState={filters.filterState}
        selectedDesignations={filters.selectedDesignations}
        selectedRoleCategories={filters.selectedRoleCategories}
        selectedAssessmentStatuses={filters.selectedAssessmentStatuses}
        selectedCategory0EntityIds={filters.selectedCategory0EntityIds}
        selectedCategory1EntityIds={filters.selectedCategory1EntityIds}
        selectedCategory2EntityIds={filters.selectedCategory2EntityIds}
        designationOptions={filters.designationOptions}
        roleCategoryOptions={filters.roleCategoryOptions}
        assessmentStatusOptions={filters.assessmentStatusOptions}
        category0Options={filters.category0Options}
        category1Options={filters.category1Options}
        category2Options={filters.category2Options}
        onDesignationChange={filters.handleDesignationChange}
        onRoleCategoryChange={filters.handleRoleCategoryChange}
        onAssessmentStatusChange={filters.handleAssessmentStatusChange}
        onCategory0EntityChange={filters.handleCategory0EntityChange}
        onCategory1EntityChange={filters.handleCategory1EntityChange}
        onCategory2EntityChange={filters.handleCategory2EntityChange}
        onClearAllFilters={filters.clearAllFilters}
        onRemoveDesignation={() => filters.handleDesignationChange(null)}
        onRemoveRoleCategory={() => filters.handleRoleCategoryChange(null)}
        onRemoveAssessmentStatus={() => filters.handleAssessmentStatusChange(null)}
        onRemoveCategory0={() => filters.handleCategory0EntityChange(null)}
        onRemoveCategory1={() => filters.handleCategory1EntityChange(null)}
        onRemoveCategory2={() => filters.handleCategory2EntityChange(null)}
        onSearchQueryChange={filters.handleSearchQueryChange}
        onRemoveSearch={() => filters.handleSearchQueryChange("")}
        hasActiveFilters={filters.hasActiveFilters}
      />

      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-500">
        Showing {filteredEmployees.length} of {data.employees.length} employees
        — drag column borders to resize
      </div>

      <div className="overflow-auto max-h-[75vh] rounded-md border border-slate-300 dark:border-slate-700">
        <table className="border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-40">
            <tr className="bg-slate-800 dark:bg-slate-950">
              <ResizableHeader
                columnId="sr"
                width={srWidth}
                onResize={handleColumnResize}
                frozen
                stickyLeft={0}
                className="top-0 whitespace-nowrap border-r border-slate-700 bg-slate-800 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200 dark:bg-slate-950"
              >
                Sr.
              </ResizableHeader>
              <ResizableHeader
                columnId="kpi"
                width={kpiWidth}
                onResize={handleColumnResize}
                frozen
                stickyLeft={srWidth}
                className={cn(
                  "top-0 border-r border-slate-700 bg-slate-800 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200 dark:bg-slate-950",
                  FROZEN_EDGE_SHADOW,
                )}
              >
                Key Performance Indicators (KPIs)
              </ResizableHeader>
              <ResizableHeader
                columnId="max"
                width={getColumnWidth("max", DEFAULT_MAX_WIDTH)}
                onResize={handleColumnResize}
                className="whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200"
              >
                Weightage
              </ResizableHeader>
              {filteredEmployees.map((emp) => {
                const isEditable = emp.canEdit;
                const statusLabel = isEditable
                  ? `Mgr ${emp.managerLevel ?? 1}`
                  : emp.status === "PENDING_HEAD_REVIEW"
                    ? `Pending Mgr ${emp.managerLevel ?? 1}`
                    : emp.status === "PENDING_HR_CALIBRATION"
                      ? "Approved"
                      : emp.status === "APPROVED" || emp.status === "COMPLETED"
                        ? "Locked"
                        : emp.status.replace(/_/g, " ");
                const empColId = `emp-${emp.submissionId}`;
                return (
                  <ResizableHeader
                    key={emp.submissionId}
                    columnId={empColId}
                    width={getColumnWidth(empColId, staffColumnWidth)}
                    onResize={handleColumnResize}
                    className="border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-100">
                        {emp.employeeName}
                      </span>
                      <span className="text-slate-400">
                        {emp.employeeId}
                      </span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium",
                          isEditable
                            ? "bg-violet-500/20 text-violet-300"
                            : "bg-slate-600/30 text-slate-400",
                        )}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </ResizableHeader>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3 + filteredEmployees.length}
                  className="bg-slate-50 px-3 py-8 text-center text-sm text-slate-500 dark:bg-slate-800/30 dark:text-slate-400"
                >
                  No questions were found for this form template.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIdx) => {
                const { question } = row;
                const scored = question ? isScoredQuestion(question) : false;
                const isEvenRow = rowIdx % 2 === 0;

                // Open-assessment section: render a row showing authored
                // question counts per employee.
                if (row.isOpenAssessment) {
                  const section = data?.sections.find(
                    (s) => s.isOpenAssessment && s.title === row.sectionTitle,
                  );
                  const sectionId = section?.id ?? 0;
                  return (
                    <Fragment key={`open-${row.sr}`}>
                      {row.isFirstInSection && row.sectionTitle ? (
                        <tr className="bg-amber-50/80 dark:bg-amber-950/20">
                          <td
                            colSpan={3 + filteredEmployees.length}
                            className="form-section-header-cell text-sm font-bold text-amber-800 dark:text-amber-200"
                          >
                            {formatSectionLabel(row)}
                          </td>
                        </tr>
                      ) : null}
                      <tr
                        className={cn(
                          "align-top [&>td]:border-b [&>td]:border-slate-100 dark:[&>td]:border-slate-700/40",
                          isEvenRow
                            ? "bg-white dark:bg-slate-900/40"
                            : "bg-slate-50/60 dark:bg-slate-800/20",
                        )}
                      >
                        <td className="border-r border-slate-100 px-3 py-2.5 text-center tabular-nums text-slate-500 dark:border-slate-700/40 dark:text-slate-400">
                          {row.sr}
                        </td>
                        <td
                          colSpan={2 + filteredEmployees.length}
                          className="px-3 py-2.5 text-xs italic text-amber-700 dark:text-amber-300"
                        >
                          Open Assessment — each employee/manager authors their own questions
                          {sectionId ? ` (Section ID: ${sectionId})` : ""}
                        </td>
                      </tr>
                    </Fragment>
                  );
                }

                return (
                  <Fragment key={row.isHeaderOnly ? `header-${row.sr}` : question!.id}>
                    {row.isFirstInSection && row.sectionTitle ? (
                      <tr className="bg-amber-50/80 dark:bg-amber-950/20">
                        <td
                          colSpan={3 + filteredEmployees.length}
                          className="form-section-header-cell text-sm font-bold text-amber-800 dark:text-amber-200"
                        >
                          {formatSectionLabel(row)}
                        </td>
                      </tr>
                    ) : null}
                    {row.isFirstInSubsection && row.subsectionTitle ? (
                      <tr className="bg-teal-50/60 dark:bg-teal-950/20">
                        <td
                          colSpan={3 + filteredEmployees.length}
                          className="form-section-header-cell pl-8 text-xs font-bold text-teal-700 dark:text-teal-300"
                        >
                          {formatSubsectionLabel(row)}
                        </td>
                      </tr>
                    ) : null}
                    {row.isHeaderOnly ? (
                      <tr className="bg-teal-50/40 dark:bg-teal-950/10">
                        <td colSpan={3 + filteredEmployees.length} className="px-3 py-2 pl-10 text-xs italic text-amber-400 dark:text-amber-400/70">
                          No questions in this subsection
                        </td>
                      </tr>
                    ) : (
                    <tr
                      className={cn(
                        "align-top [&>td]:border-b [&>td]:border-slate-100 dark:[&>td]:border-slate-700/40",
                        isEvenRow
                          ? "bg-white dark:bg-slate-900/40"
                          : "bg-slate-50/60 dark:bg-slate-800/20",
                      )}
                    >
                      <td
                        className={cn(
                          "sticky left-0 z-20 border-r border-slate-100 px-3 py-2.5 text-center tabular-nums text-slate-500 dark:border-slate-700/40",
                          isEvenRow
                            ? "bg-white dark:bg-slate-900"
                            : "bg-slate-50 dark:bg-slate-800",
                        )}
                        style={{
                          width: srWidth,
                          minWidth: srWidth,
                          maxWidth: srWidth,
                        }}
                      >
                        {row.sr}
                      </td>
                      <td
                        className={cn(
                          "sticky z-20 border-r border-slate-200 px-3 py-2.5 dark:border-slate-700",
                          FROZEN_EDGE_SHADOW,
                          isEvenRow
                            ? "bg-white dark:bg-slate-900"
                            : "bg-slate-50 dark:bg-slate-800",
                        )}
                        style={{
                          left: srWidth,
                          width: kpiWidth,
                          minWidth: kpiWidth,
                          maxWidth: kpiWidth,
                        }}
                      >
                        <p className="break-words whitespace-pre-wrap text-xs leading-snug text-slate-800 dark:text-slate-200">
                          {question!.questionText}
                          <QuestionRequiredIndicator isRequired={question!.isRequired} />
                        </p>
                      </td>
                      <td
                        className="overflow-hidden whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right tabular-nums font-semibold text-slate-700 dark:border-slate-700/40 dark:text-slate-300"
                        style={{ width: getColumnWidth("max", DEFAULT_MAX_WIDTH), minWidth: getColumnWidth("max", DEFAULT_MAX_WIDTH), maxWidth: getColumnWidth("max", DEFAULT_MAX_WIDTH) }}
                      >
                        {scored ? question!.totalMarks : "—"}
                      </td>
                      {filteredEmployees.map((emp) => {
                        const isEditable = emp.canEdit;
                        const empDrafts = drafts[emp.submissionId];
                        const draft = empDrafts?.[question!.id];
                        const empColId = `emp-${emp.submissionId}`;
                        const empWidth = getColumnWidth(empColId, staffColumnWidth);
                        const cellInvalid =
                          incompleteCells?.submissionId === emp.submissionId &&
                          incompleteCells.questionIds.has(question!.id);

                        return (
                          <td
                            key={emp.submissionId}
                            className={cn(
                              "min-w-0 overflow-hidden border-r border-slate-100 px-2 py-2.5 text-right dark:border-slate-700/40",
                              !isEditable &&
                                "bg-slate-50/50 dark:bg-slate-800/20",
                              cellInvalid && "bg-red-50 dark:bg-red-950/30",
                            )}
                            style={{ width: empWidth, minWidth: empWidth, maxWidth: empWidth }}
                          >
                          {scored ? (
                            isEditable ? (
                              usesRatingScore(
                                question!,
                                data.ratingBased,
                                data.ratingScales,
                              ) ? (
                                <RatingScoreField
                                  scale={
                                    getQuestionRatingScale(
                                      question!,
                                      data.ratingScales,
                                    )!
                                  }
                                  weight={question!.totalMarks}
                                  ratingValue={draft?.ratingValue ?? ""}
                                  invalid={cellInvalid}
                                  onRatingChange={(ratingValue, pointsEarned) =>
                                    updateDraft(emp.submissionId, question!.id, {
                                      ratingValue,
                                      pointsEarned,
                                    })
                                  }
                                />
                              ) : (
                              <input
                                type="number"
                                min={0}
                                max={question!.totalMarks}
                                step="0.5"
                                value={draft?.pointsEarned ?? ""}
                                onChange={(e) =>
                                  updateDraft(emp.submissionId, question!.id, {
                                    pointsEarned: clampScore(
                                      e.target.value,
                                      question!.totalMarks,
                                    ),
                                  })
                                }
                                aria-invalid={cellInvalid || undefined}
                                className={cn(
                                  "h-8 w-20 rounded border border-slate-300 bg-white px-2 text-right text-xs font-bold tabular-nums text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-white/15 dark:bg-slate-800 dark:text-violet-300",
                                  cellInvalid &&
                                    "border-red-500 ring-2 ring-red-400/80 focus-visible:ring-red-500 dark:border-red-400",
                                )}
                              />
                              )
                            ) : (
                              <AnswerScoreReadout
                                question={question!}
                                ratingBased={data.ratingBased}
                                ratingScales={data.ratingScales ?? []}
                                answer={parseDraftScoreAnswer(draft)}
                                tone="slate"
                              />
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      );
                    })}
                    </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot className="sticky bottom-0 z-30 shadow-[0_-6px_12px_rgba(15,23,42,0.12)]">
              <tr className="bg-slate-800 dark:bg-slate-950">
                <td
                  colSpan={2}
                  className={cn(
                    "sticky left-0 z-30 bg-slate-800 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-200 dark:bg-slate-950",
                    FROZEN_EDGE_SHADOW,
                  )}
                  style={{
                    minWidth: srWidth + kpiWidth,
                    width: srWidth + kpiWidth,
                  }}
                >
                  Total
                </td>
                <td
                  className="whitespace-nowrap border-r border-slate-700 px-3 py-2.5 text-right text-sm font-bold tabular-nums text-slate-100"
                  style={{ width: getColumnWidth("max", DEFAULT_MAX_WIDTH), minWidth: getColumnWidth("max", DEFAULT_MAX_WIDTH), maxWidth: getColumnWidth("max", DEFAULT_MAX_WIDTH) }}
                >
                  {maxRawScore}
                </td>
                {filteredEmployees.map((emp) => {
                  const isEditable = emp.canEdit;
                  const empDrafts = drafts[emp.submissionId];
                  const total = scoredQuestions.reduce((sum, q) => {
                    return (
                      sum +
                      resolveDisplayedAnswerPoints(
                        q,
                        data.ratingBased,
                        data.ratingScales,
                        parseDraftScoreAnswer(empDrafts?.[q.id]),
                      )
                    );
                  }, 0);
                  const empColId = `emp-${emp.submissionId}`;
                  const empWidth = getColumnWidth(empColId, staffColumnWidth);

                  return (
                    <td
                      key={emp.submissionId}
                      className="border-r border-slate-700 px-3 py-2.5 text-right text-sm font-bold tabular-nums"
                      style={{ width: empWidth, minWidth: empWidth, maxWidth: empWidth }}
                    >
                      <span
                        className={
                          isEditable ? "text-violet-300" : "text-slate-400"
                        }
                      >
                        {formatScoreValue(total)}
                      </span>
                    </td>
                  );
                })}
              </tr>
              <tr className="border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                <td
                  colSpan={2}
                  className={cn(
                    "sticky left-0 z-30 bg-slate-50 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-900 dark:text-slate-300",
                    FROZEN_EDGE_SHADOW,
                  )}
                  style={{
                    minWidth: srWidth + kpiWidth,
                    width: srWidth + kpiWidth,
                  }}
                >
                  Review actions
                </td>
                <td
                  className="border-r border-slate-200 dark:border-slate-700"
                  style={{ width: getColumnWidth("max", DEFAULT_MAX_WIDTH), minWidth: getColumnWidth("max", DEFAULT_MAX_WIDTH), maxWidth: getColumnWidth("max", DEFAULT_MAX_WIDTH) }}
                />
                {filteredEmployees.map((emp) => {
                  const empColId = `emp-${emp.submissionId}`;
                  const empWidth = getColumnWidth(empColId, staffColumnWidth);
                  const empRemarks = remarksDrafts[emp.submissionId] ?? {
                    manager1: "",
                    manager2: "",
                  };
                  const hasRemarks =
                    empRemarks.manager1.trim().length > 0 ||
                    empRemarks.manager2.trim().length > 0;
                  const remarksEnabled = data.additionalRemarksEnabled ?? false;
                  const isSavingThis =
                    saveMutation.isPending &&
                    saveMutation.variables === emp.submissionId;
                  const isApprovingThis =
                    approveMutation.isPending &&
                    approveMutation.variables === emp.submissionId;
                  const actionsBusy =
                    saveMutation.isPending ||
                    approveMutation.isPending ||
                    remarksSaving;

                  return (
                    <td
                      key={emp.submissionId}
                      className="border-r border-slate-200 px-1.5 py-2 align-top dark:border-slate-700"
                      style={{ width: empWidth, minWidth: empWidth, maxWidth: empWidth }}
                    >
                      {emp.canEdit ? (
                        <div className="flex flex-col gap-1">
                          {remarksEnabled ? (
                            <button
                              type="button"
                              onClick={() => openRemarksModal(emp.submissionId)}
                              disabled={actionsBusy}
                              className={cn(
                                "inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-1 text-[11px] font-semibold disabled:opacity-60",
                                hasRemarks
                                  ? "border-violet-400 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/60"
                                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-white/10",
                              )}
                              title={
                                hasRemarks
                                  ? `Edit remarks for ${emp.employeeName}`
                                  : `Add remarks for ${emp.employeeName}`
                              }
                              aria-label={
                                hasRemarks
                                  ? `Edit remarks for ${emp.employeeName}`
                                  : `Add remarks for ${emp.employeeName}`
                              }
                            >
                              <MessageSquareText className="size-3 shrink-0" />
                              Remarks
                              {hasRemarks ? (
                                <span
                                  className="inline-flex h-1.5 w-1.5 rounded-full bg-violet-500 dark:bg-violet-400"
                                  aria-hidden="true"
                                />
                              ) : null}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                !assertRequiredScoresFilled(
                                  emp.submissionId,
                                  "save",
                                )
                              ) {
                                return;
                              }
                              saveMutation.mutate(emp.submissionId);
                            }}
                            disabled={actionsBusy}
                            className="inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border border-violet-300 bg-white px-1.5 py-1 text-[11px] font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-60 dark:border-violet-700 dark:bg-slate-800 dark:text-violet-200 dark:hover:bg-violet-950/40"
                            aria-label={`Save scores for ${emp.employeeName}`}
                          >
                            <Save className="size-3 shrink-0" />
                            {isSavingThis ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                !assertRequiredScoresFilled(
                                  emp.submissionId,
                                  "approve",
                                )
                              ) {
                                return;
                              }
                              approveMutation.mutate(emp.submissionId);
                            }}
                            disabled={actionsBusy}
                            className="inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md bg-primary px-1.5 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
                            aria-label={`Approve review for ${emp.employeeName}`}
                          >
                            <CheckCircle className="size-3 shrink-0" />
                            {isApprovingThis ? "Approving..." : "Approve"}
                          </button>
                        </div>
                      ) : (
                        <span className="block text-center text-xs text-slate-400 dark:text-slate-500">
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <DirectAssessmentRemarksModal
        open={remarksModalOpen}
        employeeName={
          remarksModalSubmissionId != null
            ? (data.employees.find(
                (e) => e.submissionId === remarksModalSubmissionId,
              )?.employeeName ?? "")
            : ""
        }
        employeeId={
          remarksModalSubmissionId != null
            ? (data.employees.find(
                (e) => e.submissionId === remarksModalSubmissionId,
              )?.employeeId ?? "")
            : ""
        }
        managerLevel={
          remarksModalSubmissionId != null
            ? (data.employees.find(
                (e) => e.submissionId === remarksModalSubmissionId,
              )?.managerLevel ?? null)
            : null
        }
        manager2UserId={
          remarksModalSubmissionId != null
            ? (data.employees.find(
                (e) => e.submissionId === remarksModalSubmissionId,
              )?.manager2UserId ?? null)
            : null
        }
        canEdit={
          remarksModalSubmissionId != null
            ? Boolean(
                data.employees.find(
                  (e) => e.submissionId === remarksModalSubmissionId,
                )?.canEdit,
              )
            : false
        }
        additionalRemarksEnabled={data.additionalRemarksEnabled ?? false}
        initialRemarks={
          remarksModalSubmissionId != null
            ? (remarksDrafts[remarksModalSubmissionId] ?? {
                manager1: "",
                manager2: "",
              })
            : { manager1: "", manager2: "" }
        }
        isPending={remarksSaving}
        onClose={closeRemarksModal}
        onSave={(value) => {
          if (remarksModalSubmissionId != null) {
            saveRemarksFromModal(remarksModalSubmissionId, value);
          }
        }}
      />
    </div>
  );
}
