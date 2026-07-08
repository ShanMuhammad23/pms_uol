import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Scale,
  User,
  XCircle,
} from "lucide-react";
import type { ElementType } from "react";
import type { FormState } from "@/app/helpers/dashboard-types";
import type { AppraisalStatus } from "@/types/forms";

export const FORM_STATE_CONFIG: Record<
  FormState,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    icon: ElementType;
    phase: number;
  }
> = {
  DRAFT: {
    label: "Draft",
    color: "text-slate-600",
    bg: "bg-slate-100",
    border: "border-slate-200",
    icon: Clock,
    phase: 0,
  },
  PENDING_SELF_ASSESSMENT: {
    label: "Self Assessment",
    color: "text-slate-700",
    bg: "bg-slate-100",
    border: "border-slate-200",
    icon: User,
    phase: 1,
  },
  PENDING_HEAD_REVIEW: {
    label: "Manager Review",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: AlertTriangle,
    phase: 2,
  },
  PENDING_HR_CALIBRATION: {
    label: "HR Calibration",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: Scale,
    phase: 3,
  },
  PENDING_BOARD_APPROVAL: {
    label: "Board Approval",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: Award,
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
  REJECTED: {
    label: "Rejected",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: XCircle,
    phase: 6,
  },
  ARCHIVED: {
    label: "Archived",
    color: "text-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-200",
    icon: Clock,
    phase: 7,
  },
};

export const APPRAISAL_STATE_CONFIG: Record<
  AppraisalStatus,
  { label: string; color: string; bg: string; border: string; icon: ElementType }
> = {
  PENDING_SELF_ASSESSMENT: FORM_STATE_CONFIG.PENDING_SELF_ASSESSMENT,
  PENDING_HEAD_REVIEW: FORM_STATE_CONFIG.PENDING_HEAD_REVIEW,
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
