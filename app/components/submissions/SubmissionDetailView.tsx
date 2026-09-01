"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ElementType,
} from "react";
import {
  fetchFormSubmission,
  approveManagerReview,
  saveManagerReview,
  approveHrCalibration,
  saveHrReview,
  resetFormSubmission,
} from "@/lib/queries/form-submissions-client";
import { invalidateStaffListingQueries } from "@/app/helpers/dashboard-listing-cache";
import { isScoredQuestion } from "@/app/helpers/form-questions";
import {
  getQuestionRatingScale,
  usesRatingScore,
} from "@/app/helpers/form-rating-scoring";
import { RatingScoreField } from "@/app/components/forms/RatingScoreField";
import {
  APPRAISAL_STATUS_LABELS,
  type AppraisalStatus,
  type FormRatingScaleRecord,
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
import { FormDescription } from "@/app/components/forms/FormDescription";
import { QuestionRequiredIndicator } from "@/app/components/forms/QuestionRequiredIndicator";
import OverallRemarksSection, {
  OverallRemarksPrintSection,
} from "@/app/components/forms/OverallRemarksSection";
import IneligibilityBanner from "@/app/components/forms/EligibilityStatusBanner";
import ReturnHistoryBanner from "@/app/components/forms/ReturnHistoryBanner";
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
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Gauge,
  Network,
  RotateCcw,
} from "lucide-react";

interface SubmissionDetailViewProps {
  submissionId: number;
}

type ManagerDraft = {
  pointsEarned: string;
  ratingValue: string;
  remarks: string;
};

function emptyManagerDraft(): ManagerDraft {
  return { pointsEarned: "", ratingValue: "", remarks: "" };
}

function cloneManagerDraft(draft: ManagerDraft): ManagerDraft {
  return {
    pointsEarned: draft.pointsEarned,
    ratingValue: draft.ratingValue,
    remarks: draft.remarks,
  };
}

function ratingValueFromDraft(draft: ManagerDraft | undefined): number | null {
  if (!draft?.ratingValue) {
    return null;
  }
  const parsed = Number(draft.ratingValue);
  return Number.isNaN(parsed) ? null : parsed;
}

function ManagerScoreEditor({
  question,
  ratingBased,
  ratingScales,
  draft,
  onChange,
  inputClassName,
}: {
  question: QuestionRecord;
  ratingBased: boolean;
  ratingScales: FormRatingScaleRecord[];
  draft: ManagerDraft;
  onChange: (patch: Partial<ManagerDraft>) => void;
  inputClassName: string;
}) {
  const scale = getQuestionRatingScale(question, ratingScales);
  if (usesRatingScore(question, ratingBased, ratingScales) && scale) {
    return (
      <RatingScoreField
        scale={scale}
        weight={question.totalMarks}
        ratingValue={draft.ratingValue}
        onRatingChange={(ratingValue, pointsEarned) =>
          onChange({ ratingValue, pointsEarned })
        }
      />
    );
  }

  return (
    <input
      type="number"
      min={0}
      max={question.totalMarks}
      step="0.5"
      value={draft.pointsEarned}
      onChange={(event) =>
        onChange({
          pointsEarned: clampScore(event.target.value, question.totalMarks),
        })
      }
      className={inputClassName}
    />
  );
}

function clampScore(value: string, maxMarks: number): string {
  if (value === "") return "";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "";
  if (parsed < 0) return "0";
  if (parsed > maxMarks) return String(maxMarks);
  return value;
}

function formatNameWithSap(
  name: string | null | undefined,
  sap: string | null | undefined,
): string {
  const trimmedName = name?.trim() || null;
  const trimmedSap = sap?.trim() || null;
  if (trimmedName && trimmedSap) return `${trimmedName} (SAP ${trimmedSap})`;
  if (trimmedName) return trimmedName;
  if (trimmedSap) return `SAP ${trimmedSap}`;
  return "Unassigned";
}

function displayOrgValue(value: string | null | undefined): string {
  if (value == null || value.trim() === "") return "—";
  return value.trim();
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function SubmissionInfoTile({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: ElementType;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border px-3.5 py-3",
        accent
          ? "border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
      )}
    >
      <dt
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide",
          accent
            ? "text-indigo-600 dark:text-indigo-300"
            : "text-slate-500 dark:text-slate-400",
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1.5 wrap-break-word text-sm font-semibold",
          accent
            ? "text-indigo-800 dark:text-indigo-200"
            : "text-slate-900 dark:text-slate-100",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
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

    // Prefill from the previous stage so the manager only changes scores
    // they disagree with: Manager 1 ← self-assessment; Manager 2 ← Manager 1,
    // then self-assessment. HOD-only questions have no employee answer.
    const fallbackSource =
      managerLevel === 2 ? (manager1 ?? employee) : employee;
    const points =
      manager?.pointsEarned ?? fallbackSource?.pointsEarned ?? undefined;
    const ratingValue =
      manager?.ratingValue ?? fallbackSource?.ratingValue ?? undefined;
    const remarks = manager?.remarks ?? fallbackSource?.remarks ?? "";

    drafts.set(question.id, {
      pointsEarned: points === undefined ? "" : String(points),
      ratingValue: ratingValue === undefined ? "" : String(ratingValue),
      remarks: remarks ?? "",
    });
  }

  return drafts;
}

function managerColumnAnswer(
  question: QuestionRecord,
  formSelfAssessmentEnabled: boolean,
  primary: EmployeeFormAnswerRecord | undefined,
  previousManager: EmployeeFormAnswerRecord | undefined,
  employee: EmployeeFormAnswerRecord | undefined,
): EmployeeFormAnswerRecord | undefined {
  if (primary) return primary;
  if (previousManager) return previousManager;
  if (
    formSelfAssessmentEnabled &&
    question.selfAssessmentEnabled &&
    employee
  ) {
    return employee;
  }
  return undefined;
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
  /** Calibration factor is admin-only — non-admin users with additional
      access can edit their specific adjustment columns but NOT the
      calibration factor. Defaults to true for backward compatibility. */
  canEditCalibrationFactor?: boolean;
  performanceLevelName: string | null;
  quartileName: string | null;
  /** Normalized score is only shown after HR Alignment is completed. */
  showNormalizedScore?: boolean;
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
  canEditCalibrationFactor = true,
  performanceLevelName,
  quartileName,
  showNormalizedScore = false,
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

  const normalizedScore = adjustedScore * calFr;
  const normalizedScorePct =
    showNormalizedScore && maxRawScore > 0
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
              canEdit={canEditCalibrationFactor}
              mode="decimal"
            />
          </div>
        </div>

        {showNormalizedScore ? (
          <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/30">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Norm. Score (100)
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {normalizedScorePct ?? "—"}
            </p>
          </div>
        ) : null}

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
  const canViewCreditHours = isAdminRole || canViewModule("CREDIT_HOURS");
  const canViewOric = isAdminRole || canViewModule("ORIC_ADJUSTMENTS");
  const canViewQec = isAdminRole || canViewModule("QEC_ADJUSTMENTS");
  const canEditCreditHours = isAdminRole || canEditModule("CREDIT_HOURS");
  const canEditOric = isAdminRole || canEditModule("ORIC_ADJUSTMENTS");
  const canEditQec = isAdminRole || canEditModule("QEC_ADJUSTMENTS");
  const canViewAnyAdjustment =
    isAdminRole || canViewCreditHours || canViewOric || canViewQec;
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [managerDrafts, setManagerDrafts] = useState<Map<number, ManagerDraft>>(
    new Map(),
  );
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [initialDraftsSnapshot, setInitialDraftsSnapshot] = useState<
    Map<number, ManagerDraft>
  >(new Map());
  const [manager1OverallRemarks, setManager1OverallRemarks] = useState<string>("");
  const [manager2OverallRemarks, setManager2OverallRemarks] = useState<string>("");
  const [initialOverallRemarks, setInitialOverallRemarks] = useState<{
    manager1: string;
    manager2: string;
  }>({ manager1: "", manager2: "" });

  const { data, isLoading, error } = useQuery({
    queryKey: ["form-submission", submissionId],
    queryFn: () => fetchFormSubmission(submissionId),
  });

  const [prevSubmissionData, setPrevSubmissionData] = useState(data);
  if (data !== prevSubmissionData) {
    setPrevSubmissionData(data);
    if (data) {
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
            cloneManagerDraft(v),
          ]),
        ),
      );
      const m1Remarks = data.manager1OverallRemarks ?? "";
      const m2Remarks = data.manager2OverallRemarks ?? "";
      setManager1OverallRemarks(m1Remarks);
      setManager2OverallRemarks(m2Remarks);
      setInitialOverallRemarks({ manager1: m1Remarks, manager2: m2Remarks });
    }
  }

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
            ratingValue: ratingValueFromDraft(draft),
            remarks: draft?.remarks?.trim() || null,
          };
        });

      const overallRemarks =
        currentManagerLevel === 2 ? manager2OverallRemarks : manager1OverallRemarks;

      return saveManagerReview(submissionId, answers, overallRemarks);
    },
    onSuccess: (result) => {
      setSaveMessage("Manager review saved.");
      queryClient.setQueryData(["form-submission", submissionId], (current) => {
        if (!current || typeof current !== "object") return current;
        return {
          ...current,
          managerAnswers: result.managerAnswers,
          ...(result.manager1OverallRemarks !== undefined
            ? { manager1OverallRemarks: result.manager1OverallRemarks }
            : {}),
          ...(result.manager2OverallRemarks !== undefined
            ? { manager2OverallRemarks: result.manager2OverallRemarks }
            : {}),
        };
      });
      if (result.manager1OverallRemarks !== undefined) {
        setManager1OverallRemarks(result.manager1OverallRemarks ?? "");
        setInitialOverallRemarks((prev) => ({
          ...prev,
          manager1: result.manager1OverallRemarks ?? "",
        }));
      }
      if (result.manager2OverallRemarks !== undefined) {
        setManager2OverallRemarks(result.manager2OverallRemarks ?? "");
        setInitialOverallRemarks((prev) => ({
          ...prev,
          manager2: result.manager2OverallRemarks ?? "",
        }));
      }
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
              ratingValue: ratingValueFromDraft(draft),
              remarks: draft?.remarks?.trim() || null,
            };
          });
        const overallRemarks =
          currentManagerLevel === 2 ? manager2OverallRemarks : manager1OverallRemarks;
        await saveManagerReview(submissionId, answers, overallRemarks);
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
            ratingValue: ratingValueFromDraft(draft),
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
            { pointsEarned: v.pointsEarned, ratingValue: v.ratingValue, remarks: v.remarks },
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
              ratingValue: ratingValueFromDraft(draft),
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

  const resetFormMutation = useMutation({
    mutationFn: () => resetFormSubmission(submissionId),
    onSuccess: (result) => {
      setSaveMessage("Assessment form has been reset successfully.");
      // Force a full server refetch instead of manually patching the cache.
      // The FormSubmissionDetail type has 40+ score/adjustment/remark fields
      // — manually setting each one in setQueryData is error-prone and was
      // leaving stale score values (scoreO, manager1Score, manager2Score,
      // ratingO, ratingN, normalizedScore, salary fields, etc.) visible
      // after reset. invalidateQueries ensures the next render fetches the
      // actual post-reset state from the database with every field cleared.
      queryClient.invalidateQueries({
        queryKey: ["form-submission", submissionId],
      });
      // Also invalidate the list-level queries so dashboard counts update.
      invalidateStaffListingQueries(queryClient);

      // Debug: log deletion counts returned by the server for verification.
      console.info(
        `[ResetForm] submission=${submissionId} ` +
          `status=${result.status} ` +
          `deletedAttachments=${result.deletedAttachments} ` +
          `deletedAnswers=${result.deletedAnswers} ` +
          `resetAppraisal=${result.resetAppraisal}`,
      );
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
  const pastHeadReview =
    data?.status === "PENDING_HR_CALIBRATION" ||
    data?.status === "PENDING_BOARD_APPROVAL" ||
    data?.status === "APPROVED" ||
    data?.status === "COMPLETED";
  const manager1ReviewComplete =
    (data?.status === "PENDING_HEAD_REVIEW" && currentManagerLevel > 1) ||
    pastHeadReview;
  const manager2ReviewComplete = hasManager2 && pastHeadReview;
  // Manager 2 data is visible to HR/Board/SuperAdmin and Manager 2 themselves.
  // Manager 1 must never see Manager 2 assessment data.
  const showManager2Data =
    isAdminRole ||
    (userRole === "MANAGER" && Number(session?.user?.id) === data?.manager2UserId);
  const selfAssessmentEnabled = data?.selfAssessmentEnabled ?? true;
  const selfAssessmentComplete =
    selfAssessmentEnabled &&
    data?.status != null &&
    data.status !== "PENDING_SELF_ASSESSMENT";
  const isEligible = data?.assessmentEligibility ?? true;
  const editingManager1 =
    isEligible && data?.canEditManagerReview && currentManagerLevel === 1;
  const editingManager2 =
    isEligible && data?.canEditManagerReview && currentManagerLevel === 2;
  const editingHr = isEligible && (data?.canEditHrReview ?? false);
  // When an HR/Board/SuperAdmin user is assigned as Manager 1 or Manager 2
  // for this employee, they must be able to edit manager assessment inputs
  // just like a regular manager. This flag separates "system role
  // permission" from "assessment assignment permission" — the
  // employee-manager assignment determines whether the user can act as
  // Manager 1 or Manager 2, regardless of their system role.
  const isAssignedManagerForCurrentLevel =
    data?.isAssignedManagerForCurrentLevel ?? false;

  const hasUnsavedChanges = useMemo(() => {
    if (!editingHr && !data?.canEditManagerReview) return false;
    for (const [key, draft] of managerDrafts) {
      const initial = initialDraftsSnapshot.get(key);
      if (!initial) return true;
      if (initial.pointsEarned !== draft.pointsEarned) return true;
      if (initial.ratingValue !== draft.ratingValue) return true;
      if (initial.remarks !== draft.remarks) return true;
    }
    // Check overall remarks for unsaved changes
    if ((data?.additionalRemarksEnabled ?? false) && data?.canEditManagerReview) {
      if (currentManagerLevel === 1 && manager1OverallRemarks !== initialOverallRemarks.manager1) {
        return true;
      }
      if (currentManagerLevel === 2 && manager2OverallRemarks !== initialOverallRemarks.manager2) {
        return true;
      }
    }
    return false;
  }, [editingHr, data?.canEditManagerReview, managerDrafts, initialDraftsSnapshot, data?.additionalRemarksEnabled, currentManagerLevel, manager1OverallRemarks, manager2OverallRemarks, initialOverallRemarks]);

  const cancelEditing = useCallback(() => {
    setManagerDrafts(
      new Map(
        [...initialDraftsSnapshot.entries()].map(([k, v]) => [
          k,
          { pointsEarned: v.pointsEarned, ratingValue: v.ratingValue, remarks: v.remarks },
        ]),
      ),
    );
    setManager1OverallRemarks(initialOverallRemarks.manager1);
    setManager2OverallRemarks(initialOverallRemarks.manager2);
    setSaveMessage(null);
  }, [initialDraftsSnapshot, initialOverallRemarks]);

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
  const manager1Total = data.questions.reduce((sum, question) => {
    if (!isScoredQuestion(question)) return sum;
    const resolved = managerColumnAnswer(
      question,
      selfAssessmentEnabled,
      manager1AnswerMap.get(question.id),
      undefined,
      answerMap.get(question.id),
    );
    return sum + (resolved?.pointsEarned ?? 0);
  }, 0);
  const manager2Total = hasManager2
    ? data.questions.reduce((sum, question) => {
        if (!isScoredQuestion(question)) return sum;
        const resolved = managerColumnAnswer(
          question,
          selfAssessmentEnabled,
          manager2AnswerMap.get(question.id),
          manager1AnswerMap.get(question.id),
          answerMap.get(question.id),
        );
        return sum + (resolved?.pointsEarned ?? 0);
      }, 0)
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
      const existing = next.get(questionId) ?? emptyManagerDraft();
      next.set(questionId, { ...existing, ...patch });
      return next;
    });
    setSaveMessage(null);
  };

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden rounded-md border border-slate-300 bg-white shadow-md shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/30">
      <PrintDocumentHeader
        title="Assessment Submission"
        description={data.templateDescription}
        metaItems={[
          { label: "Employee", value: data.employeeName },
          { label: "SAP ID", value: data.employeeId ?? "—" },
          { label: "ORG Level 1", value: displayOrgValue(data.orgLevel1Name) },
          { label: "ORG Level 2", value: displayOrgValue(data.orgLevel2Name) },
          { label: "Form", value: data.templateTitle },
          { label: "Status", value: APPRAISAL_STATUS_LABELS[data.status] },
          { label: "Score", value: `${data.rawScore}/${data.maxRawScore} (${data.scorePercent}%)` },
          {
            label: "Manager 1",
            value: formatNameWithSap(data.manager1Name, data.manager1EmployeeId),
          },
          {
            label: "Manager 2",
            value: formatNameWithSap(data.manager2Name, data.manager2EmployeeId),
          },
        ]}
      />
      <div className="border-b border-slate-200/50 bg-slate-200 px-5 py-5 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white"
              aria-hidden="true"
            >
              {getInitials(data.employeeName)}
            </div>
            <div className="min-w-0 space-y-2">
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {data.employeeName}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {data.employeeId ? (
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
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
              </div>
              {data.templateTitle ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {data.templateTitle}
                </p>
              ) : null}
              <FormDescription description={data.templateDescription} className="mt-2 no-print" />
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SubmissionInfoTile
            icon={Gauge}
            label="Score"
            value={`${data.rawScore}/${data.maxRawScore} (${data.scorePercent}%)`}
            accent
          />
          <SubmissionInfoTile
            icon={Building2}
            label="ORG Level 1"
            value={displayOrgValue(data.orgLevel1Name)}
          />
          <SubmissionInfoTile
            icon={Network}
            label="ORG Level 2"
            value={displayOrgValue(data.orgLevel2Name)}
          />
          <SubmissionInfoTile
            icon={CalendarDays}
            label="Submitted"
            value={
              data.submittedAt
                ? new Date(data.submittedAt).toLocaleString()
                : "—"
            }
          />
        </dl>
          <div className="no-print flex flex-wrap items-center gap-2 h-full">
            {/* Reset Form — admin only */}
            {isAdminRole && rows.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                disabled={resetFormMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                <RotateCcw className="size-3.5" />
                {resetFormMutation.isPending ? "Resetting..." : "Reset Form"}
              </button>
            ) : null}

            {/* Manager review actions */}
            {data.canEditManagerReview ? (
              <>
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
              </>
            ) : null}

            {/* HR review actions */}
            {editingHr && hasUnsavedChanges ? (
              <>
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
              </>
            ) : null}

            <PrintButton
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
            />
          </div>
        </div>

  
      </div>

      {!isEligible ? (
        <IneligibilityBanner
          role={isAdminRole ? "admin" : "manager"}
          employeeName={data?.employeeName}
          reason={data?.ineligibilityReason}
        />
      ) : null}

      {data?.returnHistory && data.returnHistory.length > 0 ? (
        <ReturnHistoryBanner
          returnHistory={data.returnHistory}
          view="manager"
        />
      ) : null}

      

     

      {/* HR review hint — buttons are in the header. */}
      {editingHr && hasUnsavedChanges ? (
        <div className="no-print border-b border-slate-200 bg-orange-50/60 px-4 py-1.5 text-xs text-orange-800 dark:border-slate-700 dark:bg-orange-950/20 dark:text-orange-200">
          {data.status === "PENDING_HR_CALIBRATION"
            ? "HR Alignment phase. Save or approve to send to Board."
            : data.status === "PENDING_BOARD_APPROVAL"
              ? "Board Approval phase. Save or approve to finalize."
              : "You have unsaved score changes. Save to persist your edits."}
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
                const managerDraft = managerDrafts.get(question!.id) ?? emptyManagerDraft();
                const mgr1Answer = manager1AnswerMap.get(question!.id);
                const mgr2Answer = manager2AnswerMap.get(question!.id);
                const mgr1Display = managerColumnAnswer(
                  question!,
                  selfAssessmentEnabled,
                  mgr1Answer,
                  undefined,
                  answer,
                );
                const mgr2Display = managerColumnAnswer(
                  question!,
                  selfAssessmentEnabled,
                  mgr2Answer,
                  mgr1Answer,
                  answer,
                );
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
                      <tr className="bg-teal-50/60 dark:bg-teal-950/20">
                        <td colSpan={selfAssessmentEnabled ? ((hasManager2 && showManager2Data) ? 10 : 8) : ((hasManager2 && showManager2Data) ? 8 : 6)} className="form-section-header-cell pl-8 text-xs font-bold text-teal-700 dark:text-teal-300">
                          {formatSubsectionLabel(row)}
                        </td>
                      </tr>
                    ) : null}
                    {row.isHeaderOnly ? (
                      <tr className="bg-teal-50/40 dark:bg-teal-950/10">
                        <td colSpan={selfAssessmentEnabled ? ((hasManager2 && showManager2Data) ? 10 : 8) : ((hasManager2 && showManager2Data) ? 8 : 6)} className="px-3 py-2 pl-10 text-xs italic text-teal-400 dark:text-teal-400/70">
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
                      <p className="max-w-[450px] break-words whitespace-pre-wrap text-xs leading-snug text-slate-800 dark:text-slate-200">
                        {question!.questionText}
                        <QuestionRequiredIndicator isRequired={question!.isRequired} />
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
                    {/* Manager 1 Score — read-only for admin roles unless assigned as Manager 1 */}
                    <td className="whitespace-nowrap border-r border-slate-100 px-2 py-2.5 text-right dark:border-slate-700/40">
                      {scored ? (
                        (editingManager1 && (!isAdminRole || isAssignedManagerForCurrentLevel)) || (editingHr && !isAdminRole) ? (
                          <ManagerScoreEditor
                            question={question!}
                            ratingBased={data.ratingBased}
                            ratingScales={data.ratingScales ?? []}
                            draft={managerDraft}
                            onChange={(patch) =>
                              updateManagerDraft(question!.id, patch)
                            }
                            inputClassName="h-8 w-20 rounded border border-slate-300 bg-white px-2 text-right text-xs font-bold tabular-nums text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-white/15 dark:bg-slate-800 dark:text-violet-300"
                          />
                        ) : (
                          <span className="font-bold tabular-nums text-violet-700 dark:text-violet-300">
                            {mgr1Display?.pointsEarned ?? 0}
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {/* Manager 1 Remarks — read-only for admin roles unless assigned as Manager 1 */}
                    <td className="border-r border-slate-100 px-2 py-2.5 dark:border-slate-700/40">
                      {scored ? (
                        (editingManager1 && (!isAdminRole || isAssignedManagerForCurrentLevel)) || (editingHr && !isAdminRole) ? (
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
                        ) : mgr1Display?.remarks?.trim() ? (
                          <p className="whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300">
                            {mgr1Display.remarks}
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
                            (editingManager2 && (!isAdminRole || isAssignedManagerForCurrentLevel)) || (editingHr && !isAdminRole) ? (
                              <ManagerScoreEditor
                                question={question!}
                                ratingBased={data.ratingBased}
                                ratingScales={data.ratingScales ?? []}
                                draft={managerDraft}
                                onChange={(patch) =>
                                  updateManagerDraft(question!.id, patch)
                                }
                                inputClassName="h-8 w-20 rounded border border-slate-300 bg-white px-2 text-right text-xs font-bold tabular-nums text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-white/15 dark:bg-slate-800 dark:text-indigo-300"
                              />
                            ) : (
                              <span className="font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                                {mgr2Display?.pointsEarned ?? 0}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5">
                          {scored ? (
                            (editingManager2 && (!isAdminRole || isAssignedManagerForCurrentLevel)) || (editingHr && !isAdminRole) ? (
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
                            ) : mgr2Display?.remarks?.trim() ? (
                              <p className="whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300">
                                {mgr2Display.remarks}
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
          showMarks={false}
          entries={[
            ...(selfAssessmentEnabled
              ? [
                  {
                    label: "Self Assessment",
                    awardedMarks: selfTotal,
                    totalMarks: data.maxRawScore,
                    accentClass:
                      "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
                    completed: selfAssessmentComplete,
                  },
                ]
              : []),
            {
              label: "Manager 1 Assessment",
              awardedMarks: editingManager1 ? managerDraftTotal : manager1Total,
              totalMarks: data.maxRawScore,
              accentClass:
                "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
              personLabel: formatNameWithSap(
                data.manager1Name,
                data.manager1EmployeeId,
              ),
              completed: manager1ReviewComplete,
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
                    personLabel: formatNameWithSap(
                      data.manager2Name,
                      data.manager2EmployeeId,
                    ),
                    completed: manager2ReviewComplete,
                  },
                ]
              : []),
          ]}
        />
      ) : null}

      {(data.additionalRemarksEnabled ?? false) && rows.length > 0 ? (
        <OverallRemarksSection
          enabled={data.additionalRemarksEnabled ?? false}
          manager1Remarks={manager1OverallRemarks}
          manager2Remarks={manager2OverallRemarks}
          hasManager2={hasManager2 && showManager2Data}
          canEditManager1={Boolean(editingManager1)}
          canEditManager2={Boolean(editingManager2)}
          onManager1Change={setManager1OverallRemarks}
          onManager2Change={setManager2OverallRemarks}
        />
      ) : null}

      {canViewAnyAdjustment && rows.length > 0 ? (
        <ScoreAdjustmentsPanel
          submissionId={data.id}
          scoreO={data.initialScoreNumeric ?? data.rawScore}
          maxRawScore={data.maxRawScore}
          creditHrsErpScoreAdj={data.creditHrsErpScoreAdj}
          pubOricScoreAdj={data.pubOricScoreAdj}
          qecScoreAdj={data.qecScoreAdj}
          calibrationFactor={data.calibrationFactor}
          canEdit={
            isEligible &&
            (data.canEditScoreAdjustments ||
              canEditCreditHours ||
              canEditOric ||
              canEditQec)
          }
          canEditCreditHours={canEditCreditHours}
          canEditOric={canEditOric}
          canEditQec={canEditQec}
          canEditCalibrationFactor={isAdminRole}
          performanceLevelName={data.performanceLevelName}
          quartileName={data.quartileName}
          showNormalizedScore={
            data.status === "PENDING_BOARD_APPROVAL" ||
            data.status === "APPROVED" ||
            data.status === "COMPLETED"
          }
        />
      ) : null}

      {(data.additionalRemarksEnabled ?? false) && rows.length > 0 ? (
        <OverallRemarksPrintSection
          enabled={data.additionalRemarksEnabled ?? false}
          manager1Remarks={data.manager1OverallRemarks}
          manager2Remarks={data.manager2OverallRemarks}
          hasManager2={hasManager2}
        />
      ) : null}

      {/* Reset Form confirmation modal — Danger Zone */}
      {showResetConfirm ? (
        <div className="no-print fixed inset-0 z-100 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
            onClick={() => setShowResetConfirm(false)}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-red-300 bg-white shadow-2xl dark:border-red-900/70 dark:bg-slate-900">
            {/* Danger header strip */}
            <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-5 py-3.5 dark:border-red-900/60 dark:bg-red-950/30">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300">
                <AlertTriangle className="size-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-red-700 dark:text-red-300">
                  Reset Assessment Form?
                </h2>
                <p className="text-xs font-medium uppercase tracking-wider text-red-500 dark:text-red-400">
                  Danger Zone · This action cannot be undone
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                This action will permanently remove all assessment data,
                manager assessments, and adjustments. The submission will
                return to Self Assessment stage.
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-400" />
                  Employee self-assessment answers will be deleted
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-400" />
                  Manager 1 &amp; Manager 2 scores and remarks will be cleared
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-400" />
                  HR/Board score adjustments and calibration will be reset
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-400" />
                  Uploaded attachments will be removed
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-white/10">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={resetFormMutation.isPending}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  resetFormMutation.mutate();
                }}
                disabled={resetFormMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RotateCcw className="size-3.5" />
                {resetFormMutation.isPending ? "Resetting..." : "Reset Form"}
              </button>
            </div>
          </div>
        </div>
      ) : null}


      <PrintFooter />
    </div>
  );
}
