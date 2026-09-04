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
  getAuthoredRatingScale,
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
import { ArrowLeft, Save, CheckCircle, MessageSquareText, Plus, Trash2, X } from "lucide-react";
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

// ---------------------------------------------------------------------------
// Authored question drafts (open-assessment sections)
// ---------------------------------------------------------------------------

interface AuthoredQuestionDraft {
  clientId: string;
  authoredQuestionText: string;
  authoredTotalMarks: string;
  pointsEarned: string;
  ratingValue: string;
  remarks: string;
}

/** submissionId → sectionId → drafts */
type AuthoredDraftState = Record<number, Record<number, AuthoredQuestionDraft[]>>;

let authoredClientIdCounter = 0;
function nextAuthoredClientId(): string {
  authoredClientIdCounter += 1;
  return `da-authored-${Date.now()}-${authoredClientIdCounter}`;
}

function buildInitialAuthoredDrafts(
  data: DirectAssessmentData,
): AuthoredDraftState {
  const state: AuthoredDraftState = {};
  const openSections = data.sections.filter((s) => s.isOpenAssessment);

  for (const emp of data.employees) {
    if (emp.submissionId === 0) continue;
    const authoredAnswers =
      data.managerAuthoredAnswersBySubmission[emp.submissionId] ?? [];
    const sectionMap: Record<number, AuthoredQuestionDraft[]> = {};

    for (const section of openSections) {
      const sectionAnswers = authoredAnswers.filter(
        (a) => a.openSectionId === section.id,
      );
      sectionMap[section.id] = sectionAnswers.map((a) => ({
        clientId: nextAuthoredClientId(),
        authoredQuestionText: a.authoredQuestionText ?? "",
        authoredTotalMarks: String(a.authoredTotalMarks ?? 0),
        pointsEarned: String(a.pointsEarned ?? 0),
        ratingValue: a.ratingValue == null ? "" : String(a.ratingValue),
        remarks: a.remarks ?? "",
      }));
    }

    state[emp.submissionId] = sectionMap;
  }

  return state;
}

function authoredDraftsToSaveAnswers(
  authored: AuthoredDraftState,
  submissionId: number,
): Array<{
  questionId: number;
  pointsEarned?: number;
  ratingValue?: number | null;
  remarks?: string | null;
  authoredQuestionText?: string | null;
  authoredTotalMarks?: number;
  openSectionId?: number | null;
}> {
  const submissionDrafts = authored[submissionId];
  if (!submissionDrafts) return [];
  const result: Array<{
    questionId: number;
    pointsEarned?: number;
    ratingValue?: number | null;
    remarks?: string | null;
    authoredQuestionText?: string | null;
    authoredTotalMarks?: number;
    openSectionId?: number | null;
  }> = [];

  for (const [sectionIdStr, drafts] of Object.entries(submissionDrafts)) {
    const openSectionId = Number(sectionIdStr);
    for (const draft of drafts) {
      const text = draft.authoredQuestionText.trim();
      const totalMarks = Number(draft.authoredTotalMarks) || 0;
      const points = draft.pointsEarned !== "" ? Number(draft.pointsEarned) : 0;
      const rating = draft.ratingValue !== "" ? Number(draft.ratingValue) : undefined;
      if (!text && !totalMarks && !points && !draft.remarks.trim()) continue;
      result.push({
        questionId: 0,
        openSectionId,
        authoredQuestionText: text || null,
        authoredTotalMarks: totalMarks,
        pointsEarned: points || undefined,
        ratingValue: rating ?? null,
        remarks: draft.remarks.trim() || null,
      });
    }
  }

  return result;
}

function mergeAuthoredDrafts(
  current: AuthoredDraftState,
  incoming: AuthoredDraftState,
): AuthoredDraftState {
  if (Object.keys(current).length === 0) return incoming;
  const next: AuthoredDraftState = { ...incoming };
  for (const [subKey, sections] of Object.entries(current)) {
    const submissionId = Number(subKey);
    const incomingSections = next[submissionId] ?? {};
    const merged: Record<number, AuthoredQuestionDraft[]> = {};
    // Prefer incoming (from server), but keep current drafts that have
    // input where the server has nothing.
    for (const [secKey, drafts] of Object.entries(incomingSections)) {
      merged[Number(secKey)] = drafts;
    }
    for (const [secKey, drafts] of Object.entries(sections)) {
      const sectionId = Number(secKey);
      const incomingDrafts = merged[sectionId] ?? [];
      // If the server returned drafts, use them. Otherwise keep local edits.
      if (incomingDrafts.length > 0) continue;
      const hasLocalInput = drafts.some(
        (d) =>
          d.authoredQuestionText.trim() ||
          d.authoredTotalMarks.trim() ||
          d.pointsEarned.trim() ||
          d.ratingValue.trim() ||
          d.remarks.trim(),
      );
      if (hasLocalInput) {
        merged[sectionId] = drafts;
      }
    }
    next[submissionId] = merged;
  }
  return next;
}

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
  // Authored question drafts for open-assessment sections.
  const [authoredDrafts, setAuthoredDrafts] = useState<AuthoredDraftState>({});
  const authoredDraftsRef = useRef(authoredDrafts);
  authoredDraftsRef.current = authoredDrafts;
  // Modal state for the compact Additional Remarks flow. Only one modal is
  // open at a time; remarksSubmissionId identifies the active employee.
  const [remarksModalOpen, setRemarksModalOpen] = useState(false);
  const [remarksModalSubmissionId, setRemarksModalSubmissionId] = useState<
    number | null
  >(null);
  // Tracks whether the modal is currently saving (separate from score save).
  const [remarksSaving, setRemarksSaving] = useState(false);
  // Authored questions modal state: identifies which employee + section
  // is currently being edited.
  const [authoredModalState, setAuthoredModalState] = useState<{
    submissionId: number;
    sectionId: number;
  } | null>(null);

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
    setAuthoredDrafts((current) =>
      mergeAuthoredDrafts(current, buildInitialAuthoredDrafts(d)),
    );
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

      // Append authored answers for open-assessment sections.
      const authoredAnswers = authoredDraftsToSaveAnswers(
        authoredDraftsRef.current,
        submissionId,
      );
      const allAnswers = [...answers, ...authoredAnswers];

      const overallRemarks = overallRemarksForSubmission(
        data,
        remarksDraftsRef.current,
        submissionId,
      );

      return saveDirectAssessmentScores(submissionId, allAnswers, overallRemarks);
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
      const authoredAnswers = authoredDraftsToSaveAnswers(
        authoredDraftsRef.current,
        submissionId,
      );
      const allAnswers = [...answers, ...authoredAnswers];
      const overallRemarks = overallRemarksForSubmission(
        data,
        remarksDraftsRef.current,
        submissionId,
      );
      await saveDirectAssessmentScores(submissionId, allAnswers, overallRemarks);
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

  // ---- Authored question helpers (open-assessment sections) ----

  const addAuthoredQuestion = (submissionId: number, sectionId: number) => {
    const section = data?.sections.find((s) => s.id === sectionId);
    const budget = section?.openAssessmentTotalMarks ?? 0;
    const existing = authoredDraftsRef.current[submissionId]?.[sectionId] ?? [];
    const allocated = existing.reduce(
      (sum, d) => sum + (Number(d.authoredTotalMarks) || 0),
      0,
    );
    const remaining = budget - allocated;
    if (remaining <= 0) {
      toast.error(
        `Section budget of ${budget} marks is fully allocated. Reduce the marks of existing questions to add more.`,
      );
      return;
    }
    setAuthoredDrafts((current) => {
      const empSections = current[submissionId] ?? {};
      const existingDrafts = empSections[sectionId] ?? [];
      return {
        ...current,
        [submissionId]: {
          ...empSections,
          [sectionId]: [
            ...existingDrafts,
            {
              clientId: nextAuthoredClientId(),
              authoredQuestionText: "",
              authoredTotalMarks: "",
              pointsEarned: "",
              ratingValue: "",
              remarks: "",
            },
          ],
        },
      };
    });
  };

  const updateAuthoredDraft = (
    submissionId: number,
    sectionId: number,
    clientId: string,
    field: keyof AuthoredQuestionDraft,
    value: string,
  ) => {
    setAuthoredDrafts((current) => {
      const empSections = current[submissionId] ?? {};
      const existing = empSections[sectionId] ?? [];
      return {
        ...current,
        [submissionId]: {
          ...empSections,
          [sectionId]: existing.map((d) =>
            d.clientId === clientId ? { ...d, [field]: value } : d,
          ),
        },
      };
    });
  };

  const removeAuthoredDraft = (
    submissionId: number,
    sectionId: number,
    clientId: string,
  ) => {
    setAuthoredDrafts((current) => {
      const empSections = current[submissionId] ?? {};
      const existing = empSections[sectionId] ?? [];
      return {
        ...current,
        [submissionId]: {
          ...empSections,
          [sectionId]: existing.filter((d) => d.clientId !== clientId),
        },
      };
    });
  };

  const openAuthoredModal = (submissionId: number, sectionId: number) => {
    setAuthoredModalState({ submissionId, sectionId });
  };

  const closeAuthoredModal = () => {
    setAuthoredModalState(null);
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
      const authoredAnswers = authoredDraftsToSaveAnswers(
        authoredDraftsRef.current,
        submissionId,
      );
      const allAnswers = [...answers, ...authoredAnswers];
      const overallRemarks = overallRemarksForSubmission(
        data,
        nextDrafts,
        submissionId,
      );
      await saveDirectAssessmentScores(submissionId, allAnswers, overallRemarks);
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

                // Open-assessment section: render per-employee cells with
                // an "Add Question" / "Edit Questions" button that opens a
                // modal with the full authored-question editor.
                if (row.isOpenAssessment) {
                  const section = data?.sections.find(
                    (s) => s.isOpenAssessment && s.title === row.sectionTitle,
                  );
                  const sectionId = section?.id ?? 0;
                  const budget = row.openAssessmentTotalMarks ?? section?.openAssessmentTotalMarks ?? 0;
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
                          className="overflow-hidden whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-xs text-amber-700 dark:border-slate-700/40 dark:text-amber-300"
                          style={{ width: getColumnWidth("kpi", DEFAULT_KPI_WIDTH), minWidth: getColumnWidth("kpi", DEFAULT_KPI_WIDTH), maxWidth: getColumnWidth("kpi", DEFAULT_KPI_WIDTH) }}
                        >
                          <span className="italic">Open Assessment</span>
                          <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                            Manager authors questions
                          </p>
                        </td>
                        <td
                          className="border-r border-slate-100 px-3 py-2.5 text-right tabular-nums font-semibold text-slate-700 dark:border-slate-700/40 dark:text-slate-300"
                          style={{ width: getColumnWidth("max", DEFAULT_MAX_WIDTH), minWidth: getColumnWidth("max", DEFAULT_MAX_WIDTH), maxWidth: getColumnWidth("max", DEFAULT_MAX_WIDTH) }}
                        >
                          {budget || "—"}
                        </td>
                        {filteredEmployees.map((emp) => {
                          const isEditable = emp.canEdit;
                          const empAuthored =
                            authoredDrafts[emp.submissionId]?.[sectionId] ?? [];
                          const authoredCount = empAuthored.length;
                          const empColId = `emp-${emp.submissionId}`;
                          const empWidth = getColumnWidth(empColId, staffColumnWidth);
                          return (
                            <td
                              key={emp.submissionId}
                              className={cn(
                                "border-r border-slate-100 px-2 py-2.5 text-center dark:border-slate-700/40",
                                !isEditable && "bg-slate-50/50 dark:bg-slate-800/20",
                              )}
                              style={{ width: empWidth, minWidth: empWidth, maxWidth: empWidth }}
                            >
                              {isEditable ? (
                                <div className="flex flex-col items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openAuthoredModal(emp.submissionId, sectionId)
                                    }
                                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-white hover:bg-primary/90"
                                  >
                                    <Plus className="size-3" />
                                    {authoredCount > 0
                                      ? `Edit (${authoredCount})`
                                      : "Add Question"}
                                  </button>
                                  {authoredCount > 0 && (
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                      {authoredCount} question{authoredCount !== 1 ? "s" : ""}
                                    </span>
                                  )}
                                </div>
                              ) : authoredCount > 0 ? (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                  {authoredCount} question{authoredCount !== 1 ? "s" : ""}
                                </span>
                              ) : (
                                <span className="text-[10px] italic text-slate-300 dark:text-slate-600">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
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
                        const isRatingQuestion = usesRatingScore(
                          question!,
                          data.ratingBased,
                          data.ratingScales,
                        );
                        const hasRatingSelected =
                          isRatingQuestion &&
                          ratingValueFromDraft(draft) != null;

                        return (
                          <td
                            key={emp.submissionId}
                            className={cn(
                              "min-w-0 overflow-hidden border-r border-slate-100 px-2 py-2.5 text-right dark:border-slate-700/40",
                              cellInvalid
                                ? "bg-red-500 dark:bg-red-950/30"
                                : hasRatingSelected
                                  ? "bg-emerald-500 dark:bg-emerald-950/35"
                                  : !isEditable
                                    ? "bg-slate-50/50 dark:bg-slate-800/20"
                                    : undefined,
                            )}
                            style={{ width: empWidth, minWidth: empWidth, maxWidth: empWidth }}
                          >
                          {scored ? (
                            isEditable ? (
                              isRatingQuestion ? (
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
                                  className={
                                    hasRatingSelected && !cellInvalid
                                      ? "[&_select]:bg-emerald-50 dark:[&_select]:bg-emerald-950/40"
                                      : undefined
                                  }
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

      {/* Authored questions modal for open-assessment sections */}
      {authoredModalState && data ? (() => {
        const { submissionId, sectionId } = authoredModalState;
        const emp = data.employees.find((e) => e.submissionId === submissionId);
        const section = data.sections.find((s) => s.id === sectionId);
        const budget = section?.openAssessmentTotalMarks ?? 0;
        const drafts = authoredDrafts[submissionId]?.[sectionId] ?? [];
        const allocated = drafts.reduce(
          (sum, d) => sum + (Number(d.authoredTotalMarks) || 0),
          0,
        );
        const remaining = budget - allocated;
        const authoredRatingBased = data.ratingBased;
        const authoredScale = getAuthoredRatingScale(data.ratingScales);
        const empName = emp?.employeeName ?? "";
        const sectionTitle = section?.title ?? "Open Assessment";

        return (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 dark:bg-black/60"
            onClick={closeAuthoredModal}
          >
            <div
              className="mt-8 w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-white/15 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Open Assessment — {sectionTitle}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Employee: {empName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeAuthoredModal}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Budget: <span className="font-bold text-amber-700 dark:text-amber-300">{budget}</span>
                  {" — "}
                  Allocated: <span className={cn("font-bold", remaining < 0 ? "text-red-600" : remaining === 0 ? "text-emerald-600" : "text-amber-700 dark:text-amber-300")}>{allocated}</span>
                  {" / "}
                  Remaining: <span className={cn("font-bold", remaining < 0 ? "text-red-600" : "text-emerald-600")}>{remaining}</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addAuthoredQuestion(submissionId, sectionId)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-white",
                      remaining <= 0
                        ? "bg-slate-400 cursor-not-allowed hover:bg-slate-400"
                        : "bg-primary hover:bg-primary/90",
                    )}
                  >
                    <Plus className="size-3" />
                    Add Question
                  </button>
                  {remaining <= 0 && drafts.length > 0 ? (
                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                      Budget fully allocated — reduce marks on existing questions to add more
                    </span>
                  ) : null}
                </div>
              </div>

              {drafts.length === 0 ? (
                <div className="rounded-md border border-dashed border-amber-300/80 px-4 py-6 text-center text-xs text-slate-500 dark:border-amber-700/40 dark:text-slate-400">
                  {authoredRatingBased
                    ? 'Click "Add Question" to write a question, assign a weight from the budget, and select a rating.'
                    : 'Click "Add Question" to write a question and assign marks from the budget.'}
                </div>
              ) : (
                <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                  {drafts.map((draft, draftIdx) => {
                    const totalMarks = Number(draft.authoredTotalMarks) || 0;
                    const updateAuthoredRating = (
                      ratingValue: string,
                      pointsEarned: string,
                    ) => {
                      updateAuthoredDraft(submissionId, sectionId, draft.clientId, "ratingValue", ratingValue);
                      updateAuthoredDraft(submissionId, sectionId, draft.clientId, "pointsEarned", pointsEarned);
                    };
                    return (
                      <div
                        key={draft.clientId}
                        className="rounded-md border border-slate-200 bg-slate-50/40 p-3 dark:border-white/10 dark:bg-slate-800/20"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-1.5 text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400">
                            {draftIdx + 1}.
                          </span>
                          <div className="min-w-0 flex-1 space-y-2">
                            <textarea
                              value={draft.authoredQuestionText}
                              onChange={(e) =>
                                updateAuthoredDraft(submissionId, sectionId, draft.clientId, "authoredQuestionText", e.target.value)
                              }
                              rows={2}
                              className="w-full resize-y rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15 dark:bg-slate-800 dark:text-slate-200"
                              placeholder="Type the question here..."
                            />
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                {authoredRatingBased ? "Weight:" : "Marks:"}
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={draft.authoredTotalMarks}
                                  onChange={(e) =>
                                    updateAuthoredDraft(submissionId, sectionId, draft.clientId, "authoredTotalMarks", e.target.value)
                                  }
                                  className="ml-1 h-7 w-20 rounded border border-slate-300 bg-white px-2 text-right text-xs tabular-nums font-bold text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15 dark:bg-slate-800 dark:text-amber-300"
                                  placeholder="0"
                                />
                              </label>
                              {authoredRatingBased && authoredScale ? (
                                <div className="flex min-w-[180px] flex-col gap-0.5">
                                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Rating:</span>
                                  <RatingScoreField
                                    scale={authoredScale}
                                    weight={totalMarks}
                                    ratingValue={draft.ratingValue}
                                    onRatingChange={updateAuthoredRating}
                                    fallbackPoints={draft.pointsEarned !== "" ? Number(draft.pointsEarned) : null}
                                  />
                                </div>
                              ) : (
                                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                  Score:
                                  <input
                                    type="number"
                                    min={0}
                                    max={totalMarks || undefined}
                                    step={0.5}
                                    value={draft.pointsEarned}
                                    onChange={(e) =>
                                      updateAuthoredDraft(submissionId, sectionId, draft.clientId, "pointsEarned", e.target.value)
                                    }
                                    className="ml-1 h-7 w-20 rounded border border-slate-300 bg-white px-2 text-right text-xs tabular-nums font-bold text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 dark:border-white/15 dark:bg-slate-800 dark:text-teal-300"
                                    placeholder="0"
                                  />
                                </label>
                              )}
                              <button
                                type="button"
                                onClick={() => removeAuthoredDraft(submissionId, sectionId, draft.clientId)}
                                className="ml-auto inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/30"
                              >
                                <Trash2 className="size-3" />
                                Remove
                              </button>
                            </div>
                            <textarea
                              value={draft.remarks}
                              onChange={(e) =>
                                updateAuthoredDraft(submissionId, sectionId, draft.clientId, "remarks", e.target.value)
                              }
                              rows={2}
                              className="w-full resize-y rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15 dark:bg-slate-800 dark:text-slate-300"
                              placeholder="Remarks (optional)..."
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAuthoredModal}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}
