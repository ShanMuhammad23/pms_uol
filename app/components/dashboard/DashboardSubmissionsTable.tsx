"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Eye, List, Pencil, RotateCcw, Search, ShieldCheck, ShieldOff, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BulkEditStaffModal } from "@/app/components/dashboard/BulkEditStaffModal";
import { ResizableHeader } from "@/app/components/common/ResizableHeader";
import {
  ColumnManagementPanel,
  ColumnManagementPanelTrigger,
} from "@/app/components/common/ColumnManagementPanel";
import {
  useColumnConfig,
  SELECT_COLUMN_WIDTH,
  type ColumnDef,
} from "@/app/hooks/use-column-config";
import { useVirtualRows } from "@/app/hooks/use-virtual-rows";
import type { ColumnConfig } from "@/lib/queries/column-widths-client";
import { isHeadRole } from "@/lib/auth/home-path";
import { InlineRemarksCell } from "@/app/components/dashboard/InlineRemarksCell";
import { InlineRoleCategoryCell } from "@/app/components/dashboard/InlineRoleCategoryCell";
import { InlineScoreAdjustmentCell } from "@/app/components/dashboard/InlineScoreAdjustmentCell";
import { HrInlineSaveButton } from "@/app/components/dashboard/HrInlineButtons";
import { FormAssignmentCell } from "@/app/components/dashboard/FormAssignmentCell";
import EligibilityConfirmationModal from "@/app/components/forms/EligibilityConfirmationModal";
import {
  StaffListingMasterFilter,
  StaffListingMasterFilterTrigger,
  getMasterFilterActiveCount,
} from "@/app/components/dashboard/StaffListingMasterFilter";
import { TableColumnHeaderFilter } from "@/app/components/dashboard/TableColumnHeaderFilter";
import { TopHorizontalScrollbar } from "@/app/components/common/TopHorizontalScrollbar";
import { APPRAISAL_STATE_CONFIG } from "@/app/helpers/dashboard-form-state";
import { itemVariants } from "@/app/helpers/dashboard-animations";
import { ELIGIBILITY_CONFIG } from "@/app/helpers/dashboard-chart-config";
import {
  getEligibilityShortLabel,
  getEligibilityDisplayLabel,
  getSubmissionEligibilityDisplayStatus,
} from "@/app/helpers/dashboard-eligibility";
import {
  EMPTY_MASTER_FILTER_STATE,
  isMasterFilterableColumn,
  type MasterFilterMultiSelection,
  type MasterFilterState,
  type MasterFilterTextColumnId,
} from "@/app/helpers/dashboard-master-filters";
import type { NumericRangeFilter } from "@/app/helpers/numeric-range-filter";
import {
  DASHBOARD_TABLE_COLUMNS,
  type DashboardTableColumnDef,
  type DashboardTableColumnId,
  canManageStaffListingColumns,
  getHrApprovalStatus,
  hasValidNormalizedScore,
  HEAD_DASHBOARD_TABLE_COLUMN_IDS,
  MANAGER_FIXED_COLUMN_IDS,
  MANAGER_FIXED_FROZEN_COLUMN_IDS,
} from "@/app/helpers/dashboard-table-columns";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { ScoreAdjustmentField } from "@/lib/queries/form-submissions-client";
import { canReviewSubmissions } from "@/lib/auth/submission-review-roles";
import { updateSubmissionScoreAdjustments, approveHrCalibration, setHrReviewRequired, updateAssessmentEligibility, fetchFormSubmissionsPage, returnSubmission as returnSubmissionClient, type ReturnLevel } from "@/lib/queries/form-submissions-client";
import { useSession } from "next-auth/react";
import { useAdditionalAccess } from "@/app/queries/use-additional-access";
import {
  invalidateStaffListingQueries,
  cancelStaffListingQueries,
  getStaffListingSnapshots,
  restoreStaffListingSnapshots,
  patchStaffListingCaches,
} from "@/app/helpers/dashboard-listing-cache";
import { buildQuartileBandsFromMatrix, sortPerformanceMatrix } from "@/lib/performance-matrix";
import { resolveSubmissionPerformanceQuartile } from "@/lib/performance-rating";
import type { PerformanceQuartileBand } from "@/lib/performance-rating";
import type { PerformanceLevelWithQuartiles } from "@/types/performance-matrices";
import { ExcelExportButton } from "@/app/components/common/ExcelExportButton";
import { HrApprovalConfirmModal, type HrApprovalAction } from "@/app/components/dashboard/HrApprovalConfirmModal";
import {
  ReturnSubmissionModal,
  type ReturnSubmissionTarget,
} from "@/app/components/dashboard/ReturnSubmissionModal";
import {
  getPerformanceLevelColor,
  getQuartileShade,
} from "@/app/helpers/dashboard-helpers";
import { useFormSubmissionsQuery } from "@/app/queries/forms";
import { DEFAULT_PAGE_SIZE } from "@/lib/dashboard/filter-params";
import type { DashboardFilterParams } from "@/types/dashboard-api";
import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import { cn } from "@/lib/utils";

const PAGE_SIZE = DEFAULT_PAGE_SIZE;
/** Page size used when "Show All" is enabled. The server caps pageSize at 100000. */
const SHOW_ALL_PAGE_SIZE = 100000;

interface DashboardSubmissionsTableProps {
  filterParams: DashboardFilterParams;
  onClearAllFilters: () => void;
  /** When set (HEAD role), only these columns are shown / toggleable. */
  allowedColumnIds?: readonly DashboardTableColumnId[];
  /** Current user role — used to show HR/Board action buttons. */
  role?: string | null;
  /** Performance matrix for resolving quartile labels in sync with the matrix table. */
  performanceMatrix?: PerformanceLevelWithQuartiles[];
  /** Called once on mount (and when the handler changes) to register the
   * table's combined clear-all handler with the parent so it can be wired
   * to the global Clear All Filters button in the filter bar. */
  onRegisterClearAll?: (clearFn: () => void) => void;
  /** Called whenever the table's combined hasActiveFilters flag changes so
   * the parent can show/hide the global Clear All Filters button. */
  onActiveFiltersChange?: (active: boolean) => void;
}

function columnCellClassName(
  column: DashboardTableColumnDef,
  extra?: string,
) {
  return cn(
    "px-2 py-1",
    "whitespace-normal break-words",
    column.align === "right" && "text-right",
    column.align === "center" && "text-center",
    extra,
  );
}

const STICKY_EDGE_SHADOW_LEFT =
  "shadow-[6px_0_12px_-8px_rgba(15,23,42,0.2)] dark:shadow-[6px_0_12px_-8px_rgba(0,0,0,0.5)]";

function stickySelectHeaderClassName() {
  return cn(
    "sticky left-0 top-0 z-50 border-b border-primary/80 bg-primary px-3 py-3",
    STICKY_EDGE_SHADOW_LEFT,
  );
}

function stickySelectCellClassName(
  isSelected: boolean,
  hrStatus?: "approved" | "review_required" | "pending",
) {
  return cn(
    "sticky left-0 z-30 border-b border-slate-100 px-2 py-1 dark:border-white/[0.03]",
    STICKY_EDGE_SHADOW_LEFT,
    isSelected
      ? "bg-amber-50 dark:bg-amber-950"
      : hrStatus === "approved"
        ? "bg-emerald-100 group-hover:bg-emerald-200 dark:bg-emerald-950 dark:group-hover:bg-emerald-900"
        : hrStatus === "review_required"
          ? "bg-orange-100 group-hover:bg-orange-200 dark:bg-orange-950 dark:group-hover:bg-orange-900"
          : "bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-800",
  );
}

function stickyHeaderClassName() {
  return "sticky top-0 z-30 border-b border-primary/80 bg-primary";
}

function canOpenSubmission(submission: FormSubmissionListItem) {
  return submission.id > 0 && submission.status !== "PENDING_SELF_ASSESSMENT";
}

function EligibilityToggleAction({
  submission,
  ctx,
}: {
  submission: FormSubmissionListItem;
  ctx?: RenderCellContext;
}) {
  if (!ctx?.isHrRole || !ctx.onToggleAssessmentEligibility) {
    return null;
  }

  const eligible = submission.assessmentEligibility;

  return (
    <button
      type="button"
      onClick={() =>
        ctx.onToggleAssessmentEligibility!(submission)
      }
      disabled={ctx.isTogglingEligibility}
      title={
        eligible ? "Disable Eligibility" : "Enable Eligibility"
      }
      aria-label={`${eligible ? "Disable" : "Enable"} eligibility for ${submission.employeeName}`}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-60",
        eligible
          ? "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/10",
      )}
    >
      {eligible ? (
        <ShieldCheck className="h-3.5 w-3.5" />
      ) : (
        <ShieldOff className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function SubmissionViewControl({
  submission,
}: {
  submission: FormSubmissionListItem;
}) {
  if (!canOpenSubmission(submission)) {
    return (
      <button
        type="button"
        disabled
        title="Self assessment not yet submitted"
        aria-label="View submission unavailable"
        className="inline-flex size-6 shrink-0 cursor-not-allowed items-center justify-center rounded-md text-slate-300 dark:text-slate-600"
      >
        <Eye className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <Link
      href={`/dashboard/submissions/${submission.id}`}
      title="View submission"
      aria-label={`View submission for ${submission.employeeName}`}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
    >
      <Eye className="h-3.5 w-3.5" />
    </Link>
  );
}

type PendingScoreChanges = Partial<Record<ScoreAdjustmentField, number | null>>;

interface RenderCellContext {
  isHrRole: boolean;
  pendingChanges: PendingScoreChanges;
  hasPending: boolean;
  onBufferedChange: (field: ScoreAdjustmentField, value: number | null) => void;
  onSave: () => void;
  onCancel: () => void;
  onApprove: () => void;
  onReviewRequired: () => void;
  onReturn: () => void;
  onBoardApprove: () => void;
  isSaving: boolean;
  isApproving: boolean;
  isReviewing: boolean;
  isReturning: boolean;
  isBoardApproving: boolean;
  canApprove: boolean;
  canBoardApprove: boolean;
  hasValidScore: boolean;
  quartileBands: PerformanceQuartileBand[] | null;
  sortedMatrix: PerformanceLevelWithQuartiles[] | null;
  onToggleAssessmentEligibility?: (submission: FormSubmissionListItem) => void;
  isTogglingEligibility?: boolean;
  /** Modules the current user can edit via additional-access (non-admin roles). */
  editableModules?: Set<string>;
}

function renderCell(
  column: DashboardTableColumnDef,
  submission: FormSubmissionListItem,
  value: string,
  ctx?: RenderCellContext,
) {
  const columnId = column.id;

  if (columnId === "status") {
    if (submission.directScoreEntry) {
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/50"
        >
          Direct Score Entry
        </span>
      );
    }
    const stateConfig = APPRAISAL_STATE_CONFIG[submission.status];
    const StateIcon = stateConfig.icon;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold",
          stateConfig.bg,
          stateConfig.color,
          stateConfig.border,
        )}
      >
        <StateIcon className="h-3 w-3" />
        {stateConfig.label}
      </span>
    );
  }

  if (columnId === "sapCode") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <SubmissionViewControl submission={submission} />
        <EligibilityToggleAction submission={submission} ctx={ctx} />
        <span
          className="block min-w-0 break-words text-slate-700 dark:text-slate-300"
          title={value === "—" ? undefined : value}
        >
          {value}
        </span>
      </span>
    );
  }

  if (columnId === "eligible" || columnId === "applicableDuration") {
    const status = getSubmissionEligibilityDisplayStatus(submission);
    const backgroundColor = ELIGIBILITY_CONFIG[status].light;

    if (columnId === "eligible") {
      const label = getEligibilityShortLabel(status);
      return (
        <span
          className="inline-flex min-w-[3.25rem] items-center justify-center rounded-md px-2.5 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor }}
          title={getEligibilityDisplayLabel(status)}
        >
          {label}
        </span>
      );
    }

    // applicableDuration — same color as Eligible badge, plain number text
    return (
      <span
        className="inline-flex min-w-[3.25rem] items-center justify-center rounded-md px-2.5 py-1 text-xs font-semibold text-white"
        style={{ backgroundColor }}
        title={getEligibilityDisplayLabel(status)}
      >
        {value}
      </span>
    );
  }

  if (columnId === "formAssignment") {
    return (
      <FormAssignmentCell
        employeeId={submission.employeeId}
        employeeName={submission.employeeName}
        formAssigned={submission.formAssigned}
        directScoreEntry={submission.directScoreEntry}
        selfAssessmentEnabled={submission.selfAssessmentEnabled}
      />
    );
  }

  if (columnId === "roleCategory") {
    return (
      <InlineRoleCategoryCell
        employeeId={submission.employeeId}
        value={submission.roleCategory}
      />
    );
  }

  if (columnId === "creditHrsErpAdj") {
    const canEdit = ctx?.isHrRole || ctx?.editableModules?.has("CREDIT_HOURS") === true;
    return (
      <InlineScoreAdjustmentCell
        submissionId={submission.id}
        field="creditHrsErpScoreAdj"
        value={submission.creditHrsErpScoreAdj}
        disabled={submission.id <= 0 || !submission.assessmentEligibility}
        canEdit={canEdit}
        onBufferedChange={ctx?.isHrRole ? ctx.onBufferedChange : undefined}
        pendingValue={ctx?.isHrRole ? ctx.pendingChanges.creditHrsErpScoreAdj : undefined}
      />
    );
  }

  if (columnId === "pubOricScoreAdj") {
    const canEdit = ctx?.isHrRole || ctx?.editableModules?.has("ORIC_ADJUSTMENTS") === true;
    return (
      <InlineScoreAdjustmentCell
        submissionId={submission.id}
        field="pubOricScoreAdj"
        value={submission.pubOricScoreAdj}
        disabled={submission.id <= 0 || !submission.assessmentEligibility}
        canEdit={canEdit}
        onBufferedChange={ctx?.isHrRole ? ctx.onBufferedChange : undefined}
        pendingValue={ctx?.isHrRole ? ctx.pendingChanges.pubOricScoreAdj : undefined}
      />
    );
  }

  if (columnId === "qecScoreAdj") {
    const canEdit = ctx?.isHrRole || ctx?.editableModules?.has("QEC_ADJUSTMENTS") === true;
    return (
      <InlineScoreAdjustmentCell
        submissionId={submission.id}
        field="qecScoreAdj"
        value={submission.qecScoreAdj}
        disabled={submission.id <= 0 || !submission.assessmentEligibility}
        canEdit={canEdit}
        onBufferedChange={ctx?.isHrRole ? ctx.onBufferedChange : undefined}
        pendingValue={ctx?.isHrRole ? ctx.pendingChanges.qecScoreAdj : undefined}
      />
    );
  }

  if (columnId === "calibrationFactor") {
    return (
      <div className="flex items-center justify-center">
        <InlineScoreAdjustmentCell
          submissionId={submission.id}
          field="calibrationFactor"
          value={submission.calibrationFactor}
          disabled={submission.id <= 0 || !submission.assessmentEligibility}
          mode="decimal"
          onBufferedChange={ctx?.isHrRole ? ctx.onBufferedChange : undefined}
          pendingValue={ctx?.isHrRole ? ctx.pendingChanges.calibrationFactor : undefined}
        />
        {ctx?.isHrRole && ctx.hasPending ? (
          <>
            <HrInlineSaveButton onSave={ctx.onSave} isPending={ctx.isSaving} disabled={ctx.isApproving} />
            <button
              type="button"
              onClick={ctx.onCancel}
              disabled={ctx.isSaving || ctx.isApproving}
              className="ml-1 inline-flex shrink-0 items-center rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold leading-none text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Cancel
            </button>
          </>
        ) : null}
      </div>
    );
  }

  if (columnId === "hrApprovalStatus") {
    const hrStatus = getHrApprovalStatus(submission);

    if (ctx?.isHrRole) {
      const scoreDisabled = !ctx.hasValidScore;
      // The Approve button advances from HR Calibration → Board Approval.
      // It is only active at the HR Calibration stage. At Board Approval,
      // the dedicated Board Approve button is used instead.
      const approveStageDisabled =
        submission.status !== "PENDING_HR_CALIBRATION";
      // Calibration Factor is required before HR can approve a submission at
      // the HR Calibration stage. Without it, the normalized score cannot be
      // finalized. Review Required remains available regardless.
      const missingCalibrationFactor =
        submission.status === "PENDING_HR_CALIBRATION" &&
        (submission.calibrationFactor == null ||
          Number.isNaN(submission.calibrationFactor));
      const approvalDisabled =
        approveStageDisabled ||
        scoreDisabled ||
        missingCalibrationFactor ||
        ctx.isApproving ||
        ctx.isSaving ||
        ctx.isReviewing ||
        ctx.isReturning;
      const reviewDisabled =
        scoreDisabled || ctx.isReviewing || ctx.isSaving || ctx.isApproving || ctx.isReturning;
      const disabledTitle = approveStageDisabled
        ? "Approval is unavailable — the submission is not at the HR Calibration stage"
        : scoreDisabled
          ? "HR approval is unavailable until a valid Normalized Score has been calculated"
          : missingCalibrationFactor
            ? "Approval is blocked — Calibration Factor has not been set. Please enter a Calibration Factor before approving."
            : "Approve";

      // Return button mirrors Approve / Review Required: always rendered for
      // HR, but disabled when there is no valid submission to return, when the
      // row is a direct-score-entry (no submission workflow), when the
      // submission is still in Self Assessment (nothing to return), or while
      // another HR action is in progress.
      const returnDisabled =
        submission.directScoreEntry ||
        submission.status === "PENDING_SELF_ASSESSMENT" ||
        submission.id <= 0 ||
        ctx.isApproving ||
        ctx.isSaving ||
        ctx.isReviewing ||
        ctx.isReturning;
      const returnDisabledTitle = submission.directScoreEntry
        ? "Return is unavailable for direct score entry rows"
        : submission.status === "PENDING_SELF_ASSESSMENT"
          ? "Return is unavailable before the self assessment is submitted"
          : submission.id <= 0
            ? "Return is unavailable — no submission exists for this employee"
            : "Return submission";

      // Board Approval button: always rendered for HR/Board, but only active
      // when the submission has reached PENDING_BOARD_APPROVAL status. Disabled
      // for direct-score-entry rows, rows with no submission, or while another
      // action is in progress.
      const boardApprovalDisabled =
        submission.directScoreEntry ||
        submission.id <= 0 ||
        submission.status !== "PENDING_BOARD_APPROVAL" ||
        ctx.isApproving ||
        ctx.isSaving ||
        ctx.isReviewing ||
        ctx.isReturning ||
        ctx.isBoardApproving;
      const boardApprovalTitle = submission.directScoreEntry
        ? "Board approval is unavailable for direct score entry rows"
        : submission.id <= 0
          ? "Board approval is unavailable — no submission exists for this employee"
          : submission.status !== "PENDING_BOARD_APPROVAL"
            ? "Board approval is unavailable until the submission reaches the Board Approval stage"
            : "Approve at Board level";

      return (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={ctx.onApprove}
            disabled={approvalDisabled}
            title={
              approveStageDisabled || scoreDisabled || missingCalibrationFactor
                ? disabledTitle
                : "Approve"
            }
            aria-label="Approve"
            className={cn(
              "inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              hrStatus === "approved"
                ? "bg-emerald-600 text-white dark:bg-emerald-500"
                : missingCalibrationFactor
                  ? "text-amber-600 ring-1 ring-inset ring-amber-400 dark:text-amber-400 dark:ring-amber-600"
                  : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20",
            )}
          >
            {ctx.isApproving ? (
              <span className="text-[10px]">...</span>
            ) : (
              <Check className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={ctx.onReviewRequired}
            disabled={reviewDisabled}
            title={scoreDisabled ? disabledTitle : "Review Required"}
            aria-label="Mark review required"
            className={cn(
              "inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              hrStatus === "review_required"
                ? "bg-orange-600 text-white dark:bg-orange-500"
                : "text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20",
            )}
          >
            {ctx.isReviewing ? (
              <span className="text-[10px]">...</span>
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
          </button>
          <span className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <button
            type="button"
            onClick={ctx.onReturn}
            disabled={returnDisabled}
            title={returnDisabledTitle}
            aria-label="Return submission"
            className={cn(
              "inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              submission.isReturned
                ? "bg-amber-600 text-white dark:bg-amber-500"
                : "text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20",
            )}
          >
            {ctx.isReturning ? (
              <span className="text-[10px]">...</span>
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
          </button>
          <span className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <button
            type="button"
            onClick={ctx.onBoardApprove}
            disabled={boardApprovalDisabled}
            title={boardApprovalTitle}
            aria-label="Board approve"
            className={cn(
              "inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              submission.status === "APPROVED"
                ? "bg-violet-600 text-white dark:bg-violet-500"
                : "text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20",
            )}
          >
            {ctx.isBoardApproving ? (
              <span className="text-[10px]">...</span>
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
          </button>
        </div>
      );
    }

    if (hrStatus === "approved") {
      return (
        <span className="inline-flex items-center justify-center" title="Approved">
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </span>
      );
    }

    if (hrStatus === "review_required") {
      return (
        <span className="inline-flex items-center justify-center" title="Review Required">
          <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        </span>
      );
    }

    return (
      <span
        className="inline-flex items-center justify-center text-xs text-slate-400 dark:text-slate-500"
        title="Pending"
      >
        —
      </span>
    );
  }

  if (columnId === "quartile") {
    if (ctx?.quartileBands && ctx.sortedMatrix) {
      const resolved = resolveSubmissionPerformanceQuartile(
        submission,
        ctx.quartileBands,
      );
      if (!resolved) {
        return <span className="text-slate-400 italic dark:text-slate-500">—</span>;
      }
      const levelIndex = ctx.sortedMatrix.findIndex(
        (l) => l.id === resolved.performanceLevelId,
      );
      const level = levelIndex >= 0 ? ctx.sortedMatrix[levelIndex] : null;
      const quartileIndex = level
        ? level.quartiles.findIndex((q) => q.id === resolved.quartileId)
        : -1;
      const levelColor = getPerformanceLevelColor(
        resolved.performanceLevelName,
        levelIndex >= 0 ? levelIndex : 0,
      );
      const quartileShade =
        quartileIndex >= 0 ? getQuartileShade(quartileIndex) : "";
      return (
        <span
          className={cn(
            "inline-flex rounded-md",
            levelColor,
          )}
        >
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium text-white",
              quartileShade,
            )}
          >
            {resolved.quartileName}
          </span>
        </span>
      );
    }
    return (
      <span className="block text-slate-700 dark:text-slate-300">
        {value === "—" ? <span className="text-slate-400 italic dark:text-slate-500">—</span> : value}
      </span>
    );
  }

  if (columnId === "ratingN") {
    if (ctx?.quartileBands && ctx.sortedMatrix) {
      const resolved = resolveSubmissionPerformanceQuartile(
        submission,
        ctx.quartileBands,
      );
      if (!resolved) {
        return <span className="text-slate-400 italic dark:text-slate-500">—</span>;
      }
      const level = ctx.sortedMatrix.find((l) => l.id === resolved.performanceLevelId);
      const levelName = level?.name ?? resolved.performanceLevelName;
      return (
        <span className="block text-center text-xs font-semibold text-slate-700 dark:text-slate-300">
          {levelName}
        </span>
      );
    }
    return (
      <span className="block text-slate-700 dark:text-slate-300">
        {value === "—" ? <span className="text-slate-400 italic dark:text-slate-500">—</span> : value}
      </span>
    );
  }

  if (columnId === "remarksEvaluation") {
    return (
      <InlineRemarksCell
        submissionId={submission.id}
        field="remarksEvaluation"
        value={submission.remarksEvaluation}
        disabled={submission.id <= 0}
      />
    );
  }

  if (columnId === "remarksCompensation") {
    return (
      <InlineRemarksCell
        submissionId={submission.id}
        field="remarksCompensation"
        value={submission.remarksCompensation}
        disabled={submission.id <= 0}
      />
    );
  }

  if (columnId === "scoreO" && submission.directScoreEntry && submission.id > 0) {
    return (
      <InlineScoreAdjustmentCell
        submissionId={submission.id}
        field="initialScoreNumeric"
        value={submission.scoreO}
        mode="score"
        disabled={!submission.assessmentEligibility}
        onBufferedChange={ctx?.isHrRole ? ctx.onBufferedChange : undefined}
        pendingValue={ctx?.isHrRole ? ctx.pendingChanges.initialScoreNumeric : undefined}
      />
    );
  }

  return (
    <span
      className={cn(
        "block min-w-0 break-words text-slate-700 dark:text-slate-300",
        columnId === "employeeName" && "font-semibold text-slate-900 dark:text-white",
      )}
      title={value === "—" ? undefined : value}
    >
      {value}
    </span>
  );
}

export function DashboardSubmissionsTable({
  filterParams,
  onClearAllFilters,
  allowedColumnIds,
  role,
  performanceMatrix,
  onRegisterClearAll,
  onActiveFiltersChange,
}: DashboardSubmissionsTableProps) {
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const isHrRole = canReviewSubmissions(role ?? undefined);
  const isManagerRole = isHeadRole(role ?? undefined);
  const canManageColumns = canManageStaffListingColumns(role ?? undefined);

  // For Manager role, the base column set is the fixed manager layout.
  // Additional-access columns (Credit Hours, ORIC, QEC) from the parent
  // are merged in so that managers with those permissions can see them.
  // Only columns beyond the HEAD base set are added — the HEAD base set
  // includes columns that are intentionally excluded from the Manager's
  // fixed layout (e.g. roleCategory, facultyName, eligible).
  const managerAllowedColumnIds = useMemo(() => {
    if (!isManagerRole) return allowedColumnIds;
    const base = new Set<string>(MANAGER_FIXED_COLUMN_IDS);
    if (allowedColumnIds) {
      const headBase = new Set<string>(HEAD_DASHBOARD_TABLE_COLUMN_IDS);
      for (const id of allowedColumnIds) {
        // Only add columns that are NOT in the HEAD base set — these are
        // the additional-access columns (creditHrsErpAdj, pubOricScoreAdj, etc.)
        if (!headBase.has(id) && !base.has(id)) {
          base.add(id);
        }
      }
    }
    return [...base] as DashboardTableColumnId[];
  }, [isManagerRole, allowedColumnIds]);

  // Fixed column configuration for Manager 1 / Manager 2 roles.
  // Managers do not get column management — they always see the predefined
  // layout with the first four columns frozen. Saved preferences are ignored.
  // Additional-access columns are appended after the fixed columns.
  const managerFixedConfig = useMemo<ColumnConfig | undefined>(
    () =>
      isManagerRole && managerAllowedColumnIds
        ? {
            order: [...managerAllowedColumnIds],
            visible: [...managerAllowedColumnIds],
            frozen: [...MANAGER_FIXED_FROZEN_COLUMN_IDS],
            widths: {},
          }
        : undefined,
    [isManagerRole, managerAllowedColumnIds],
  );

  const {
    config,
    defaults: configDefaults,
    visibleOrderedColumns,
    frozenColumnIds,
    lastFrozenColumnId,
    stickyOffsets,
    getColumnWidth,
    setColumnWidth,
    updateConfig,
    resetConfig,
  } = useColumnConfig("dashboard-staff-listing", {
    allColumns: DASHBOARD_TABLE_COLUMNS as readonly ColumnDef[],
    allowedColumnIds: managerAllowedColumnIds,
    hasSelectColumn: isHrRole,
    fixedConfig: managerFixedConfig,
  });

  // Compute the RBAC-filtered column list for the Column Management panel.
  // This ensures restricted columns never appear in the panel, even if
  // previously saved preferences reference them.
  const allowedColumns = useMemo(() => {
    if (!managerAllowedColumnIds) return DASHBOARD_TABLE_COLUMNS as readonly ColumnDef[];
    const allowed = new Set<string>(managerAllowedColumnIds);
    return (DASHBOARD_TABLE_COLUMNS as readonly ColumnDef[]).filter((col) =>
      allowed.has(col.id),
    );
  }, [managerAllowedColumnIds]);

  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [hasFullDataset, setHasFullDataset] = useState(false);
  const [masterFilters, setMasterFilters] = useState<MasterFilterState>(
    EMPTY_MASTER_FILTER_STATE,
  );
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [masterFilterOpen, setMasterFilterOpen] = useState(false);
  const [columnMgmtOpen, setColumnMgmtOpen] = useState(false);
  const [eligibilityModalState, setEligibilityModalState] = useState<{
    open: boolean;
    submission: FormSubmissionListItem | null;
    error: string | null;
  }>({ open: false, submission: null, error: null });
  const [hrApprovalModal, setHrApprovalModal] = useState<{
    open: boolean;
    action: HrApprovalAction;
    submissionId: number;
  }>({ open: false, action: "approve", submissionId: 0 });
  const [returnModal, setReturnModal] = useState<{
    open: boolean;
    submissionId: number;
    error: string | null;
  }>({ open: false, submissionId: 0, error: null });
  const masterFilterActiveCount = getMasterFilterActiveCount(masterFilters);

  // When Show All is active OR we have a cached full dataset, always request
  // page 1 with SHOW_ALL_PAGE_SIZE. This keeps the query key identical so
  // React Query returns the cached full-dataset response without refetching
  // when the user toggles between Show All and Show Paginated.
  const useFullDataset = showAll || hasFullDataset;
  const queryPage = useFullDataset ? 1 : page;
  const queryPageSize = useFullDataset ? SHOW_ALL_PAGE_SIZE : PAGE_SIZE;

  const {
    data: submissionsPage,
    isLoading,
    error,
  } = useFormSubmissionsQuery({
    page: queryPage,
    pageSize: queryPageSize,
    filters: filterParams,
    masterFilters,
  });

  const allSubmissions = Array.isArray(submissionsPage?.items)
    ? submissionsPage.items
    : [];
  const totalCount = submissionsPage?.total ?? 0;

  // Cache the full dataset once Show All data arrives so subsequent toggles
  // to Show Paginated can reuse the cached response (no refetch).
  useEffect(() => {
    if (showAll && submissionsPage) {
      setHasFullDataset(true);
    }
  }, [showAll, submissionsPage]);

  // Invalidate the full-dataset cache when filters change so the next
  // Show All fetches fresh data for the new filter state.
  useEffect(() => {
    setHasFullDataset(false);
  }, [filterParams, masterFilters]);

  // When using the cached full dataset in paginated mode, slice the
  // all-records response to show only the current page.
  const submissions = useMemo(() => {
    if (useFullDataset && !showAll) {
      const start = (page - 1) * PAGE_SIZE;
      return allSubmissions.slice(start, start + PAGE_SIZE);
    }
    return allSubmissions;
  }, [allSubmissions, useFullDataset, showAll, page]);

  // Virtualize rows in Show All mode to avoid rendering thousands of DOM
  // rows simultaneously. In paginated mode virtualization is disabled.
  const virtualRows = useVirtualRows({
    count: submissions.length,
    estimateSize: 33,
    enabled: showAll,
  });

  const matchingEmployeeIds = submissionsPage?.matchingEmployeeIds;
  const columnCountsById = useMemo(() => {
    const map: Partial<Record<DashboardTableColumnId, MultiSelectOption[]>> =
      {};
    for (const [columnId, options] of Object.entries(
      submissionsPage?.columnCounts ?? {},
    )) {
      map[columnId as DashboardTableColumnId] = (options ?? []).map(
        (option) => ({
          value: option.value,
          label: option.value,
          count: option.count,
        }),
      );
    }
    return map;
  }, [submissionsPage?.columnCounts]);

  const { data: session } = useSession();
  const { canEdit: canEditModule, permissions } = useAdditionalAccess(
    session?.user?.id ? Number(session.user.id) : undefined,
    session?.user?.role,
  );
  const editableModules = useMemo(() => {
    const modules = new Set<string>();
    if (canEditModule("CREDIT_HOURS")) modules.add("CREDIT_HOURS");
    if (canEditModule("ORIC_ADJUSTMENTS")) modules.add("ORIC_ADJUSTMENTS");
    if (canEditModule("QEC_ADJUSTMENTS")) modules.add("QEC_ADJUSTMENTS");
    return modules;
    // canEditModule is excluded from deps because it is a new function reference
    // on every render. It closes over `permissions`, so depending on `permissions`
    // is sufficient to recompute when access actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions]);
  const queryClient = useQueryClient();
  const [pendingScoreChanges, setPendingScoreChanges] = useState<
    Record<number, PendingScoreChanges>
  >({});

  const quartileBands = useMemo(
    () =>
      performanceMatrix && performanceMatrix.length > 0
        ? buildQuartileBandsFromMatrix(performanceMatrix)
        : null,
    [performanceMatrix],
  );

  const sortedMatrix = useMemo(
    () =>
      performanceMatrix && performanceMatrix.length > 0
        ? sortPerformanceMatrix(performanceMatrix)
        : null,
    [performanceMatrix],
  );

  const handleBufferedChange = (submissionId: number) =>
    (field: ScoreAdjustmentField, value: number | null) => {
      setPendingScoreChanges((current) => {
        const next = { ...current };
        if (field === ("__clear__" as ScoreAdjustmentField)) {
          delete next[submissionId];
          return next;
        }
        const existing = next[submissionId] ?? {};
        next[submissionId] = { ...existing, [field]: value };
        return next;
      });
    };

  const handleCancelScoreChanges = (submissionId: number) => () => {
    setPendingScoreChanges((current) => {
      const next = { ...current };
      delete next[submissionId];
      return next;
    });
  };

  const hasAnyPending = Object.keys(pendingScoreChanges).length > 0;

  useEffect(() => {
    if (!hasAnyPending) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
        ) {
          return;
        }
        event.preventDefault();
        setPendingScoreChanges({});
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasAnyPending]);

  const hrSaveMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      const changes = pendingScoreChanges[submissionId];
      if (!changes) return;
      const entries = Object.entries(changes) as Array<
        [ScoreAdjustmentField, number | null]
      >;
      for (const [field, value] of entries) {
        await updateSubmissionScoreAdjustments(submissionId, field, value);
      }
    },
    onSuccess: (_data, submissionId) => {
      setPendingScoreChanges((current) => {
        const next = { ...current };
        delete next[submissionId];
        return next;
      });
      invalidateStaffListingQueries(queryClient);
    },
  });

  const hrApproveMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      const changes = pendingScoreChanges[submissionId];
      if (changes) {
        const entries = Object.entries(changes) as Array<
          [ScoreAdjustmentField, number | null]
        >;
        for (const [field, value] of entries) {
          await updateSubmissionScoreAdjustments(submissionId, field, value);
        }
      }
      const existing = submissions.find((s) => s.id === submissionId);
      if (
        existing &&
        existing.status === "PENDING_HR_CALIBRATION"
      ) {
        return approveHrCalibration(submissionId);
      }
    },
    onSuccess: (data, submissionId) => {
      setPendingScoreChanges((current) => {
        const next = { ...current };
        delete next[submissionId];
        return next;
      });
      // Optimistically patch the row so the UI updates immediately,
      // without waiting for the background refetch to complete.
      if (data?.status) {
        patchStaffListingCaches(queryClient, (row) =>
          row.id === submissionId
            ? {
                ...row,
                status: data.status,
                hrApprovalStatus: "approved",
              }
            : row,
        );
      }
      invalidateStaffListingQueries(queryClient);
      setHrApprovalModal({ open: false, action: "approve", submissionId: 0 });
    },
  });

  const boardApproveMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      const existing = submissions.find((s) => s.id === submissionId);
      if (
        existing &&
        existing.status === "PENDING_BOARD_APPROVAL"
      ) {
        return approveHrCalibration(submissionId);
      }
    },
    onSuccess: (data, submissionId) => {
      if (data?.status) {
        patchStaffListingCaches(queryClient, (row) =>
          row.id === submissionId
            ? {
                ...row,
                status: data.status,
                hrApprovalStatus: "approved",
              }
            : row,
        );
      }
      invalidateStaffListingQueries(queryClient);
      setHrApprovalModal({ open: false, action: "approve", submissionId: 0 });
    },
  });

  const hrReviewRequiredMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      return setHrReviewRequired(submissionId);
    },
    onSuccess: (_data, submissionId) => {
      patchStaffListingCaches(queryClient, (row) =>
        row.id === submissionId
          ? {
              ...row,
              status: "PENDING_HR_CALIBRATION",
              hrApprovalStatus: "review_required",
            }
          : row,
      );
      invalidateStaffListingQueries(queryClient);
      setHrApprovalModal({ open: false, action: "approve", submissionId: 0 });
    },
  });

  const returnSubmissionMutation = useMutation({
    mutationFn: async ({
      submissionId,
      returnLevel,
      reason,
    }: {
      submissionId: number;
      returnLevel: ReturnLevel;
      reason: string;
    }) => {
      return returnSubmissionClient(submissionId, returnLevel, reason);
    },
    onMutate: ({ submissionId, returnLevel }) => {
      // Optimistically update the affected row only — no full refetch.
      void cancelStaffListingQueries(queryClient);
      const snapshots = getStaffListingSnapshots(queryClient);
      patchStaffListingCaches(queryClient, (row) => {
        if (row.id !== submissionId) return row;
        return {
          ...row,
          isReturned: true,
          status:
            returnLevel === "employee"
              ? "PENDING_SELF_ASSESSMENT"
              : "PENDING_HEAD_REVIEW",
          managerLevel: returnLevel === "manager2" ? 2 : 1,
          // Clear HR calibration fields that depend on removed manager data.
          creditHrsErpScoreAdj:
            returnLevel === "manager2" ? row.creditHrsErpScoreAdj : null,
          pubOricScoreAdj:
            returnLevel === "manager2" ? row.pubOricScoreAdj : null,
          qecScoreAdj: returnLevel === "manager2" ? row.qecScoreAdj : null,
          calibrationFactor:
            returnLevel === "manager2" ? row.calibrationFactor : null,
          normalizedScore:
            returnLevel === "manager2" ? row.normalizedScore : null,
          // Clear manager scores for removed levels.
          manager2Score:
            returnLevel === "manager2" ? row.manager2Score : null,
          manager1Score:
            returnLevel === "employee" ? row.manager1Score : row.manager1Score,
          // Clear manager overall remarks for removed levels.
          manager2OverallRemarks:
            returnLevel === "manager2" ? row.manager2OverallRemarks : null,
          manager1OverallRemarks:
            returnLevel === "employee" ? row.manager1OverallRemarks : null,
          // Reset HR approval status.
          hrApprovalStatus: "pending",
        };
      });
      return { snapshots };
    },
    onError: (_error, _vars, context) => {
      if (context?.snapshots) {
        restoreStaffListingSnapshots(queryClient, context.snapshots);
      }
    },
    onSuccess: () => {
      invalidateStaffListingQueries(queryClient);
    },
  });

  const eligibilityToggleMutation = useMutation({
    mutationFn: async ({
      employeeId,
      current,
      reason,
    }: {
      employeeId: string;
      current: boolean;
      reason?: string;
    }) => {
      return updateAssessmentEligibility([employeeId], !current, reason);
    },
    onMutate: ({ employeeId, current }) => {
      void cancelStaffListingQueries(queryClient);
      const snapshots = getStaffListingSnapshots(queryClient);
      patchStaffListingCaches(queryClient, (row) =>
        row.employeeId === employeeId
          ? { ...row, assessmentEligibility: !current }
          : row,
      );
      return { snapshots };
    },
    onError: (_error, _vars, context) => {
      if (context?.snapshots) {
        restoreStaffListingSnapshots(queryClient, context.snapshots);
      }
    },
    onSuccess: () => {
      invalidateStaffListingQueries(queryClient);
    },
  });

  const visibleColumns = visibleOrderedColumns as DashboardTableColumnDef[];
  const colSpan = Math.max(visibleColumns.length, 1) + 1;
  const frozenSet = useMemo(
    () => new Set(frozenColumnIds),
    [frozenColumnIds],
  );

  // Display page size: PAGE_SIZE for paginated view, totalCount for Show All.
  // When the full dataset is cached, pagination math still uses PAGE_SIZE.
  const displayPageSize = showAll ? totalCount : PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(totalCount / displayPageSize));

  useEffect(() => {
    setPage(1);
  }, [filterParams, showAll]);

  // Don't sync page from server response when using the full dataset —
  // the query always requests page 1, but the user's page is managed
  // client-side and used to slice the cached data.
  useEffect(() => {
    if (useFullDataset) return;
    if (submissionsPage?.page != null && submissionsPage.page !== page) {
      setPage(submissionsPage.page);
    }
  }, [submissionsPage?.page, page, useFullDataset]);

  useEffect(() => {
    if (!matchingEmployeeIds) {
      return;
    }

    const available = new Set(matchingEmployeeIds);
    setSelectedEmployeeIds((current) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of current) {
        if (available.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [matchingEmployeeIds]);

  const filteredEmployeeIds = matchingEmployeeIds ?? [];

  const selectedCount = selectedEmployeeIds.size;
  const allFilteredSelected =
    filteredEmployeeIds.length > 0 &&
    filteredEmployeeIds.every((id) => selectedEmployeeIds.has(id));
  const someFilteredSelected =
    selectedCount > 0 && !allFilteredSelected;

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * displayPageSize + 1;
  const rangeEnd = Math.min(page * displayPageSize, totalCount);
  const showPagination = !showAll && !isLoading && !error && totalCount > 0;

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedEmployeeIds((current) => {
      if (
        filteredEmployeeIds.length > 0 &&
        filteredEmployeeIds.every((id) => current.has(id))
      ) {
        return new Set();
      }
      return new Set(filteredEmployeeIds);
    });
  };

  const handleMasterTextChange = (
    columnId: MasterFilterTextColumnId,
    next: string,
  ) => {
    setPage(1);
    setMasterFilters((current) => {
      const text = { ...current.text };

      if (!next.trim()) {
        delete text[columnId];
      } else {
        text[columnId] = next;
      }

      return { ...current, text };
    });
  };

  const handleMasterMultiChange = (
    columnId: DashboardTableColumnId,
    next: MasterFilterMultiSelection,
  ) => {
    setPage(1);
    setMasterFilters((current) => {
      const multi = { ...current.multi };

      if (next === null) {
        delete multi[columnId];
      } else {
        multi[columnId] = next;
      }

      return { ...current, multi };
    });
  };

  const handleMasterNumericChange = (
    columnId: DashboardTableColumnId,
    filter: NumericRangeFilter | undefined,
  ) => {
    setMasterFilters((current) => {
      const numeric = { ...current.numeric };

      if (filter === undefined) {
        delete numeric[columnId];
      } else {
        numeric[columnId] = filter;
      }

      return { ...current, numeric };
    });
  };

  const clearMasterFilters = useCallback(() => {
    setPage(1);
    setMasterFilters(EMPTY_MASTER_FILTER_STATE);
  }, []);

  const handleClearAllFilters = useCallback(() => {
    clearMasterFilters();
    onClearAllFilters();
  }, [clearMasterFilters, onClearAllFilters]);

  const hasActiveFilters =
    masterFilterActiveCount > 0 ||
    !!filterParams.searchQuery ||
    filterParams.category0EntityIds !== null ||
    filterParams.category1EntityIds !== null ||
    filterParams.category2EntityIds !== null ||
    filterParams.roleCategories !== null ||
    filterParams.designations !== null ||
    filterParams.formStates !== null;

  useEffect(() => {
    onRegisterClearAll?.(handleClearAllFilters);
  }, [handleClearAllFilters, onRegisterClearAll]);

  useEffect(() => {
    onActiveFiltersChange?.(hasActiveFilters);
  }, [hasActiveFilters, onActiveFiltersChange]);

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.6 }}
      className="min-w-0 min-h-screen max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
    >
      <div className="relative z-50 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-white/5">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            Staff listing ( Total: {totalCount} )
          </p>
          {isHrRole && selectedCount > 0 ? (
            <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {selectedCount} of {totalCount} record{totalCount !== 1 ? "s" : ""} selected
                {allFilteredSelected ? " (all)" : ""}
              </span>
              <button
                type="button"
                onClick={() => setSelectedEmployeeIds(new Set())}
                className="text-amber-600 hover:underline dark:text-amber-400"
              >
                Clear
              </button>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            disabled={totalCount === 0 && !showAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.04]"
            title={showAll ? "Return to paginated view" : "Show all records in a single page"}
          >
            <List className="h-3.5 w-3.5" />
            {showAll ? "Show Paginated" : "Show All"}
          </button>
          <StaffListingMasterFilterTrigger
            open={masterFilterOpen}
            onOpenChange={setMasterFilterOpen}
            activeCount={masterFilterActiveCount}
          />
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.04]"
              title="Clear all filters and search"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear filters
            </button>
          ) : null}
          {canManageColumns ? (
            <ColumnManagementPanelTrigger
              open={columnMgmtOpen}
              onOpenChange={setColumnMgmtOpen}
            />
          ) : null}
          {isHrRole ? (
            <button
              type="button"
              onClick={() => setBulkEditOpen(true)}
              disabled={selectedCount === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-amber-600 dark:hover:bg-amber-500"
            >
              <Pencil className="h-3.5 w-3.5" />
              Bulk edit
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>
          ) : null}
          <ExcelExportButton
            columns={allowedColumns as readonly DashboardTableColumnDef[]}
            allRows={submissions}
            filteredRows={submissions}
            selectedEmployeeIds={selectedEmployeeIds}
            getEmployeeId={(row: FormSubmissionListItem) => row.employeeId}
            fileName="staff-listing"
            sheetName="Staff Listing"
            storageKey="pms-export-staff-listing-columns"
            disabled={isLoading || !!error}
            visible={isHrRole}
            fetchRowsForExport={async () => {
              const res = await fetchFormSubmissionsPage({
                page: 1,
                pageSize: 100000,
                filters: filterParams,
                masterFilters,
              });
              return res.items;
            }}
          />
        </div>
      </div>

      <StaffListingMasterFilter
        open={masterFilterOpen}
        onOpenChange={setMasterFilterOpen}
        columnCounts={columnCountsById}
        filters={masterFilters}
        onTextChange={handleMasterTextChange}
        onMultiChange={handleMasterMultiChange}
        onNumericChange={handleMasterNumericChange}
        onClearAll={clearMasterFilters}
        allowedColumnIds={managerAllowedColumnIds}
      />

      {canManageColumns ? (
        <ColumnManagementPanel
          open={columnMgmtOpen}
          onOpenChange={setColumnMgmtOpen}
          columns={allowedColumns}
          config={config}
          defaults={configDefaults}
          onApply={updateConfig}
          onReset={resetConfig}
        />
      ) : null}

      <TopHorizontalScrollbar
        targetRef={tableScrollRef}
        className="border-b border-slate-200 dark:border-white/5"
      />

      <div
        ref={(el) => {
          tableScrollRef.current = el;
          if (virtualRows.enabled) {
            virtualRows.scrollRef.current = el;
          }
        }}
        className="w-full max-w-full max-h-[calc(100vh-5.5rem)] overflow-auto overscroll-contain"
      >
        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="bg-primary text-white">
              {isHrRole ? (
                <th
                  className={stickySelectHeaderClassName()}
                  style={{
                    width: SELECT_COLUMN_WIDTH,
                    minWidth: SELECT_COLUMN_WIDTH,
                    maxWidth: SELECT_COLUMN_WIDTH,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={(element) => {
                      if (element) {
                        element.indeterminate = someFilteredSelected;
                      }
                    }}
                    onChange={toggleSelectAllFiltered}
                    disabled={filteredEmployeeIds.length === 0}
                    aria-label="Select all filtered staff"
                    className="h-4 w-4 rounded border-white/40 text-amber-600 focus:ring-amber-500/30 disabled:opacity-40"
                  />
                </th>
              ) : null}
              {visibleColumns.map((column) => {
                const savedWidth = getColumnWidth(column.id, column.width);
                const isFrozen = frozenSet.has(column.id);
                return (
                  <ResizableHeader
                    key={column.id}
                    columnId={column.id}
                    width={savedWidth}
                    onResize={setColumnWidth}
                    frozen={isFrozen}
                    stickyLeft={isFrozen ? stickyOffsets[column.id] : undefined}
                    className={columnCellClassName(
                      column,
                      cn(
                        stickyHeaderClassName(),
                        "text-xs font-semibold uppercase tracking-wider text-white",
                        isFrozen && "bg-primary",
                        column.id === lastFrozenColumnId && "border-r-2 border-slate-300/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)] dark:border-white/20",
                      ),
                    )}
                  >
                    {isMasterFilterableColumn(column.id) ? (
                      <TableColumnHeaderFilter
                        column={column}
                        columnCounts={columnCountsById[column.id]}
                        filters={masterFilters}
                        onTextChange={handleMasterTextChange}
                        onMultiChange={handleMasterMultiChange}
                        onNumericChange={handleMasterNumericChange}
                      />
                    ) : (
                      column.label
                    )}
                  </ResizableHeader>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  Loading submissions...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-red-600 dark:text-red-400">
                  Failed to load submissions.
                </td>
              </tr>
            ) : virtualRows.enabled ? (
              <>
                {virtualRows.virtualItems.length > 0 ? (
                  <tr style={{ height: virtualRows.virtualItems[0].start }} />
                ) : null}
                {virtualRows.virtualItems.map((virtualItem) => {
                  const submission = submissions[virtualItem.index];
                  if (!submission) return null;
                  const isSelected = selectedEmployeeIds.has(
                    submission.employeeId,
                  );
                  return (
                    <tr
                      key={`${submission.employeeId}-${submission.id}`}
                      data-index={virtualItem.index}
                      className={cn(
                        "group transition-colors",
                        !submission.assessmentEligibility
                          ? "bg-rose-200/70 dark:bg-rose-900/40"
                          : isSelected
                            ? "bg-amber-50/60 dark:bg-amber-500/5"
                            : getHrApprovalStatus(submission) === "approved"
                              ? "bg-emerald-100/70 dark:bg-emerald-900/20"
                              : getHrApprovalStatus(submission) === "review_required"
                                ? "bg-orange-100/70 dark:bg-orange-900/20"
                                : "hover:bg-slate-50/50 dark:hover:bg-white/[0.02]",
                        !submission.assessmentEligibility && isSelected &&
                          "bg-rose-300/70 dark:bg-rose-800/40",
                        !submission.assessmentEligibility &&
                          "hover:bg-rose-300/60 dark:hover:bg-rose-800/30",
                      )}
                    >
                      {isHrRole ? (
                        <td
                          className={stickySelectCellClassName(isSelected, getHrApprovalStatus(submission))}
                          style={{
                            width: SELECT_COLUMN_WIDTH,
                            minWidth: SELECT_COLUMN_WIDTH,
                            maxWidth: SELECT_COLUMN_WIDTH,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              toggleEmployeeSelection(submission.employeeId)
                            }
                            aria-label={`Select ${submission.employeeName}`}
                            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 dark:border-white/20 dark:bg-slate-950"
                          />
                        </td>
                      ) : null}
                      {visibleColumns.map((column) => {
                        const value = column.getValue(submission);
                        const savedWidth = getColumnWidth(column.id, column.width);
                        const isFrozen = frozenSet.has(column.id);
                        const pending = pendingScoreChanges[submission.id];
                        const cellCtx: RenderCellContext = {
                          isHrRole: isHrRole,
                          pendingChanges: pending ?? {},
                          hasPending: pending != null && Object.keys(pending).length > 0,
                          onBufferedChange: handleBufferedChange(submission.id),
                          onSave: () => hrSaveMutation.mutate(submission.id),
                          onCancel: handleCancelScoreChanges(submission.id),
                          onApprove: () =>
                            setHrApprovalModal({
                              open: true,
                              action: "approve",
                              submissionId: submission.id,
                            }),
                          onReviewRequired: () =>
                            setHrApprovalModal({
                              open: true,
                              action: "review_required",
                              submissionId: submission.id,
                            }),
                          onReturn: () =>
                            setReturnModal({
                              open: true,
                              submissionId: submission.id,
                              error: null,
                            }),
                          onBoardApprove: () =>
                            setHrApprovalModal({
                              open: true,
                              action: "board_approve",
                              submissionId: submission.id,
                            }),
                          isSaving: hrSaveMutation.isPending,
                          isApproving: hrApproveMutation.isPending,
                          isReviewing: hrReviewRequiredMutation.isPending,
                          isReturning: returnSubmissionMutation.isPending,
                          isBoardApproving: boardApproveMutation.isPending,
                          canApprove:
                            submission.status === "PENDING_HR_CALIBRATION",
                          canBoardApprove:
                            submission.status === "PENDING_BOARD_APPROVAL",
                          hasValidScore: hasValidNormalizedScore(submission),
                          quartileBands,
                          sortedMatrix,
                          onToggleAssessmentEligibility: (submission: FormSubmissionListItem) =>
                            setEligibilityModalState({ open: true, submission, error: null }),
                          isTogglingEligibility: eligibilityToggleMutation.isPending,
                          editableModules,
                        };
                        return (
                          <td
                            key={column.id}
                            className={cn(
                              columnCellClassName(
                                column,
                                "align-middle border-b border-slate-100 dark:border-white/[0.03]",
                              ),
                              isFrozen && "sticky",
                              isFrozen && (
                                !submission.assessmentEligibility
                                  ? "bg-rose-200 dark:bg-rose-900"
                                  : isSelected
                                    ? "bg-amber-50 dark:bg-amber-950"
                                    : getHrApprovalStatus(submission) === "approved"
                                      ? "bg-emerald-100 dark:bg-emerald-950"
                                      : getHrApprovalStatus(submission) === "review_required"
                                        ? "bg-orange-100 dark:bg-orange-950"
                                        : "bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-800"
                              ),
                              column.id === lastFrozenColumnId && "border-r-2 border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)] dark:border-white/20",
                            )}
                            style={{
                              ...(savedWidth != null ? { width: savedWidth, minWidth: savedWidth, maxWidth: savedWidth } : {}),
                              ...(isFrozen ? { left: stickyOffsets[column.id], zIndex: 20 } : {}),
                            }}
                          >
                            {renderCell(column, submission, value, cellCtx)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {virtualRows.virtualItems.length > 0 ? (
                  <tr
                    style={{
                      height:
                        virtualRows.totalSize -
                        (virtualRows.virtualItems[virtualRows.virtualItems.length - 1]?.start ?? 0) -
                        (virtualRows.virtualItems[virtualRows.virtualItems.length - 1]?.size ?? 0),
                    }}
                  />
                ) : null}
              </>
            ) : (
              <AnimatePresence>
                {submissions.map((submission, index) => {
                  const isSelected = selectedEmployeeIds.has(
                    submission.employeeId,
                  );
                  return (
                    <motion.tr
                      key={`${submission.employeeId}-${submission.id}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{
                        duration: 0.35,
                        delay: Math.min(index, 10) * 0.02,
                        ease: [0.23, 1, 0.32, 1],
                      }}
                      className={cn(
                        "group transition-colors",
                        !submission.assessmentEligibility
                          ? "bg-rose-200/70 dark:bg-rose-900/40"
                          : isSelected
                            ? "bg-amber-50/60 dark:bg-amber-500/5"
                            : getHrApprovalStatus(submission) === "approved"
                              ? "bg-emerald-100/70 dark:bg-emerald-900/20"
                              : getHrApprovalStatus(submission) === "review_required"
                                ? "bg-orange-100/70 dark:bg-orange-900/20"
                                : "hover:bg-slate-50/50 dark:hover:bg-white/[0.02]",
                        !submission.assessmentEligibility && isSelected &&
                          "bg-rose-300/70 dark:bg-rose-800/40",
                        !submission.assessmentEligibility &&
                          "hover:bg-rose-300/60 dark:hover:bg-rose-800/30",
                      )}
                    >
                      {isHrRole ? (
                        <td
                          className={stickySelectCellClassName(isSelected, getHrApprovalStatus(submission))}
                          style={{
                            width: SELECT_COLUMN_WIDTH,
                            minWidth: SELECT_COLUMN_WIDTH,
                            maxWidth: SELECT_COLUMN_WIDTH,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              toggleEmployeeSelection(submission.employeeId)
                            }
                            aria-label={`Select ${submission.employeeName}`}
                            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 dark:border-white/20 dark:bg-slate-950"
                          />
                        </td>
                      ) : null}
                      {visibleColumns.map((column) => {
                        const value = column.getValue(submission);
                        const savedWidth = getColumnWidth(column.id, column.width);
                        const isFrozen = frozenSet.has(column.id);
                        const pending = pendingScoreChanges[submission.id];
                        const cellCtx: RenderCellContext = {
                          isHrRole: isHrRole,
                          pendingChanges: pending ?? {},
                          hasPending: pending != null && Object.keys(pending).length > 0,
                          onBufferedChange: handleBufferedChange(submission.id),
                          onSave: () => hrSaveMutation.mutate(submission.id),
                          onCancel: handleCancelScoreChanges(submission.id),
                          onApprove: () =>
                            setHrApprovalModal({
                              open: true,
                              action: "approve",
                              submissionId: submission.id,
                            }),
                          onReviewRequired: () =>
                            setHrApprovalModal({
                              open: true,
                              action: "review_required",
                              submissionId: submission.id,
                            }),
                          onReturn: () =>
                            setReturnModal({
                              open: true,
                              submissionId: submission.id,
                              error: null,
                            }),
                          onBoardApprove: () =>
                            setHrApprovalModal({
                              open: true,
                              action: "board_approve",
                              submissionId: submission.id,
                            }),
                          isSaving: hrSaveMutation.isPending,
                          isApproving: hrApproveMutation.isPending,
                          isReviewing: hrReviewRequiredMutation.isPending,
                          isReturning: returnSubmissionMutation.isPending,
                          isBoardApproving: boardApproveMutation.isPending,
                          canApprove:
                            submission.status === "PENDING_HR_CALIBRATION",
                          canBoardApprove:
                            submission.status === "PENDING_BOARD_APPROVAL",
                          hasValidScore: hasValidNormalizedScore(submission),
                          quartileBands,
                          sortedMatrix,
                          onToggleAssessmentEligibility: (submission: FormSubmissionListItem) =>
                            setEligibilityModalState({ open: true, submission, error: null }),
                          isTogglingEligibility: eligibilityToggleMutation.isPending,
                          editableModules,
                        };
                        return (
                          <td
                            key={column.id}
                            className={cn(
                              columnCellClassName(
                                column,
                                "align-middle border-b border-slate-100 dark:border-white/[0.03]",
                              ),
                              isFrozen && "sticky",
                              isFrozen && (
                                !submission.assessmentEligibility
                                  ? "bg-rose-200 dark:bg-rose-900"
                                  : isSelected
                                    ? "bg-amber-50 dark:bg-amber-950"
                                    : getHrApprovalStatus(submission) === "approved"
                                      ? "bg-emerald-100 dark:bg-emerald-950"
                                      : getHrApprovalStatus(submission) === "review_required"
                                        ? "bg-orange-100 dark:bg-orange-950"
                                        : "bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-800"
                              ),
                              column.id === lastFrozenColumnId && "border-r-2 border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)] dark:border-white/20",
                            )}
                            style={{
                              ...(savedWidth != null ? { width: savedWidth, minWidth: savedWidth, maxWidth: savedWidth } : {}),
                              ...(isFrozen ? { left: stickyOffsets[column.id], zIndex: 20 } : {}),
                            }}
                          >
                            {renderCell(column, submission, value, cellCtx)}
                          </td>
                        );
                      })}
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && !error && totalCount === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <Search className="h-10 w-10 text-slate-300 dark:text-slate-700" />
          <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-500">
            No records match your filters
          </p>
          <button
            onClick={handleClearAllFilters}
            className="mt-2 text-xs text-amber-600 hover:underline dark:text-amber-400"
          >
            Clear all filters
          </button>
        </motion.div>
      ) : null}

      {showPagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-white/5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {rangeStart}–{rangeEnd} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.04]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <span className="min-w-20 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.04]"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {isHrRole ? (
        <BulkEditStaffModal
          open={bulkEditOpen}
          selectedEmployeeIds={[...selectedEmployeeIds]}
          onClose={() => setBulkEditOpen(false)}
          onSuccess={() => setSelectedEmployeeIds(new Set())}
          role={role}
        />
      ) : null}

      {isHrRole && eligibilityModalState.submission ? (
        <EligibilityConfirmationModal
          open={eligibilityModalState.open}
          employeeName={eligibilityModalState.submission.employeeName}
          currentEligibility={eligibilityModalState.submission.assessmentEligibility}
          submission={eligibilityModalState.submission}
          isPending={eligibilityToggleMutation.isPending}
          error={eligibilityModalState.error}
          onClose={() =>
            setEligibilityModalState({ open: false, submission: null, error: null })
          }
          onConfirm={(reason) => {
            const sub = eligibilityModalState.submission;
            if (!sub) return;
            eligibilityToggleMutation.mutate(
              {
                employeeId: sub.employeeId,
                current: sub.assessmentEligibility,
                reason: sub.assessmentEligibility ? reason : undefined,
              },
              {
                onSuccess: () => {
                  setEligibilityModalState({ open: false, submission: null, error: null });
                },
                onError: (error) => {
                  setEligibilityModalState((prev) => ({
                    ...prev,
                    error:
                      error instanceof Error
                        ? error.message
                        : "Failed to update eligibility.",
                  }));
                },
              },
            );
          }}
        />
      ) : null}

      <HrApprovalConfirmModal
        open={hrApprovalModal.open}
        action={hrApprovalModal.action}
        isPending={
          hrApprovalModal.action === "approve"
            ? hrApproveMutation.isPending
            : hrApprovalModal.action === "board_approve"
              ? boardApproveMutation.isPending
              : hrReviewRequiredMutation.isPending
        }
        onClose={() =>
          setHrApprovalModal({ open: false, action: "approve", submissionId: 0 })
        }
        onConfirm={() => {
          const { action, submissionId } = hrApprovalModal;
          if (action === "approve") {
            hrApproveMutation.mutate(submissionId);
          } else if (action === "board_approve") {
            boardApproveMutation.mutate(submissionId);
          } else {
            hrReviewRequiredMutation.mutate(submissionId);
          }
        }}
      />

      {isHrRole && returnModal.submissionId > 0 ? (
        <ReturnSubmissionModal
          open={returnModal.open}
          submissionKey={returnModal.submissionId}
          employeeName={
            submissions.find((s) => s.id === returnModal.submissionId)
              ?.employeeName ?? ""
          }
          targets={(() => {
            const sub = submissions.find(
              (s) => s.id === returnModal.submissionId,
            );
            if (!sub) return [] as ReturnSubmissionTarget[];
            const isDirect = !sub.selfAssessmentEnabled;
            const targets: ReturnSubmissionTarget[] = [
              {
                level: "manager2",
                label: "Manager 2",
                userName: sub.manager2Name,
                available: sub.manager2UserId != null,
              },
              {
                level: "manager1",
                label: "Manager 1",
                userName: sub.manager1Name,
                available: sub.manager1UserId != null,
              },
            ];
            if (!isDirect) {
              targets.push({
                level: "employee",
                label: "Employee",
                userName: sub.employeeName,
                available: true,
              });
            }
            return targets;
          })()}
          isPending={returnSubmissionMutation.isPending}
          error={returnModal.error}
          onClose={() =>
            setReturnModal({ open: false, submissionId: 0, error: null })
          }
          onConfirm={(returnLevel, reason) => {
            const submissionId = returnModal.submissionId;
            returnSubmissionMutation.mutate(
              { submissionId, returnLevel, reason },
              {
                onSuccess: () => {
                  setReturnModal({ open: false, submissionId: 0, error: null });
                },
                onError: (error) => {
                  setReturnModal((prev) => ({
                    ...prev,
                    error:
                      error instanceof Error
                        ? error.message
                        : "Failed to return submission.",
                  }));
                },
              },
            );
          }}
        />
      ) : null}
    </motion.div>
  );
}
