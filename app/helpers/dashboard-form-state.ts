import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPen,
  Gavel,
  Scale,
  User,
  Users,
} from "lucide-react";
import type { ElementType } from "react";
import type { FormState } from "@/app/helpers/dashboard-types";
import type { AppraisalStatus } from "@/types/forms";

type StatusStyle = {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: ElementType;
};

const HEAD_REVIEW_STYLE = {
  color: "text-amber-700",
  bg: "bg-amber-50",
  border: "border-amber-200",
  icon: AlertTriangle,
} as const;

export const FORM_STATE_CONFIG: Record<
  FormState,
  StatusStyle & { phase: number }
> = {
  PENDING_SELF_ASSESSMENT: {
    label: "Self Assessment",
    color: "text-slate-700",
    bg: "bg-slate-100",
    border: "border-slate-200",
    icon: User,
    phase: 0,
  },
  PENDING_DIRECT_ASSESSMENT: {
    label: "Direct Assessment",
    color: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-50 dark:bg-sky-900/30",
    border: "border-sky-200 dark:border-sky-700/50",
    icon: ClipboardPen,
    phase: 1,
  },
  PENDING_MANAGER_1_REVIEW: {
    label: "Manager 1 Review",
    ...HEAD_REVIEW_STYLE,
    phase: 1,
  },
  PENDING_MANAGER_2_REVIEW: {
    label: "Manager 2 Review",
    color: "text-yellow-800",
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    icon: Users,
    phase: 2,
  },
  PENDING_HR_CALIBRATION: {
    label: "HR Alignment",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: Scale,
    phase: 3,
  },
  PENDING_BOARD_APPROVAL: {
    label: "Board Approval",
    color: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-200",
    icon: Gavel,
    phase: 4,
  },
  APPROVED: {
    label: "Approved",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: CheckCircle2,
    phase: 5,
  },
};

export const FORM_STATE_IDS = Object.keys(FORM_STATE_CONFIG) as FormState[];

/** Pre-split session/URL value: treated as both Manager 1 and Manager 2. */
export const LEGACY_HEAD_REVIEW_FORM_STATE = "PENDING_HEAD_REVIEW";

export const APPRAISAL_STATE_CONFIG: Record<AppraisalStatus, StatusStyle> = {
  PENDING_SELF_ASSESSMENT: FORM_STATE_CONFIG.PENDING_SELF_ASSESSMENT,
  PENDING_HEAD_REVIEW: {
    label: "Manager Review",
    ...HEAD_REVIEW_STYLE,
  },
  PENDING_HR_CALIBRATION: FORM_STATE_CONFIG.PENDING_HR_CALIBRATION,
  PENDING_BOARD_APPROVAL: FORM_STATE_CONFIG.PENDING_BOARD_APPROVAL,
  APPROVED: FORM_STATE_CONFIG.APPROVED,
  COMPLETED: {
    label: "Completed",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: CheckCircle2,
  },
};

type StatusRow = {
  status: AppraisalStatus;
  managerLevel?: number | null;
  directScoreEntry?: boolean;
  selfAssessmentEnabled?: boolean;
};

export function isPendingDirectAssessment(row: StatusRow): boolean {
  return (
    row.selfAssessmentEnabled === false &&
    row.status === "PENDING_HEAD_REVIEW" &&
    !row.directScoreEntry
  );
}

export function isPendingManager1Review(row: StatusRow): boolean {
  return (
    row.status === "PENDING_HEAD_REVIEW" &&
    (row.managerLevel ?? 1) < 2 &&
    !isPendingDirectAssessment(row)
  );
}

export function isPendingManager2Review(row: StatusRow): boolean {
  return (
    row.status === "PENDING_HEAD_REVIEW" &&
    (row.managerLevel ?? 1) >= 2 &&
    !isPendingDirectAssessment(row)
  );
}

export function getPendingManagerReviewConfig(managerLevel: number | null | undefined) {
  return (managerLevel ?? 1) >= 2
    ? FORM_STATE_CONFIG.PENDING_MANAGER_2_REVIEW
    : FORM_STATE_CONFIG.PENDING_MANAGER_1_REVIEW;
}

export function getSubmissionStatusConfig(row: StatusRow): StatusStyle {
  if (row.directScoreEntry) {
    return {
      label: "Direct Score Entry",
      color: "text-violet-700 dark:text-violet-300",
      bg: "bg-violet-50 dark:bg-violet-900/30",
      border: "border-violet-200 dark:border-violet-700/50",
      icon: CheckCircle2,
    };
  }

  if (isPendingDirectAssessment(row)) {
    return FORM_STATE_CONFIG.PENDING_DIRECT_ASSESSMENT;
  }

  if (row.status === "PENDING_HEAD_REVIEW") {
    return getPendingManagerReviewConfig(row.managerLevel);
  }

  return APPRAISAL_STATE_CONFIG[row.status];
}

export function getSubmissionStatusLabel(row: StatusRow): string {
  return getSubmissionStatusConfig(row).label;
}

export function matchesFormStateOption(row: StatusRow, state: string): boolean {
  if (state === "PENDING_DIRECT_ASSESSMENT") {
    return isPendingDirectAssessment(row);
  }
  if (state === "PENDING_MANAGER_1_REVIEW") {
    return isPendingManager1Review(row);
  }
  if (state === "PENDING_MANAGER_2_REVIEW") {
    return isPendingManager2Review(row);
  }
  if (state === LEGACY_HEAD_REVIEW_FORM_STATE) {
    return row.status === "PENDING_HEAD_REVIEW";
  }
  return row.status === state;
}

export function normalizeSelectedFormStates(
  states: readonly string[] | null,
): FormState[] | null {
  if (states === null) {
    return null;
  }

  const next: FormState[] = [];
  const seen = new Set<FormState>();
  const add = (state: FormState) => {
    if (!seen.has(state)) {
      seen.add(state);
      next.push(state);
    }
  };

  for (const state of states) {
    if (state === LEGACY_HEAD_REVIEW_FORM_STATE) {
      add("PENDING_DIRECT_ASSESSMENT");
      add("PENDING_MANAGER_1_REVIEW");
      add("PENDING_MANAGER_2_REVIEW");
      continue;
    }
    if (state in FORM_STATE_CONFIG) {
      add(state as FormState);
    }
  }

  return next;
}
