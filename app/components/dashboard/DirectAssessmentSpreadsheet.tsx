"use client";

import { Fragment, useState, useMemo, useCallback } from "react";
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
import { QuestionRequiredIndicator } from "@/app/components/forms/QuestionRequiredIndicator";
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
const MIN_COL_WIDTH = 60;
const MAX_COL_WIDTH = 500;

type ScoreDraft = {
  pointsEarned: string;
  remarks: string;
};

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
      const points = my?.pointsEarned ?? fallback?.pointsEarned ?? 0;
      const remarks = my?.remarks ?? fallback?.remarks ?? "";

      drafts[question.id] = {
        pointsEarned: String(points),
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

export default function DirectAssessmentSpreadsheet({
  templateId,
  onBack,
  scope = "all",
}: DirectAssessmentSpreadsheetProps) {
  const queryClient = useQueryClient();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<number, Record<number, ScoreDraft>>
  >({});
  const [remarksDrafts, setRemarksDrafts] = useState<
    Record<number, RemarksDraft>
  >({});
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
    setDrafts(buildInitialDrafts(d));
    setRemarksDrafts(buildInitialRemarksDrafts(d));
  }, []);

  const [prevAssessmentData, setPrevAssessmentData] = useState(data);
  if (data !== prevAssessmentData) {
    setPrevAssessmentData(data);
    if (data) {
      initializeDrafts(data);
    }
  }

  const editableEmployees = useMemo(
    () => filteredEmployees.filter((e) => e.canEdit),
    [filteredEmployees],
  );

  const rows = useMemo(() => (data ? buildTableRows(data) : []), [data]);

  const saveMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      const empDrafts = drafts[submissionId];
      if (!empDrafts || !data) throw new Error("No drafts to save.");

      const answers = data.questions
        .filter(isScoredQuestion)
        .map((q) => {
          const draft = empDrafts[q.id];
          return {
            questionId: q.id,
            pointsEarned:
              draft?.pointsEarned === "" ? 0 : Number(draft?.pointsEarned ?? 0),
            remarks: draft?.remarks?.trim() || null,
          };
        });

      const overallRemarks = overallRemarksForSubmission(
        data,
        remarksDrafts,
        submissionId,
      );

      return saveDirectAssessmentScores(submissionId, answers, overallRemarks);
    },
    onSuccess: (_result, submissionId) => {
      setSaveMessage(`Saved scores for submission #${submissionId}.`);
      queryClient.invalidateQueries({
        queryKey: ["direct-assessment", templateId],
      });
    },
    onError: (err: Error) => {
      setSaveMessage(err.message);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      const empDrafts = drafts[submissionId];
      if (empDrafts && data) {
        const answers = data.questions
          .filter(isScoredQuestion)
          .map((q) => {
            const draft = empDrafts[q.id];
            return {
              questionId: q.id,
              pointsEarned:
                draft?.pointsEarned === ""
                  ? 0
                  : Number(draft?.pointsEarned ?? 0),
              remarks: draft?.remarks?.trim() || null,
            };
          });
        const overallRemarks = overallRemarksForSubmission(
          data,
          remarksDrafts,
          submissionId,
        );
        await saveDirectAssessmentScores(submissionId, answers, overallRemarks);
      }
      return approveDirectAssessment(submissionId);
    },
    onSuccess: (_result, submissionId) => {
      setSaveMessage(`Approved review for submission #${submissionId}.`);
      queryClient.invalidateQueries({
        queryKey: ["direct-assessment", templateId],
      });
    },
    onError: (err: Error) => {
      setSaveMessage(err.message);
    },
  });

  const updateDraft = (
    submissionId: number,
    questionId: number,
    patch: Partial<ScoreDraft>,
  ) => {
    setDrafts((current) => {
      const next = { ...current };
      const empDrafts = next[submissionId] ?? {};
      const existing = empDrafts[questionId] ?? {
        pointsEarned: "",
        remarks: "",
      };
      next[submissionId] = {
        ...empDrafts,
        [questionId]: { ...existing, ...patch },
      };
      return next;
    });
    setSaveMessage(null);
  };

  const openRemarksModal = (submissionId: number) => {
    setRemarksModalSubmissionId(submissionId);
    setRemarksModalOpen(true);
  };

  const closeRemarksModal = () => {
    setRemarksModalOpen(false);
    setRemarksModalSubmissionId(null);
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
        ...remarksDrafts,
        [submissionId]: {
          manager1: value.manager1,
          manager2: value.manager2,
        },
      };
      const empDrafts = drafts[submissionId] ?? {};
      const answers = data.questions
        .filter(isScoredQuestion)
        .map((q) => {
          const draft = empDrafts[q.id];
          return {
            questionId: q.id,
            pointsEarned:
              draft?.pointsEarned === "" ? 0 : Number(draft?.pointsEarned ?? 0),
            remarks: draft?.remarks?.trim() || null,
          };
        });
      const overallRemarks = overallRemarksForSubmission(
        data,
        nextDrafts,
        submissionId,
      );
      await saveDirectAssessmentScores(submissionId, answers, overallRemarks);
      setRemarksDrafts(nextDrafts);
      setSaveMessage(`Saved remarks for submission #${submissionId}.`);
      queryClient.invalidateQueries({
        queryKey: ["direct-assessment", templateId],
      });
      closeRemarksModal();
    } catch (err) {
      setSaveMessage(
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

      {saveMessage ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
          {saveMessage}
        </div>
      ) : null}

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
        hasActiveFilters={filters.hasActiveFilters}
      />

      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-500">
        Showing {filteredEmployees.length} of {data.employees.length} employees
        — drag column borders to resize
      </div>

      <div className="overflow-auto max-h-[75vh] rounded-md border border-slate-300 dark:border-slate-700">
        <table className="border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-800 dark:bg-slate-950/80">
              <ResizableHeader
                columnId="sr"
                width={getColumnWidth("sr", DEFAULT_SR_WIDTH)}
                onResize={handleColumnResize}
                className="whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200"
              >
                Sr.
              </ResizableHeader>
              <ResizableHeader
                columnId="kpi"
                width={getColumnWidth("kpi", DEFAULT_KPI_WIDTH)}
                onResize={handleColumnResize}
                className="border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200"
              >
                Key Performance Indicators (KPIs)
              </ResizableHeader>
              <ResizableHeader
                columnId="max"
                width={getColumnWidth("max", DEFAULT_MAX_WIDTH)}
                onResize={handleColumnResize}
                className="whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200"
              >
                Max
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
                    width={getColumnWidth(empColId, DEFAULT_EMPLOYEE_WIDTH)}
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
                        "align-top border-b border-slate-100 dark:border-slate-700/40",
                        isEvenRow
                          ? "bg-white dark:bg-slate-900/40"
                          : "bg-slate-50/60 dark:bg-slate-800/20",
                      )}
                    >
                      <td
                        className="border-r border-slate-100 px-3 py-2.5 text-center tabular-nums text-slate-500 dark:border-slate-700/40"
                        style={{ width: getColumnWidth("sr", DEFAULT_SR_WIDTH), minWidth: getColumnWidth("sr", DEFAULT_SR_WIDTH), maxWidth: getColumnWidth("sr", DEFAULT_SR_WIDTH) }}
                      >
                        {row.sr}
                      </td>
                      <td
                        className="border-r border-slate-100 px-3 py-2.5 dark:border-slate-700/40"
                        style={{ width: getColumnWidth("kpi", DEFAULT_KPI_WIDTH), minWidth: getColumnWidth("kpi", DEFAULT_KPI_WIDTH), maxWidth: getColumnWidth("kpi", DEFAULT_KPI_WIDTH) }}
                      >
                        <p className="break-words whitespace-pre-wrap text-xs leading-snug text-slate-800 dark:text-slate-200">
                          {question!.questionText}
                          <QuestionRequiredIndicator isRequired={question!.isRequired} />
                        </p>
                      </td>
                      <td
                        className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right tabular-nums font-semibold text-slate-700 dark:border-slate-700/40 dark:text-slate-300"
                        style={{ width: getColumnWidth("max", DEFAULT_MAX_WIDTH), minWidth: getColumnWidth("max", DEFAULT_MAX_WIDTH), maxWidth: getColumnWidth("max", DEFAULT_MAX_WIDTH) }}
                      >
                        {scored ? question!.totalMarks : "—"}
                      </td>
                      {filteredEmployees.map((emp) => {
                        const isEditable = emp.canEdit;
                        const empDrafts = drafts[emp.submissionId];
                        const draft = empDrafts?.[question!.id];
                        const empColId = `emp-${emp.submissionId}`;
                        const empWidth = getColumnWidth(empColId, DEFAULT_EMPLOYEE_WIDTH);

                        return (
                          <td
                            key={emp.submissionId}
                            className={cn(
                              "border-r border-slate-100 px-2 py-2.5 text-right dark:border-slate-700/40",
                              !isEditable &&
                                "bg-slate-50/50 dark:bg-slate-800/20",
                            )}
                            style={{ width: empWidth, minWidth: empWidth, maxWidth: empWidth }}
                          >
                          {scored ? (
                            isEditable ? (
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
                                className="h-8 w-20 rounded border border-slate-300 bg-white px-2 text-right text-xs font-bold tabular-nums text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-white/15 dark:bg-slate-800 dark:text-violet-300"
                              />
                            ) : (
                              <span className="font-bold tabular-nums text-slate-600 dark:text-slate-400">
                                {draft?.pointsEarned ?? 0}
                              </span>
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
            <tfoot>
              <tr className="bg-slate-800 dark:bg-slate-950/80">
                <td
                  colSpan={2}
                  className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-200"
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
                    const val = Number(empDrafts?.[q.id]?.pointsEarned ?? 0);
                    return sum + (Number.isNaN(val) ? 0 : val);
                  }, 0);
                  const empColId = `emp-${emp.submissionId}`;
                  const empWidth = getColumnWidth(empColId, DEFAULT_EMPLOYEE_WIDTH);

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
                        {total}
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {editableEmployees.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">
            Review Actions
          </h3>
          <div className="flex flex-wrap gap-2">
            {editableEmployees.map((emp) => {
              const empRemarks = remarksDrafts[emp.submissionId] ?? {
                manager1: "",
                manager2: "",
              };
              const hasRemarks =
                empRemarks.manager1.trim().length > 0 ||
                empRemarks.manager2.trim().length > 0;
              const remarksEnabled =
                (data.additionalRemarksEnabled ?? false) && rows.length > 0;
              return (
                <div
                  key={emp.submissionId}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                >
                  <span className="text-xs font-medium text-text-primary">
                    {emp.employeeName}
                  </span>
                  {remarksEnabled ? (
                    <button
                      type="button"
                      onClick={() => openRemarksModal(emp.submissionId)}
                      disabled={
                        saveMutation.isPending ||
                        approveMutation.isPending ||
                        remarksSaving
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold disabled:opacity-60",
                        hasRemarks
                          ? "border-violet-400 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/60"
                          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/10",
                      )}
                      title={
                        hasRemarks
                          ? "Additional remarks already added — click to view/edit"
                          : "Add additional remarks"
                      }
                    >
                      <MessageSquareText className="size-3" />
                      Remarks
                      {hasRemarks ? (
                        <span
                          className="ml-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-violet-500 dark:bg-violet-400"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => saveMutation.mutate(emp.submissionId)}
                    disabled={
                      saveMutation.isPending || approveMutation.isPending
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-violet-300 bg-white px-2 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-60 dark:border-violet-700 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-950/40"
                  >
                    <Save className="size-3" />
                    {saveMutation.isPending ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => approveMutation.mutate(emp.submissionId)}
                    disabled={
                      saveMutation.isPending || approveMutation.isPending
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    <CheckCircle className="size-3" />
                    {approveMutation.isPending ? "Approving..." : "Approve"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

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
