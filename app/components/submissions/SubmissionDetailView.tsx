"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchFormSubmission,
  approveManagerReview,
  saveManagerReview,
  approveHrCalibration,
  saveHrReview,
} from "@/lib/queries/form-submissions-client";
import { invalidateStaffListingQueries } from "@/app/helpers/dashboard-listing-cache";
import { isScoredQuestion } from "@/app/helpers/form-questions";
import {
  APPRAISAL_STATUS_LABELS,
  type AppraisalStatus,
  type QuestionRecord,
} from "@/types/forms";
import type { EmployeeFormAnswerRecord } from "@/types/employee-forms";
import { cn } from "@/lib/utils";
import {
  buildFormTableRows,
  formatSectionLabel,
  formatSubsectionLabel,
} from "@/app/helpers/form-table-rows";
import AssessmentSummaryFooter from "@/app/components/forms/AssessmentSummaryFooter";
import IneligibilityBanner from "@/app/components/forms/EligibilityStatusBanner";
import { useSession } from "next-auth/react";
import { canReviewSubmissions, canViewQuartile } from "@/lib/auth/submission-review-roles";
import { useAdditionalAccess } from "@/app/queries/use-additional-access";
import PrintButton from "@/app/components/forms/PrintButton";
import PrintDocumentHeader from "@/app/components/print/PrintDocumentHeader";
import PrintFooter from "@/app/components/print/PrintFooter";
import { InlineScoreAdjustmentCell } from "@/app/components/dashboard/InlineScoreAdjustmentCell";
import QuartileBadge from "@/app/components/dashboard/QuartileBadge";
import AttachmentList from "@/app/components/attachments/AttachmentList";
import { getSubmissionAttachmentDownloadUrl } from "@/app/helpers/attachments";

interface SubmissionDetailViewProps {
  submissionId: number;
}

type ManagerDraft = {
  pointsEarned: string;
  remarks: string;
};

function clampScore(value: string, maxMarks: number): string {
  if (value === "") return "";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "";
  if (parsed < 0) return "0";
  if (parsed > maxMarks) return String(maxMarks);
  return value;
}

function buildManagerDraftMap(
  questions: QuestionRecord[],
  managerAnswers: EmployeeFormAnswerRecord[],
  employeeAnswers: EmployeeFormAnswerRecord[],
  manager1Answers?: EmployeeFormAnswerRecord[],
  managerLevel?: number,
): Map<number, ManagerDraft> {
  const employeeMap = new Map(
    employeeAnswers.map((answer) => [answer.questionId, answer]),
  );
  const managerMap = new Map(
    managerAnswers.map((answer) => [answer.questionId, answer]),
  );
  const manager1Map = new Map(
    (manager1Answers ?? []).map((answer) => [answer.questionId, answer]),
  );
  const drafts = new Map<number, ManagerDraft>();

  for (const question of questions) {
    if (!isScoredQuestion(question)) continue;

    const manager = managerMap.get(question.id);
    const employee = employeeMap.get(question.id);
    const manager1 = manager1Map.get(question.id);

    // For Manager 2 review, fall back to Manager 1's answers, then self-assessment
    const fallbackSource =
      managerLevel === 2 ? (manager1 ?? employee) : employee;
    const points =
      manager?.pointsEarned ?? fallbackSource?.pointsEarned ?? undefined;
    const remarks = manager?.remarks ?? fallbackSource?.remarks ?? "";

    drafts.set(question.id, {
      pointsEarned: points === undefined ? "" : String(points),
      remarks: remarks ?? "",
    });
  }

  return drafts;
}

function getRatingFromPercent(pct: number | null): string {
  if (pct === null) return "—";
  if (pct >= 85) return "OS";
  if (pct >= 70) return "EX";
  if (pct >= 55) return "ST";
  if (pct >= 40) return "IN";
  return "UN";
}

interface ScoreAdjustmentsPanelProps {
  submissionId: number;
  scoreO: number;
  maxRawScore: number;
  creditHrsErpScoreAdj: number | null;
  pubOricScoreAdj: number | null;
  qecScoreAdj: number | null;
  calibrationFactor: number | null;
  canEdit: boolean;
  canEditCreditHours?: boolean;
  canEditOric?: boolean;
  canEditQec?: boolean;
  performanceLevelName: string | null;
  quartileName: string | null;
}

function ScoreAdjustmentsPanel({
  submissionId,
  scoreO,
  maxRawScore,
  creditHrsErpScoreAdj,
  pubOricScoreAdj,
  qecScoreAdj,
  calibrationFactor,
  canEdit,
  canEditCreditHours = true,
  canEditOric = true,
  canEditQec = true,
  performanceLevelName,
  quartileName,
}: ScoreAdjustmentsPanelProps) {
  const chAdj = creditHrsErpScoreAdj ?? 0;
  const oricAdj = pubOricScoreAdj ?? 0;
  const qecAdj = qecScoreAdj ?? 0;
  const calFr = calibrationFactor ?? 1;

  const adjustedScore = scoreO + chAdj + oricAdj + qecAdj;
  const adjustedScorePct =
    maxRawScore > 0
      ? Number(((adjustedScore / maxRawScore) * 100).toFixed(2))
      : null;
  const ratingO = getRatingFromPercent(adjustedScorePct);

  const normalizedScore = adjustedScore * calFr;
  const normalizedScorePct =
    maxRawScore > 0
      ? Number(((normalizedScore / maxRawScore) * 100).toFixed(2))
      : null;

  const disabled = !canEdit;

  return (
    <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-700">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
        Score Adjustments &amp; Calibration
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-9">
        <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/30">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            CH Adj
          </p>
          <div className="mt-1">
            <InlineScoreAdjustmentCell
              submissionId={submissionId}
              field="creditHrsErpScoreAdj"
              value={creditHrsErpScoreAdj}
              disabled={disabled}
              canEdit={canEditCreditHours}
            />
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/30">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            ORIC Adj
          </p>
          <div className="mt-1">
            <InlineScoreAdjustmentCell
              submissionId={submissionId}
              field="pubOricScoreAdj"
              value={pubOricScoreAdj}
              disabled={disabled}
              canEdit={canEditOric}
            />
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/30">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            QEC Adj
          </p>
          <div className="mt-1">
            <InlineScoreAdjustmentCell
              submissionId={submissionId}
              field="qecScoreAdj"
              value={qecScoreAdj}
              disabled={disabled}
              canEdit={canEditQec}
            />
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/30">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Adj. Score (100)
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {adjustedScorePct ?? "—"}
          </p>
        </div>

        

        <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/30">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Cal. Fr
          </p>
          <div className="mt-1">
            <InlineScoreAdjustmentCell
              submissionId={submissionId}
              field="calibrationFactor"
              value={calibrationFactor}
              disabled={disabled}
              mode="decimal"
            />
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/30">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Norm. Score (100)
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {normalizedScorePct ?? "—"}
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/30">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Quartile
          </p>
          <div className="mt-1">
            <QuartileBadge
              performanceLevelName={performanceLevelName}
              quartileName={quartileName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SubmissionDetailView({
  submissionId,
}: SubmissionDetailViewProps) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const isAdminRole = canReviewSubmissions(userRole);
  const showQuartile = canViewQuartile(userRole);
  const { canEdit: canEditModule, canView: canViewModule } = useAdditionalAccess(
    session?.user?.id ? Number(session.user.id) : undefined,
    userRole,
  );
  const canEditCreditHours = isAdminRole || canEditModule("CREDIT_HOURS");
  const canEditOric = isAdminRole || canEditModule("ORIC_ADJUSTMENTS");
  const canEditQec = isAdminRole || canEditModule("QEC_ADJUSTMENTS");
  const hasAnyModuleAccess =
    canEditCreditHours ||
    canEditOric ||
    canEditQec ||
    (!isAdminRole && (canViewModule("CREDIT_HOURS") || canViewModule("ORIC_ADJUSTMENTS") || canViewModule("QEC_ADJUSTMENTS")));
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [managerDrafts, setManagerDrafts] = useState<Map<number, ManagerDraft>>(
    new Map(),
  );
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [initialDraftsSnapshot, setInitialDraftsSnapshot] = useState<
    Map<number, ManagerDraft>
  >(new Map());

  const { data, isLoading, error } = useQuery({
    queryKey: ["form-submission", submissionId],
    queryFn: () => fetchFormSubmission(submissionId),
  });

  useEffect(() => {
    if (!data) return;

    const drafts = buildManagerDraftMap(
      data.questions,
      data.managerAnswers,
      data.answers,
      data.manager1Answers,
      data.managerLevel ?? undefined,
    );
    setManagerDrafts(drafts);
    setInitialDraftsSnapshot(
      new Map(
        [...drafts.entries()].map(([k, v]) => [
          k,
          { pointsEarned: v.pointsEarned, remarks: v.remarks },
        ]),
      ),
    );
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) {
        throw new Error("Submission not loaded.");
      }

      const answers = data.questions
        .filter(isScoredQuestion)
        .map((question) => {
          const draft = managerDrafts.get(question.id);
          return {
            questionId: question.id,
            pointsEarned:
              draft?.pointsEarned === "" ? 0 : Number(draft?.pointsEarned ?? 0),
            remarks: draft?.remarks?.trim() || null,
          };
        });

      return saveManagerReview(submissionId, answers);
    },
    onSuccess: (result) => {
      setSaveMessage("Manager review saved.");
      queryClient.setQueryData(["form-submission", submissionId], (current) => {
        if (!current || typeof current !== "object") return current;
        return {
          ...current,
          managerAnswers: result.managerAnswers,
        };
      });
    },
    onError: (mutationError: Error) => {
      setSaveMessage(mutationError.message);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (data?.canEditManagerReview) {
        const answers = data.questions
          .filter(isScoredQuestion)
          .map((question) => {
            const draft = managerDrafts.get(question.id);
            return {
              questionId: question.id,
              pointsEarned:
                draft?.pointsEarned === "" ? 0 : Number(draft?.pointsEarned ?? 0),
              remarks: draft?.remarks?.trim() || null,
            };
          });
        await saveManagerReview(submissionId, answers);
      }

      return approveManagerReview(submissionId);
    },
    onSuccess: (result) => {
      setSaveMessage("Manager review approved.");
      queryClient.setQueryData(["form-submission", submissionId], (current) => {
        if (!current || typeof current !== "object") return current;
        return {
          ...current,
          status: result.status,
          managerLevel: result.managerLevel,
          canEditManagerReview: false,
        };
      });
      invalidateStaffListingQueries(queryClient);
    },
    onError: (mutationError: Error) => {
      setSaveMessage(mutationError.message);
    },
  });

  const hrSaveMutation = useMutation({
    mutationFn: () => {
      if (!data) {
        throw new Error("Submission not loaded.");
      }

      const answers = data.questions
        .filter(isScoredQuestion)
        .map((question) => {
          const draft = managerDrafts.get(question.id);
          return {
            questionId: question.id,
            pointsEarned:
              draft?.pointsEarned === "" ? 0 : Number(draft?.pointsEarned ?? 0),
            remarks: draft?.remarks?.trim() || null,
          };
        });

      return saveHrReview(submissionId, answers);
    },
    onSuccess: (result) => {
      setSaveMessage("HR review saved.");
      queryClient.setQueryData(["form-submission", submissionId], (current) => {
        if (!current || typeof current !== "object") return current;
        return {
          ...current,
          managerAnswers: result.managerAnswers,
        };
      });
      setInitialDraftsSnapshot(
        new Map(
          [...managerDrafts.entries()].map(([k, v]) => [
            k,
            { pointsEarned: v.pointsEarned, remarks: v.remarks },
          ]),
        ),
      );
    },
    onError: (mutationError: Error) => {
      setSaveMessage(mutationError.message);
    },
  });

  const hrApproveMutation = useMutation({
    mutationFn: async () => {
      if (data?.canEditHrReview) {
        const answers = data.questions
          .filter(isScoredQuestion)
          .map((question) => {
            const draft = managerDrafts.get(question.id);
            return {
              questionId: question.id,
              pointsEarned:
                draft?.pointsEarned === "" ? 0 : Number(draft?.pointsEarned ?? 0),
              remarks: draft?.remarks?.trim() || null,
            };
          });
        await saveHrReview(submissionId, answers);
      }

      return approveHrCalibration(submissionId);
    },
    onSuccess: (result) => {
      setSaveMessage(
        result.status === "APPROVED"
          ? "Approved successfully."
          : "HR review approved. Sent to Board for final approval.",
      );
      queryClient.setQueryData(["form-submission", submissionId], (current) => {
        if (!current || typeof current !== "object") return current;
        return {
          ...current,
          status: result.status,
          canEditHrReview: false,
        };
      });
      invalidateStaffListingQueries(queryClient);
    },
    onError: (mutationError: Error) => {
      setSaveMessage(mutationError.message);
    },
  });

  const answerMap = useMemo(
    () => new Map(data?.answers.map((answer) => [answer.questionId, answer])),
    [data?.answers],
  );

  const manager1AnswerMap = useMemo(
    () =>
      new Map(
        (data?.manager1Answers ?? []).map((answer) => [
          answer.questionId,
          answer,
        ]),
      ),
    [data?.manager1Answers],
  );

  const manager2AnswerMap = useMemo(
    () =>
      new Map(
        (data?.manager2Answers ?? []).map((answer) => [
          answer.questionId,
          answer,
        ]),
      ),
    [data?.manager2Answers],
  );

  const hasManager2 = data?.manager2UserId != null;
  const currentManagerLevel = data?.managerLevel ?? 1;
  // Manager 2 data is visible to HR/Board/SuperAdmin and Manager 2 themselves.
  // Manager 1 must never see Manager 2 assessment data.
  const showManager2Data =
    isAdminRole ||
    (userRole === "MANAGER" && Number(session?.user?.id) === data?.manager2UserId);
  const selfAssessmentEnabled = data?.selfAssessmentEnabled ?? true;
  const isEligible = data?.assessmentEligibility ?? true;
  const editingManager1 =
    isEligible && data?.canEditManagerReview && currentManagerLevel === 1;
  const editingManager2 =
    isEligible && data?.canEditManagerReview && currentManagerLevel === 2;
  const editingHr = isEligible && (data?.canEditHrReview ?? false);

  const hasUnsavedChanges = useMemo(() => {
    if (!editingHr && !data?.canEditManagerReview) return false;
    for (const [key, draft] of managerDrafts) {
      const initial = initialDraftsSnapshot.get(key);
      if (!initial) return true;
      if (initial.pointsEarned !== draft.pointsEarned) return true;
      if (initial.remarks !== draft.remarks) return true;
    }
    return false;
  }, [editingHr, data?.canEditManagerReview, managerDrafts, initialDraftsSnapshot]);

  const cancelEditing = useCallback(() => {
    setManagerDrafts(
      new Map(
        [...initialDraftsSnapshot.entries()].map(([k, v]) => [
          k,
          { pointsEarned: v.pointsEarned, remarks: v.remarks },
        ]),
      ),
    );
    setSaveMessage(null);
  }, [initialDraftsSnapshot]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
        ) {
          target.blur();
        }
        event.preventDefault();
        cancelEditing();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasUnsavedChanges, cancelEditing]);

  if (isLoading) {
    return (
      <div className="rounded-md border border-slate-300/80 p-6 text-sm text-foreground/70 dark:border-white/15">
        Loading submission...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Failed to load submission.
      </div>
    );
  }

  const rows = buildFormTableRows(data.sections, data.rootQuestions);

  const statusStyles: Record<AppraisalStatus, string> = {
    PENDING_SELF_ASSESSMENT:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    PENDING_HEAD_REVIEW:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    PENDING_HR_CALIBRATION:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    PENDING_BOARD_APPROVAL:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    APPROVED:
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
    COMPLETED:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  };

  const selfTotal = data.answers.reduce((sum, a) => sum + a.pointsEarned, 0);
  const manager1Answers = data.manager1Answers ?? [];
  const manager2Answers = data.manager2Answers ?? [];
  const manager1Total = manager1Answers.reduce(
    (sum, a) => sum + a.pointsEarned,
    0,
  );
  const manager2SavedTotal = manager2Answers.reduce(
    (sum, a) => sum + a.pointsEarned,
    0,
  );
  // Manager 2 total falls back to Manager 1's total, then self total
  const manager2Total = hasManager2
    ? manager2Answers.length > 0
      ? manager2SavedTotal
      : manager1Answers.length > 0
        ? manager1Total
        : selfTotal
    : null;
  const managerDraftTotal = [...managerDrafts.values()].reduce((sum, draft) => {
    const value = Number(draft.pointsEarned);
    return sum + (Number.isNaN(value) ? 0 : value);
  }, 0);

  const updateManagerDraft = (
    questionId: number,
    patch: Partial<ManagerDraft>,
  ) => {
    setManagerDrafts((current) => {
      const next = new Map(current);
      const existing = next.get(questionId) ?? { pointsEarned: "", remarks: "" };
      next.set(questionId, { ...existing, ...patch });
      return next;
    });
    setSaveMessage(null);
  };

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden rounded-md border border-slate-300 bg-white shadow-md shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/30">
      <PrintDocumentHeader
        title="Assessment Submission"
        metaItems={[
          { label: "Employee", value: data.employeeName },
          { label: "SAP ID", value: data.employeeId ?? "—" },
          { label: "Form", value: data.templateTitle },
          { label: "Status", value: APPRAISAL_STATUS_LABELS[data.status] },
          { label: "Score", value: `${data.rawScore}/${data.maxRawScore} (${data.scorePercent}%)` },
        ]}
      />
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {data.employeeName}
          </span>
          {data.employeeId ? (
            <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              SAP {data.employeeId}
            </span>
          ) : null}
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-semibold",
              statusStyles[data.status],
            )}
          >
            {APPRAISAL_STATUS_LABELS[data.status]}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {data.templateTitle}
          </span>
          <div className="ml-auto no-print">
            <PrintButton
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
            />
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-indigo-700 dark:text-indigo-300">
            Score {data.rawScore}/{data.maxRawScore} ({data.scorePercent}%)
          </span>
          {showQuartile && data.performanceLevelName ? (
            <span className="font-medium text-teal-700 dark:text-teal-300">
              {data.performanceLevelName}
              {showQuartile && data.quartileName ? ` · ${data.quartileName}` : ""}
            </span>
          ) : null}
          {data.submittedAt ? (
            <span className="text-slate-500 dark:text-slate-400">
              {new Date(data.submittedAt).toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>

      {!isEligible ? (
        <IneligibilityBanner
          role={isAdminRole ? "admin" : "manager"}
          employeeName={data?.employeeName}
          reason={data?.ineligibilityReason}
        />
      ) : null}

      {data.canEditManagerReview ? (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-violet-50/60 px-4 py-2 text-xs dark:border-slate-700 dark:bg-violet-950/20">
          <p className="text-violet-800 dark:text-violet-200">
            {selfAssessmentEnabled
              ? "Manager scores are pre-filled from self assessment. Edit any value and save your review."
              : "Enter scores directly for this employee. Edit any value and save your review."}
          </p>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges ? (
              <>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saveMutation.isPending || approveMutation.isPending}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || approveMutation.isPending}
                  className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-60 dark:border-violet-700 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-950/40"
                >
                  {saveMutation.isPending ? "Saving..." : "Save"}
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => approveMutation.mutate()}
              disabled={saveMutation.isPending || approveMutation.isPending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {approveMutation.isPending ? "Approving..." : "Approve Review"}
            </button>
          </div>
        </div>
      ) : null}

      {editingHr && hasUnsavedChanges ? (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-orange-50/60 px-4 py-2 text-xs dark:border-slate-700 dark:bg-orange-950/20">
          <p className="text-orange-800 dark:text-orange-200">
            {data.status === "PENDING_HR_CALIBRATION"
              ? "HR Alignment phase. Save or approve to send to Board."
              : data.status === "PENDING_BOARD_APPROVAL"
                ? "Board Approval phase. Save or approve to finalize."
                : "You have unsaved score changes. Save to persist your edits."}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelEditing}
              disabled={hrSaveMutation.isPending || hrApproveMutation.isPending}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setShowSaveConfirm(true)}
              disabled={hrSaveMutation.isPending || hrApproveMutation.isPending}
              className="rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-50 disabled:opacity-60 dark:border-orange-700 dark:bg-slate-900 dark:text-orange-200 dark:hover:bg-orange-950/40"
            >
              {hrSaveMutation.isPending ? "Saving..." : "Save"}
            </button>
            {(data.status === "PENDING_HR_CALIBRATION" ||
            data.status === "PENDING_BOARD_APPROVAL") ? (
              <button
                type="button"
                onClick={() => setShowApproveConfirm(true)}
                disabled={hrSaveMutation.isPending || hrApproveMutation.isPending}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {hrApproveMutation.isPending
                  ? "Approving..."
                  : data.status === "PENDING_HR_CALIBRATION"
                    ? "Approve & Send to Board"
                    : "Approve"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showSaveConfirm ? (
        <div className="no-print fixed inset-0 z-100 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
            onClick={() => setShowSaveConfirm(false)}
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/15 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Confirm Save
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to save the current scores? You can continue editing after saving.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSaveConfirm(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSaveConfirm(false);
                  hrSaveMutation.mutate();
                }}
                disabled={hrSaveMutation.isPending}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {hrSaveMutation.isPending ? "Saving..." : "Confirm Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showApproveConfirm ? (
        <div className="no-print fixed inset-0 z-100 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
            onClick={() => setShowApproveConfirm(false)}
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/15 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Confirm Approval
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {data.status === "PENDING_HR_CALIBRATION"
                ? "Are you sure you want to approve this appraisal? It will be sent to the Board for final approval."
                : "Are you sure you want to approve this appraisal? This will finalize the appraisal."}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowApproveConfirm(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowApproveConfirm(false);
                  hrApproveMutation.mutate();
                }}
                disabled={hrApproveMutation.isPending}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {hrApproveMutation.isPending ? "Approving..." : "Confirm Approve"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {saveMessage ? (
        <div className="no-print border-b border-slate-200 px-4 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
          {saveMessage}
        </div>
      ) : null}

      <div className="no-print flex items-center gap-2 border-b border-slate-200 bg-slate-50/50 px-4 py-2 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-500">
        Scroll horizontally to view all columns
      </div>

      <div className="overflow-auto max-h-[70vh]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-800 dark:bg-slate-950/80">
              <th className="print-col-minimal whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200">
                Sr. No.
              </th>
              <th className="min-w-[260px] print-col-large border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200">
                Key Performance Indicators (KPIs)
              </th>
              <th className="print-col-minimal whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200">
                Weight
              </th>
              {selfAssessmentEnabled ? (
                <>
              <th className="print-col-minimal whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-teal-300">
                Self Score
              </th>
              <th className="min-w-[180px] print-col-medium border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-teal-300">
                Self Remarks
              </th>
                </>
              ) : null}
              <th className="print-col-minimal whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-violet-300">
                Mgr 1 Score
              </th>
              <th className="min-w-[180px] print-col-medium border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-violet-300">
                Mgr 1 Remarks
              </th>
              {hasManager2 && showManager2Data ? (
                <>
                  <th className="print-col-minimal whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                    Mgr 2 Score
                  </th>
                  <th className="min-w-[180px] print-col-medium border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                    Mgr 2 Remarks
                  </th>
                </>
              ) : null}
              <th className="min-w-[180px] print-col-medium px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200">
                Attachments
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={selfAssessmentEnabled ? ((hasManager2 && showManager2Data) ? 10 : 8) : ((hasManager2 && showManager2Data) ? 8 : 6)}
                  className="bg-slate-50 px-3 py-8 text-center text-sm text-slate-500 dark:bg-slate-800/30 dark:text-slate-400"
                >
                  No questions were found for this submission.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIdx) => {
                const { question } = row;
                const answer = answerMap.get(question!.id);
                const scored = isScoredQuestion(question!);
                const questionSelfAssessmentEnabled =
                  selfAssessmentEnabled && question!.selfAssessmentEnabled;
                const managerDraft = managerDrafts.get(question!.id) ?? {
                  pointsEarned: "",
                  remarks: "",
                };
                const mgr1Answer = manager1AnswerMap.get(question!.id);
                const mgr2Answer = manager2AnswerMap.get(question!.id);
                const isEvenRow = rowIdx % 2 === 0;

                return (
                  <Fragment key={row.isHeaderOnly ? `header-${row.sr}` : question!.id}>
                    {row.isFirstInSection && row.sectionTitle ? (
                      <tr className="bg-amber-50/80 dark:bg-amber-950/20">
                        <td colSpan={selfAssessmentEnabled ? ((hasManager2 && showManager2Data) ? 10 : 8) : ((hasManager2 && showManager2Data) ? 8 : 6)} className="form-section-header-cell text-sm font-bold text-amber-800 dark:text-amber-200">
                          {formatSectionLabel(row)}
                        </td>
                      </tr>
                    ) : null}
                    {row.isFirstInSubsection && row.subsectionTitle ? (
                      <tr className="bg-amber-50/50 dark:bg-amber-950/10">
                        <td colSpan={selfAssessmentEnabled ? ((hasManager2 && showManager2Data) ? 10 : 8) : ((hasManager2 && showManager2Data) ? 8 : 6)} className="form-section-header-cell pl-8 text-xs font-bold text-amber-700 dark:text-amber-300">
                          {formatSubsectionLabel(row)}
                        </td>
                      </tr>
                    ) : null}
                    {row.isHeaderOnly ? (
                      <tr className="bg-amber-50/40 dark:bg-amber-950/10">
                        <td colSpan={selfAssessmentEnabled ? ((hasManager2 && showManager2Data) ? 10 : 8) : ((hasManager2 && showManager2Data) ? 8 : 6)} className="px-3 py-2 pl-10 text-xs italic text-amber-400 dark:text-amber-400/70">
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
                    <td className="border-r border-slate-100 px-3 py-2.5 text-center tabular-nums text-slate-500 dark:border-slate-700/40">
                      {row.sr}
                    </td>
                    <td className="border-r border-slate-100 px-3 py-2.5 dark:border-slate-700/40">
                      <p className="max-w-[450px] break-words text-xs leading-snug text-slate-800 dark:text-slate-200">
                        {question!.questionText}
                      </p>
                    </td>
                    <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right tabular-nums font-semibold text-slate-700 dark:border-slate-700/40 dark:text-slate-300">
                      {scored ? question!.totalMarks : "—"}
                    </td>
                    {selfAssessmentEnabled ? (
                      <>
                    <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right tabular-nums font-bold text-teal-700 dark:border-slate-700/40 dark:text-teal-300">
                      {scored ? (
                        questionSelfAssessmentEnabled ? (
                          answer?.pointsEarned ?? 0
                        ) : (
                          <span className="text-slate-400" title="To be filled by Manager">N/A</span>
                        )
                      ) : "—"}
                    </td>
                    <td className="border-r border-slate-100 px-3 py-2.5 text-xs text-slate-600 dark:border-slate-700/40 dark:text-slate-300">
                      {scored ? (
                        questionSelfAssessmentEnabled ? (
                          answer?.remarks?.trim() ? (
                            <p className="whitespace-pre-wrap break-words">
                              {answer.remarks}
                            </p>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )
                        ) : (
                          <span className="text-slate-400" title="To be filled by Manager">N/A</span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                      </>
                    ) : null}
                    {/* Manager 1 Score — read-only for admin roles */}
                    <td className="whitespace-nowrap border-r border-slate-100 px-2 py-2.5 text-right dark:border-slate-700/40">
                      {scored ? (
                        (editingManager1 && !isAdminRole) || (editingHr && !isAdminRole) ? (
                          <input
                            type="number"
                            min={0}
                            max={question!.totalMarks}
                            step="0.5"
                            value={managerDraft.pointsEarned}
                            onChange={(event) =>
                              updateManagerDraft(question!.id, {
                                pointsEarned: clampScore(
                                  event.target.value,
                                  question!.totalMarks,
                                ),
                              })
                            }
                            className="h-8 w-20 rounded border border-slate-300 bg-white px-2 text-right text-xs font-bold tabular-nums text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-white/15 dark:bg-slate-800 dark:text-violet-300"
                          />
                        ) : (
                          <span className="font-bold tabular-nums text-violet-700 dark:text-violet-300">
                            {mgr1Answer?.pointsEarned ?? 0}
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {/* Manager 1 Remarks — read-only for admin roles */}
                    <td className="border-r border-slate-100 px-2 py-2.5 dark:border-slate-700/40">
                      {scored ? (
                        (editingManager1 && !isAdminRole) || (editingHr && !isAdminRole) ? (
                          <textarea
                            value={managerDraft.remarks}
                            rows={2}
                            onChange={(event) =>
                              updateManagerDraft(question!.id, {
                                remarks: event.target.value,
                              })
                            }
                            className="w-full min-w-[160px] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-white/15 dark:bg-slate-800 dark:text-slate-300"
                            placeholder="Optional remarks"
                          />
                        ) : mgr1Answer?.remarks?.trim() ? (
                          <p className="whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300">
                            {mgr1Answer.remarks}
                          </p>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {/* Manager 2 Score + Remarks */}
                    {hasManager2 && showManager2Data ? (
                      <>
                        <td className="whitespace-nowrap border-r border-slate-100 px-2 py-2.5 text-right dark:border-slate-700/40">
                          {scored ? (
                            (editingManager2 && !isAdminRole) || (editingHr && !isAdminRole) ? (
                              <input
                                type="number"
                                min={0}
                                max={question!.totalMarks}
                                step="0.5"
                                value={managerDraft.pointsEarned}
                                onChange={(event) =>
                                  updateManagerDraft(question!.id, {
                                    pointsEarned: clampScore(
                                      event.target.value,
                                      question!.totalMarks,
                                    ),
                                  })
                                }
                                className="h-8 w-20 rounded border border-slate-300 bg-white px-2 text-right text-xs font-bold tabular-nums text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-white/15 dark:bg-slate-800 dark:text-indigo-300"
                              />
                            ) : (
                              <span className="font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                                {mgr2Answer?.pointsEarned
                                  ?? mgr1Answer?.pointsEarned
                                  ?? answer?.pointsEarned
                                  ?? 0}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5">
                          {scored ? (
                            (editingManager2 && !isAdminRole) || (editingHr && !isAdminRole) ? (
                              <textarea
                                value={managerDraft.remarks}
                                rows={2}
                                onChange={(event) =>
                                  updateManagerDraft(question!.id, {
                                    remarks: event.target.value,
                                  })
                                }
                                className="w-full min-w-[160px] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-white/15 dark:bg-slate-800 dark:text-slate-300"
                                placeholder="Optional remarks"
                              />
                            ) : (mgr2Answer?.remarks?.trim() || mgr1Answer?.remarks?.trim() || answer?.remarks?.trim()) ? (
                              <p className="whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300">
                                {mgr2Answer?.remarks?.trim() || mgr1Answer?.remarks?.trim() || answer?.remarks}
                              </p>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </>
                    ) : null}
                    {/* Attachments uploaded by the employee — visible to every authorised reviewer */}
                    <td className="px-2 py-2.5 align-top">
                      <AttachmentList
                        attachments={answer?.attachments ?? []}
                        buildDownloadUrl={(attachmentId) =>
                          getSubmissionAttachmentDownloadUrl(
                            data.id,
                            attachmentId,
                          )
                        }
                        compact
                      />
                    </td>
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
                <td className="whitespace-nowrap border-r border-slate-700 px-3 py-2.5 text-right text-sm font-bold tabular-nums text-slate-100">
                  {data.maxRawScore}
                </td>
                {selfAssessmentEnabled ? (
                  <>
                <td className="whitespace-nowrap border-r border-slate-700 px-3 py-2.5 text-right text-sm font-bold tabular-nums text-teal-300">
                  {selfTotal}
                </td>
                <td className="border-r border-slate-700 px-3 py-2.5" />
                  </>
                ) : null}
                <td className="whitespace-nowrap border-r border-slate-700 px-3 py-2.5 text-right text-sm font-bold tabular-nums text-violet-300">
                  {editingManager1 ? managerDraftTotal : manager1Total}
                </td>
                <td className="border-r border-slate-700 px-3 py-2.5" />
                {hasManager2 && showManager2Data ? (
                  <>
                    <td className="whitespace-nowrap border-r border-slate-700 px-3 py-2.5 text-right text-sm font-bold tabular-nums text-indigo-300">
                      {editingManager2 ? managerDraftTotal : (manager2Total ?? 0)}
                    </td>
                    <td className="border-r border-slate-700 px-3 py-2.5" />
                  </>
                ) : null}
                <td className="px-3 py-2.5" />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
            {rows.length > 0 ? (
        <AssessmentSummaryFooter
          entries={[
            ...(selfAssessmentEnabled
              ? [
                  {
                    label: "Self Assessment",
                    awardedMarks: selfTotal,
                    totalMarks: data.maxRawScore,
                    accentClass:
                      "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
                  },
                ]
              : []),
            {
              label: "Manager 1 Assessment",
              awardedMarks: editingManager1 ? managerDraftTotal : manager1Total,
              totalMarks: data.maxRawScore,
              accentClass:
                "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
            },
            ...(hasManager2 && showManager2Data
              ? [
                  {
                    label: "Manager 2 Assessment",
                    awardedMarks: editingManager2
                      ? managerDraftTotal
                      : (manager2Total ?? 0),
                    totalMarks: data.maxRawScore,
                    accentClass:
                      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
                  },
                ]
              : []),
          ]}
        />
      ) : null}

      {(isAdminRole || hasAnyModuleAccess) && rows.length > 0 ? (
        <ScoreAdjustmentsPanel
          submissionId={data.id}
          scoreO={data.initialScoreNumeric ?? data.rawScore}
          maxRawScore={data.maxRawScore}
          creditHrsErpScoreAdj={data.creditHrsErpScoreAdj}
          pubOricScoreAdj={data.pubOricScoreAdj}
          qecScoreAdj={data.qecScoreAdj}
          calibrationFactor={data.calibrationFactor}
          canEdit={data.canEditScoreAdjustments && isEligible}
          canEditCreditHours={canEditCreditHours}
          canEditOric={canEditOric}
          canEditQec={canEditQec}
          performanceLevelName={data.performanceLevelName}
          quartileName={data.quartileName}
        />
      ) : null}


      <PrintFooter />
    </div>
  );
}
