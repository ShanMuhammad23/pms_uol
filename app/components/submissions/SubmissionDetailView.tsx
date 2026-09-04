"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
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
  formatScoreValue,
  getQuestionRatingScale,
  incompleteRequiredReviewMessage,
  parseDraftScoreAnswer,
  resolveDisplayedAnswerPoints,
  resolveDisplayedRatingValue,
  usesRatingScore,
} from "@/app/helpers/form-rating-scoring";
import { toast } from "react-hot-toast";
import {
  AnswerScoreReadout,
  RatingScoreField,
} from "@/app/components/forms/RatingScoreField";
import {
  APPRAISAL_STATUS_LABELS,
  type AppraisalStatus,
  type FormRatingScaleRecord,
  type QuestionRecord,
} from "@/types/forms";
import { getPendingManagerReviewConfig } from "@/app/helpers/dashboard-form-state";
import type { EmployeeFormAnswerRecord } from "@/types/employee-forms";
import type { FormSubmissionDetail } from "@/types/form-submissions";
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
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";

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

function managerDraftHasInput(draft: ManagerDraft): boolean {
  return (
    draft.ratingValue !== "" ||
    (draft.pointsEarned !== "" && Number.isFinite(Number(draft.pointsEarned))) ||
    Boolean(draft.remarks.trim())
  );
}

function mergeManagerDraftMaps(
  current: Map<number, ManagerDraft>,
  incoming: Map<number, ManagerDraft>,
): Map<number, ManagerDraft> {
  if (current.size === 0) {
    return incoming;
  }
  const next = new Map(incoming);
  for (const [questionId, draft] of current) {
    if (!managerDraftHasInput(draft)) {
      continue;
    }
    const saved = next.get(questionId);
    if (!saved || !managerDraftHasInput(saved)) {
      next.set(questionId, draft);
    }
  }
  return next;
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

function answersFromManagerDrafts(
  questions: QuestionRecord[],
  drafts: Map<number, ManagerDraft>,
) {
  return questions.filter(isScoredQuestion).map((question) => {
    const draft = drafts.get(question.id);
    const pointsRaw = draft?.pointsEarned;
    const pointsEarned =
      pointsRaw === "" || pointsRaw == null
        ? undefined
        : Number(pointsRaw);
    return {
      questionId: question.id,
      pointsEarned:
        pointsEarned != null && Number.isFinite(pointsEarned)
          ? pointsEarned
          : undefined,
      ratingValue: ratingValueFromDraft(draft),
      remarks: draft?.remarks?.trim() || null,
    };
  });
}

function managerDraftScoreFilled(
  question: QuestionRecord,
  draft: ManagerDraft | undefined,
  ratingBased: boolean,
  ratingScales: FormRatingScaleRecord[],
): boolean {
  const current = draft ?? emptyManagerDraft();
  if (usesRatingScore(question, ratingBased, ratingScales)) {
    return (
      current.ratingValue !== "" &&
      Number.isFinite(Number(current.ratingValue))
    );
  }
  if (current.pointsEarned === "") return false;
  const points = Number(current.pointsEarned);
  return Number.isFinite(points) && points >= 0;
}

function collectIncompleteRequiredQuestionIds(
  questions: QuestionRecord[],
  drafts: Map<number, ManagerDraft>,
  ratingBased: boolean,
  ratingScales: FormRatingScaleRecord[],
): number[] {
  return questions
    .filter(
      (question) =>
        isScoredQuestion(question) &&
        question.isRequired &&
        !managerDraftScoreFilled(question, drafts.get(question.id), ratingBased, ratingScales),
    )
    .map((question) => question.id);
}

function savedManagerAnswersPatch(
  managerLevel: number | null | undefined,
  managerAnswers: EmployeeFormAnswerRecord[],
) {
  if ((managerLevel ?? 1) === 2) {
    return { managerAnswers, manager2Answers: managerAnswers };
  }
  return { managerAnswers, manager1Answers: managerAnswers };
}

function ManagerScoreEditor({
  question,
  ratingBased,
  ratingScales,
  draft,
  onChange,
  inputClassName,
  tone = "violet",
  invalid = false,
}: {
  question: QuestionRecord;
  ratingBased: boolean;
  ratingScales: FormRatingScaleRecord[];
  draft: ManagerDraft;
  onChange: (patch: Partial<ManagerDraft>) => void;
  inputClassName: string;
  tone?: "violet" | "indigo";
  invalid?: boolean;
}) {
  const scale = getQuestionRatingScale(question, ratingScales);
  const invalidClass =
    "border-red-500 ring-2 ring-red-400/80 focus-visible:ring-red-500 dark:border-red-400";
  if (usesRatingScore(question, ratingBased, ratingScales) && scale) {
    return (
      <RatingScoreField
        scale={scale}
        weight={question.totalMarks}
        ratingValue={draft.ratingValue}
        tone={tone}
        invalid={invalid}
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
      className={cn(inputClassName, invalid && invalidClass)}
      aria-invalid={invalid || undefined}
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

function formatSubmittedAt(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function HeroMetaSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900/50">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      <dl className="mt-1 flex min-w-0 flex-1 flex-col gap-1">{children}</dl>
    </section>
  );
}

function HeroMetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd
        className="min-w-0 wrap-break-word text-xs font-medium text-slate-800 dark:text-slate-100"
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
  ratingBased = false,
  ratingScales: FormRatingScaleRecord[] = [],
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
    // they disagree with: Manager 1 ? self-assessment; Manager 2 ? Manager 1,
    // then self-assessment. HOD-only questions have no employee answer.
    const fallbackSource =
      managerLevel === 2 ? (manager1 ?? employee) : (employee ?? manager1);
    const source = manager ?? fallbackSource;
    const remarks = manager?.remarks ?? fallbackSource?.remarks ?? "";
    const displayedRating = source
      ? resolveDisplayedRatingValue(
        question,
        ratingBased,
        ratingScales,
        source,
      )
      : null;
    const computedPoints = source
      ? resolveDisplayedAnswerPoints(
        question,
        ratingBased,
        ratingScales,
        source,
      )
      : undefined;

    drafts.set(question.id, {
      pointsEarned: computedPoints === undefined ? "" : String(computedPoints),
      ratingValue: displayedRating == null ? "" : String(displayedRating),
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

function sumOwnManagerScores(
  questions: QuestionRecord[],
  answersByQuestion: Map<number, EmployeeFormAnswerRecord>,
  ratingBased: boolean,
  ratingScales: FormRatingScaleRecord[],
): number {
  return questions.reduce((sum, question) => {
    if (!isScoredQuestion(question)) return sum;
    const answer = answersByQuestion.get(question.id);
    if (!answer) return sum;
    return (
      sum +
      resolveDisplayedAnswerPoints(
        question,
        ratingBased,
        ratingScales,
        answer,
      )
    );
  }, 0);
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
  const [incompleteQuestionIds, setIncompleteQuestionIds] = useState<Set<number>>(
    () => new Set(),
  );
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

  const managerDraftsRef = useRef(managerDrafts);
  managerDraftsRef.current = managerDrafts;
  const manager1OverallRemarksRef = useRef(manager1OverallRemarks);
  manager1OverallRemarksRef.current = manager1OverallRemarks;
  const manager2OverallRemarksRef = useRef(manager2OverallRemarks);
  manager2OverallRemarksRef.current = manager2OverallRemarks;

  const { data, isLoading, error } = useQuery({
    queryKey: ["form-submission", submissionId],
    queryFn: () => fetchFormSubmission(submissionId),
  });

  const [prevSubmissionData, setPrevSubmissionData] = useState(data);
  if (data !== prevSubmissionData) {
    setPrevSubmissionData(data);
    if (data) {
      const incoming = buildManagerDraftMap(
        data.questions,
        (data.managerLevel ?? 1) === 2
          ? (data.manager2Answers ?? data.managerAnswers)
          : (data.manager1Answers ?? data.managerAnswers),
        data.answers,
        data.manager1Answers,
        data.managerLevel ?? undefined,
        data.ratingBased,
        data.ratingScales ?? [],
      );
      setManagerDrafts((current) => mergeManagerDraftMaps(current, incoming));
      setInitialDraftsSnapshot(
        new Map(
          [...incoming.entries()].map(([k, v]) => [
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

      const answers = answersFromManagerDrafts(
        data.questions,
        managerDraftsRef.current,
      );

      const overallRemarks =
        (data.managerLevel ?? 1) === 2
          ? manager2OverallRemarksRef.current
          : manager1OverallRemarksRef.current;

      return saveManagerReview(submissionId, answers, overallRemarks);
    },
    onSuccess: (result) => {
      toast.success("Manager review saved.");
      setIncompleteQuestionIds(new Set());
      queryClient.setQueryData<FormSubmissionDetail>(["form-submission", submissionId], (current) => {
        if (!current || typeof current !== "object") return current;
        const managerLevel =
          "managerLevel" in current
            ? Number((current as { managerLevel?: number }).managerLevel ?? 1)
            : 1;
        return {
          ...current,
          ...savedManagerAnswersPatch(managerLevel, result.managerAnswers),
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
      toast.error(mutationError.message);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!data) {
        throw new Error("Submission not loaded.");
      }
      if (data.canEditManagerReview) {
        const answers = answersFromManagerDrafts(
          data.questions,
          managerDraftsRef.current,
        );
        const overallRemarks =
          (data.managerLevel ?? 1) === 2
            ? manager2OverallRemarksRef.current
            : manager1OverallRemarksRef.current;
        await saveManagerReview(submissionId, answers, overallRemarks);
      }

      return approveManagerReview(submissionId);
    },
    onSuccess: (result) => {
      toast.success("Manager review approved.");
      setIncompleteQuestionIds(new Set());
      queryClient.setQueryData<FormSubmissionDetail>(["form-submission", submissionId], (current) => {
        if (!current || typeof current !== "object") return current;
        return {
          ...current,
          status: result.status,
          managerLevel: result.managerLevel,
          canEditManagerReview: false,
        };
      });
      queryClient.invalidateQueries({
        queryKey: ["form-submission", submissionId],
      });
      invalidateStaffListingQueries(queryClient);
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message);
    },
  });

  const hrSaveMutation = useMutation({
    mutationFn: () => {
      if (!data) {
        throw new Error("Submission not loaded.");
      }

      const answers = answersFromManagerDrafts(
        data.questions,
        managerDraftsRef.current,
      );

      return saveHrReview(submissionId, answers);
    },
    onSuccess: (result) => {
      toast.success("HR review saved.");
      queryClient.setQueryData<FormSubmissionDetail>(["form-submission", submissionId], (current) => {
        if (!current || typeof current !== "object") return current;
        const managerLevel =
          "managerLevel" in current
            ? Number((current as { managerLevel?: number }).managerLevel ?? 1)
            : 1;
        return {
          ...current,
          ...savedManagerAnswersPatch(managerLevel, result.managerAnswers),
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
      toast.error(mutationError.message);
    },
  });

  const hrApproveMutation = useMutation({
    mutationFn: async () => {
      if (data?.canEditHrReview) {
        const answers = answersFromManagerDrafts(
          data.questions,
          managerDraftsRef.current,
        );
        await saveHrReview(submissionId, answers);
      }

      return approveHrCalibration(submissionId);
    },
    onSuccess: (result) => {
      toast.success(
        result.status === "APPROVED"
          ? "Approved successfully."
          : "HR review approved. Sent to Board for final approval.",
      );
      queryClient.setQueryData<FormSubmissionDetail>(["form-submission", submissionId], (current) => {
        if (!current || typeof current !== "object") return current;
        return {
          ...current,
          status: result.status,
          canEditHrReview: false,
        };
      });
      queryClient.invalidateQueries({
        queryKey: ["form-submission", submissionId],
      });
      invalidateStaffListingQueries(queryClient);
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message);
    },
  });

  const resetFormMutation = useMutation({
    mutationFn: () => resetFormSubmission(submissionId),
    onSuccess: (result) => {
      toast.success("Assessment form has been reset successfully.");
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
      toast.error(mutationError.message);
    },
  });

  const answerMap = useMemo(
    () => new Map(data?.answers.map((answer) => [answer.questionId, answer])),
    [data?.answers],
  );

  const managerAnswerMap = useMemo(
    () =>
      new Map(
        (data?.managerAnswers ?? []).map((answer) => [
          answer.questionId,
          answer,
        ]),
      ),
    [data?.managerAnswers],
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
    setIncompleteQuestionIds(new Set());
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
      <div className="min-w-0 overflow-hidden rounded-md border border-slate-300 bg-white shadow-md shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/30">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="size-9 shrink-0 rounded-full bg-slate-300/80 dark:bg-slate-700" />
              <div className="min-w-0 space-y-1.5">
                <div className="h-4 w-40 rounded bg-slate-300/80 dark:bg-slate-700" />
                <div className="h-3 w-24 rounded bg-slate-300/60 dark:bg-slate-700/80" />
              </div>
            </div>
            <div className="h-6 w-28 rounded bg-slate-300/80 dark:bg-slate-700" />
            <div className="ml-auto h-7 w-20 rounded bg-slate-300/70 dark:bg-slate-700" />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="h-16 rounded-md border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900/50" />
            <div className="h-16 rounded-md border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900/50" />
            <div className="h-16 rounded-md border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900/50" />
          </div>
        </div>
        <div className="p-6 text-sm text-foreground/70">Loading submission...</div>
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
  const statusLabel =
    data.status === "PENDING_HEAD_REVIEW"
      ? getPendingManagerReviewConfig(data.managerLevel).label
      : APPRAISAL_STATUS_LABELS[data.status];

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

  const selfTotal = data.questions.reduce((sum, question) => {
    if (!isScoredQuestion(question)) return sum;
    if (selfAssessmentEnabled && !question.selfAssessmentEnabled) return sum;
    if (!selfAssessmentEnabled) return sum;
    return (
      sum +
      resolveDisplayedAnswerPoints(
        question,
        data.ratingBased,
        data.ratingScales,
        answerMap.get(question.id),
      )
    );
  }, 0);
  const manager1Total = sumOwnManagerScores(
    data.questions,
    manager1AnswerMap,
    data.ratingBased,
    data.ratingScales ?? [],
  );
  const manager2Total = hasManager2
    ? sumOwnManagerScores(
      data.questions,
      manager2AnswerMap,
      data.ratingBased,
      data.ratingScales ?? [],
    )
    : null;
  const managerDraftTotal = data.questions.reduce((sum, question) => {
    if (!isScoredQuestion(question)) return sum;
    return (
      sum +
      resolveDisplayedAnswerPoints(
        question,
        data.ratingBased,
        data.ratingScales,
        parseDraftScoreAnswer(managerDrafts.get(question.id)),
      )
    );
  }, 0);

  const displayedFormScore = editingManager2
    ? managerDraftTotal
    : editingManager1
      ? managerDraftTotal
      : currentManagerLevel > 1 && manager2Total != null
        ? manager2Total
        : manager1Total > 0
          ? manager1Total
          : selfTotal;
  const displayedFormPercent =
    data.maxRawScore > 0
      ? Math.round((displayedFormScore / data.maxRawScore) * 1000) / 10
      : 0;

  const updateManagerDraft = (
    questionId: number,
    patch: Partial<ManagerDraft>,
  ) => {
    setManagerDrafts((current) => {
      const next = new Map(current);
      const existing = next.get(questionId) ?? emptyManagerDraft();
      const updated = { ...existing, ...patch };
      next.set(questionId, updated);
      return next;
    });
    setIncompleteQuestionIds((current) => {
      if (!current.has(questionId)) return current;
      const question = data.questions.find((item) => item.id === questionId);
      if (!question) return current;
      const existing = managerDrafts.get(questionId) ?? emptyManagerDraft();
      const merged = { ...existing, ...patch };
      if (
        !managerDraftScoreFilled(
          question,
          merged,
          data.ratingBased,
          data.ratingScales ?? [],
        )
      ) {
        return current;
      }
      const next = new Set(current);
      next.delete(questionId);
      return next;
    });
  };

  const assertRequiredScoresFilled = (action: "save" | "approve"): boolean => {
    const missing = collectIncompleteRequiredQuestionIds(
      data.questions,
      managerDrafts,
      data.ratingBased,
      data.ratingScales ?? [],
    );
    if (missing.length === 0) {
      setIncompleteQuestionIds(new Set());
      return true;
    }
    setIncompleteQuestionIds(new Set(missing));
    toast.error(
      incompleteRequiredReviewMessage(missing.length, data.ratingBased, action),
    );
    requestAnimationFrame(() => {
      document
        .getElementById(`manager-question-${missing[0]}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return false;
  };

  const handleSaveReview = () => {
    if (!assertRequiredScoresFilled("save")) {
      return;
    }
    saveMutation.mutate();
  };

  const handleApproveReview = () => {
    if (!assertRequiredScoresFilled("approve")) {
      return;
    }
    approveMutation.mutate();
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
          { label: "Status", value: statusLabel },
          { label: "Score", value: `${formatScoreValue(displayedFormScore)}/${data.maxRawScore} (${displayedFormPercent}%)` },
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
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 ">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 border-b border-slate-200 pb-2">
            <Link
              href="/dashboard"
              className="no-print inline-flex items-center gap-1 text-xs text-foreground/70 hover:text-text-primary"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Link>
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white"
              aria-hidden="true"
            >
              {getInitials(data.employeeName)}
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-slate-50">
                  {data.employeeName}
                </h2>
                {data.employeeId ? (
                  <span className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                    SAP {data.employeeId}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "rounded px-1.5 py-px text-[11px] font-semibold",
                    statusStyles[data.status],
                  )}
                >
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>

          <div
            className="flex shrink-0 items-baseline gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 dark:bg-primary/15"
            aria-label={`Score ${formatScoreValue(displayedFormScore)} out of ${data.maxRawScore}, ${displayedFormPercent} percent`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Score
            </span>
            <span className="tabular-nums text-lg font-bold leading-none text-primary">
              {formatScoreValue(displayedFormScore)}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              / {data.maxRawScore}
            </span>
            <span className="text-sm font-semibold tabular-nums text-primary">
              {displayedFormPercent}%
            </span>
          </div>

          <div className="no-print ml-auto flex flex-wrap items-center justify-end gap-1.5">
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
                      onClick={handleSaveReview}
                      disabled={saveMutation.isPending || approveMutation.isPending}
                      className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-60 dark:border-violet-700 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-950/40"
                    >
                      {saveMutation.isPending ? "Saving..." : "Save"}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={handleApproveReview}
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

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <HeroMetaSection title="Form">
            <HeroMetaItem
              label="Title"
              value={data.templateTitle?.trim() || "—"}
            />
            <HeroMetaItem label="Submitted" value={formatSubmittedAt(data.submittedAt)} />
          </HeroMetaSection>
          <HeroMetaSection title="Organization">
            <HeroMetaItem label="ORG 1" value={displayOrgValue(data.orgLevel1Name)} />
            <HeroMetaItem label="ORG 2" value={displayOrgValue(data.orgLevel2Name)} />
          </HeroMetaSection>
          <HeroMetaSection title="Managers">
            <HeroMetaItem
              label="Manager 1"
              value={formatNameWithSap(data.manager1Name, data.manager1EmployeeId)}
            />
            <HeroMetaItem
              label="Manager 2"
              value={formatNameWithSap(data.manager2Name, data.manager2EmployeeId)}
            />
          </HeroMetaSection>
        </div>

        <FormDescription
          description={data.templateDescription}
          className="mt-2 no-print border-0 bg-transparent p-0"
        />
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
              <th className="min-w-65 print-col-large border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200">
                Key Performance Indicators (KPIs)
              </th>
              <th className="print-col-minimal whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200">
                Weight
              </th>
              {selfAssessmentEnabled ? (
                <>
                  <th className="min-w-42 print-col-minimal whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-teal-300">
                    Self Score
                  </th>
                  <th className="min-w-45 print-col-medium border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-teal-300">
                    Self Remarks
                  </th>
                </>
              ) : null}
              <th className="min-w-42 print-col-minimal whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-violet-300">
                Mgr 1 Score
              </th>
              <th className="min-w-45 print-col-medium border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-violet-300">
                Mgr 1 Remarks
              </th>
              {hasManager2 && showManager2Data ? (
                <>
                  <th className="min-w-42 print-col-minimal whitespace-nowrap border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                    Mgr 2 Score
                  </th>
                  <th className="min-w-45 print-col-medium border-r border-slate-700 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                    Mgr 2 Remarks
                  </th>
                </>
              ) : null}
              <th className="min-w-45 print-col-medium px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200">
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
                const isEvenRow = rowIdx % 2 === 0;

                // Open-assessment section: render authored questions display.
                if (row.isOpenAssessment) {
                  const section = data.sections.find(
                    (s) => s.isOpenAssessment && s.title === row.sectionTitle,
                  );
                  const sectionId = section?.id ?? 0;
                  const employeeAuthored = (data.authoredAnswers ?? []).filter(
                    (a) => a.openSectionId === sectionId,
                  );
                  const colSpan = selfAssessmentEnabled
                    ? ((hasManager2 && showManager2Data) ? 10 : 8)
                    : ((hasManager2 && showManager2Data) ? 8 : 6);

                  return (
                    <Fragment key={`open-${row.sr}`}>
                      {row.isFirstInSection && row.sectionTitle ? (
                        <tr className="bg-amber-50/80 dark:bg-amber-950/20">
                          <td colSpan={colSpan} className="form-section-header-cell text-sm font-bold text-amber-800 dark:text-amber-200">
                            {formatSectionLabel(row)}
                          </td>
                        </tr>
                      ) : null}
                      <tr className={cn(
                        "align-top border-b border-slate-100 dark:border-slate-700/40",
                        isEvenRow
                          ? "bg-white dark:bg-slate-900/40"
                          : "bg-slate-50/60 dark:bg-slate-800/20"
                      )}>
                        <td colSpan={colSpan} className="px-4 py-3">
                          {employeeAuthored.length === 0 ? (
                            <p className="text-xs italic text-slate-400">
                              No questions were authored for this section.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {employeeAuthored.map((a, idx) => (
                                <div
                                  key={idx}
                                  className="rounded-md border border-slate-200 bg-slate-50/40 p-2.5 dark:border-white/10 dark:bg-slate-800/20"
                                >
                                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                                    {idx + 1}. {a.authoredQuestionText}
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                    {data.ratingBased
                                      ? `Weight: ${a.authoredTotalMarks} · Rating: ${a.ratingValue ?? "—"} · Score: ${a.pointsEarned}`
                                      : `Marks: ${a.authoredTotalMarks} · Self Score: ${a.pointsEarned}`}
                                    {a.remarks ? ` · Remarks: ${a.remarks}` : ""}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  );
                }

                const answer = answerMap.get(question!.id);
                const scored = isScoredQuestion(question!);
                const questionSelfAssessmentEnabled =
                  selfAssessmentEnabled && question!.selfAssessmentEnabled;
                const managerDraft = managerDrafts.get(question!.id) ?? emptyManagerDraft();
                const mgr1Answer =
                  manager1AnswerMap.get(question!.id) ??
                  managerAnswerMap.get(question!.id);
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
                  undefined,
                  undefined,
                );
                const needsMark = incompleteQuestionIds.has(question!.id);

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
                        id={`manager-question-${question!.id}`}
                        className={cn(
                          "align-top border-b border-slate-100 dark:border-slate-700/40",
                          needsMark
                            ? "bg-red-50 dark:bg-red-950/30"
                            : isEvenRow
                              ? "bg-white dark:bg-slate-900/40"
                              : "bg-slate-50/60 dark:bg-slate-800/20",
                        )}
                      >
                        <td className="border-r border-slate-100 px-3 py-2.5 text-center tabular-nums text-slate-500 dark:border-slate-700/40">
                          {row.sr}
                        </td>
                        <td className="border-r border-slate-100 px-3 py-2.5 dark:border-slate-700/40">
                          <p
                            className={cn(
                              "max-w-112.5 wrap-break-word whitespace-pre-wrap text-xs leading-snug",
                              needsMark
                                ? "font-semibold text-red-800 dark:text-red-200"
                                : "text-slate-800 dark:text-slate-200",
                            )}
                          >
                            {question!.questionText}
                            <QuestionRequiredIndicator isRequired={question!.isRequired} />
                          </p>
                        </td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right tabular-nums font-semibold text-slate-700 dark:border-slate-700/40 dark:text-slate-300">
                          {scored ? question!.totalMarks : "—"}
                        </td>
                        {selfAssessmentEnabled ? (
                          <>
                            <td className="min-w-0 overflow-hidden border-r border-slate-100 px-3 py-2.5 text-right tabular-nums font-bold text-teal-700 dark:border-slate-700/40 dark:text-teal-300">
                              {scored ? (
                                questionSelfAssessmentEnabled ? (
                                  <AnswerScoreReadout
                                    question={question!}
                                    ratingBased={data.ratingBased}
                                    ratingScales={data.ratingScales ?? []}
                                    answer={answer}
                                    tone="teal"
                                  />
                                ) : (
                                  <span className="text-slate-400" title="To be filled by Manager">N/A</span>
                                )
                              ) : "—"}
                            </td>
                            <td className="border-r border-slate-100 px-3 py-2.5 text-xs text-slate-600 dark:border-slate-700/40 dark:text-slate-300">
                              {scored ? (
                                questionSelfAssessmentEnabled ? (
                                  answer?.remarks?.trim() ? (
                                    <p className="whitespace-pre-wrap wrap-break-word">
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
                        <td className="min-w-0 overflow-hidden border-r border-slate-100 px-2 py-2.5 text-right dark:border-slate-700/40">
                          {scored ? (
                            (editingManager1 && (!isAdminRole || isAssignedManagerForCurrentLevel)) || (editingHr && !isAdminRole) ? (
                              <ManagerScoreEditor
                                question={question!}
                                ratingBased={data.ratingBased}
                                ratingScales={data.ratingScales ?? []}
                                draft={managerDraft}
                                tone="violet"
                                invalid={needsMark}
                                onChange={(patch) =>
                                  updateManagerDraft(question!.id, patch)
                                }
                                inputClassName="h-8 w-20 rounded border border-slate-300 bg-white px-2 text-right text-xs font-bold tabular-nums text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-white/15 dark:bg-slate-800 dark:text-violet-300"
                              />
                            ) : (
                              <AnswerScoreReadout
                                question={question!}
                                ratingBased={data.ratingBased}
                                ratingScales={data.ratingScales ?? []}
                                answer={mgr1Display}
                                tone="violet"
                              />
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
                                className="w-full min-w-40 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-white/15 dark:bg-slate-800 dark:text-slate-300"
                                placeholder="Optional remarks"
                              />
                            ) : mgr1Display?.remarks?.trim() ? (
                              <p className="whitespace-pre-wrap wrap-break-word text-xs text-slate-600 dark:text-slate-300">
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
                            <td className="min-w-0 overflow-hidden border-r border-slate-100 px-2 py-2.5 text-right dark:border-slate-700/40">
                              {scored ? (
                                (editingManager2 && (!isAdminRole || isAssignedManagerForCurrentLevel)) || (editingHr && !isAdminRole) ? (
                                  <ManagerScoreEditor
                                    question={question!}
                                    ratingBased={data.ratingBased}
                                    ratingScales={data.ratingScales ?? []}
                                    draft={managerDraft}
                                    tone="indigo"
                                    invalid={needsMark}
                                    onChange={(patch) =>
                                      updateManagerDraft(question!.id, patch)
                                    }
                                    inputClassName="h-8 w-20 rounded border border-slate-300 bg-white px-2 text-right text-xs font-bold tabular-nums text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-white/15 dark:bg-slate-800 dark:text-indigo-300"
                                  />
                                ) : (
                                  <AnswerScoreReadout
                                    question={question!}
                                    ratingBased={data.ratingBased}
                                    ratingScales={data.ratingScales ?? []}
                                    answer={mgr2Display}
                                    tone="indigo"
                                  />
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
                                    className="w-full min-w-40 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-white/15 dark:bg-slate-800 dark:text-slate-300"
                                    placeholder="Optional remarks"
                                  />
                                ) : mgr2Display?.remarks?.trim() ? (
                                  <p className="whitespace-pre-wrap wrap-break-word text-xs text-slate-600 dark:text-slate-300">
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
                      {formatScoreValue(selfTotal)}
                    </td>
                    <td className="border-r border-slate-700 px-3 py-2.5" />
                  </>
                ) : null}
                <td className="whitespace-nowrap border-r border-slate-700 px-3 py-2.5 text-right text-sm font-bold tabular-nums text-violet-300">
                  {formatScoreValue(editingManager1 ? managerDraftTotal : manager1Total)}
                </td>
                <td className="border-r border-slate-700 px-3 py-2.5" />
                {hasManager2 && showManager2Data ? (
                  <>
                    <td className="whitespace-nowrap border-r border-slate-700 px-3 py-2.5 text-right text-sm font-bold tabular-nums text-indigo-300">
                      {formatScoreValue(editingManager2 ? managerDraftTotal : (manager2Total ?? 0))}
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
                  Danger Zone — This action cannot be undone
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
