"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  Eye,
  Hash,
  Inbox,
  Layers,
  Network,
  Send,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { APPRAISAL_STATE_CONFIG } from "@/app/helpers/dashboard-form-state";
import IneligibilityBanner from "@/app/components/forms/EligibilityStatusBanner";
import { fetchAssignedForms } from "@/lib/queries/employee-forms-client";
import type { AppraisalStatus } from "@/types/forms";
import { USER_ROLE_LABELS } from "@/types/users";
import { cn } from "@/lib/utils";

export interface MyFormsUserInfo {
  employeeId: string;
  email: string;
  designation: string | null;
  roleCategory: string | null;
  orgLevel1: string;
  orgLevel2: string;
  systemRole: string;
  empCategory: string;
  headName: string | null;
}

interface MyFormsListProps {
  userName: string | null;
  userRole: string | null;
  userEmail: string | null;
  userInfo?: MyFormsUserInfo | null;
}

function displayValue(value: string | null | undefined): string {
  if (value == null || value === "" || value === "—") return "—";
  return value;
}

const STATUS_ACCENT: Record<AppraisalStatus, string> = {
  PENDING_SELF_ASSESSMENT: "border-l-slate-400 dark:border-l-slate-500",
  PENDING_HEAD_REVIEW: "border-l-amber-400 dark:border-l-amber-500",
  PENDING_HR_CALIBRATION: "border-l-orange-400 dark:border-l-orange-500",
  PENDING_BOARD_APPROVAL: "border-l-violet-400 dark:border-l-violet-500",
  APPROVED: "border-l-emerald-400 dark:border-l-emerald-500",
  COMPLETED: "border-l-emerald-400 dark:border-l-emerald-500",
};

const STATUS_PHASE: Record<AppraisalStatus, number> = {
  PENDING_SELF_ASSESSMENT: 1,
  PENDING_HEAD_REVIEW: 2,
  PENDING_HR_CALIBRATION: 3,
  PENDING_BOARD_APPROVAL: 4,
  APPROVED: 5,
  COMPLETED: 5,
};

const TOTAL_PHASES = 5;

function isFillable(
  status: AppraisalStatus,
  submittedAt: string | null,
  selfAssessmentEnabled: boolean,
  canFillAssessment: boolean,
): boolean {
  return (
    canFillAssessment &&
    selfAssessmentEnabled &&
    status === "PENDING_SELF_ASSESSMENT" &&
    !submittedAt
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatRelativeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MyFormsList({
  userName,
  userRole,
  userEmail,
  userInfo = null,
}: MyFormsListProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-forms"],
    queryFn: fetchAssignedForms,
  });

  const roleLabel = userInfo?.systemRole
    ? userInfo.systemRole
    : userRole
      ? (USER_ROLE_LABELS as Record<string, string>)[userRole] ?? userRole
      : null;
  const initials = userName ? getInitials(userName) : "?";
  const subtitleParts = [
    userInfo?.designation,
    roleLabel,
    userEmail ?? userInfo?.email,
  ].filter(Boolean);

  const infoFields = userInfo
    ? [
        {
          icon: Hash,
          label: "Employee ID",
          value: displayValue(userInfo.employeeId),
        },
        {
          icon: Briefcase,
          label: "Designation",
          value: displayValue(userInfo.designation),
        },
        {
          icon: Building2,
          label: "ORG Level 1",
          value: displayValue(userInfo.orgLevel1),
        },
        {
          icon: Network,
          label: "ORG Level 2",
          value: displayValue(userInfo.orgLevel2),
        },
        {
          icon: Layers,
          label: "Role Category",
          value: displayValue(userInfo.roleCategory),
        },
        {
          icon: UserRound,
          label: "Reporting Head",
          value: displayValue(userInfo.headName),
        },
      ]
    : [];

  const stats = {
    total: data?.length ?? 0,
    submitted:
      data?.filter(
        (f) =>
          (f.status !== "PENDING_SELF_ASSESSMENT" || Boolean(f.submittedAt)) ||
          !f.selfAssessmentEnabled,
      ).length ?? 0,
    managerReview:
      data?.filter((f) => f.status === "PENDING_HEAD_REVIEW").length ?? 0,
    approved:
      data?.filter(
        (f) => f.status === "APPROVED" || f.status === "COMPLETED",
      ).length ?? 0,
  };

  const blockedEligibility =
    data?.find((form) => form.eligibilityStatus === "Ineligible") ??
    data?.find((form) => form.eligibilityStatus === "Not Eligible");
  const showEligibilityBanner = blockedEligibility != null;



  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-surface p-6 shadow-sm dark:border-white/10">
          <div className="flex items-center gap-4">
            <div className="size-14 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-2">
              <div className="h-5 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4 dark:border-white/6">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-10 border-t border-slate-100 pt-6 sm:grid-cols-4 dark:border-white/6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <div className="size-8 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="h-7 w-10 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-md border border-slate-200 bg-surface dark:border-white/10"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Failed to load assigned forms.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showEligibilityBanner ? (
        <IneligibilityBanner
          role="self"
          status={
            blockedEligibility.eligibilityStatus === "Not Eligible"
              ? "Not Eligible"
              : "Ineligible"
          }
          reason={blockedEligibility.ineligibilityReason}
        />
      ) : null}

      {/* Profile Hero + Basic Info + Form Status Stats */}
      <div className="rounded-xl border border-slate-200 bg-surface p-6 shadow-sm dark:border-white/10">
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white shadow-sm">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-text-primary sm:text-2xl">
              Welcome back, {userName ?? "User"}
            </h1>
            <p className="mt-0.5 truncate text-sm text-foreground/60">
              {subtitleParts.length > 0 ? subtitleParts.join(" · ") : "—"}
            </p>
          </div>
        </div>

        {infoFields.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/6">
            {infoFields.map(({ icon: Icon, label, value }) => (
              <div key={label} className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/45">
                  <Icon className="size-3.5 shrink-0" />
                  {label}
                </p>
                <p
                  className="mt-1 truncate text-sm font-medium text-text-primary"
                  title={value}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>
        ) : null}


      {/* Section Title */}
      <div className="flex flex-col mt-10 items-start justify-start">
        <h2 className="text-lg font-semibold text-text-primary">Assigned Forms</h2>
        {data && data.length > 0 ? (
          <span className="text-sm text-foreground/50">
            {data.length} form{data.length > 1 ? "s" : ""}
          </span>
        ) : null}
        {/* Empty State */}
      {!data || data.length === 0 ? (
        <div className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-surface px-6 py-16 text-center dark:border-white/10">
          <div className="flex size-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Inbox className="size-8 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="mt-4 text-base font-semibold text-text-primary">
            No forms assigned yet
          </p>
          <p className="mt-1.5 max-w-sm text-sm text-foreground/60">
            Appraisal forms will appear here once they are assigned to you by
            your administrator. You&apos;ll be able to view and complete them
            from this page.
          </p>
        </div>
      ) : (
        /* Form Cards Grid */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((form) => {
            const statusConfig = APPRAISAL_STATE_CONFIG[form.status];
            const canFill = isFillable(
              form.status,
              form.submittedAt,
              form.selfAssessmentEnabled,
              form.canFillAssessment,
            );
            const phase = STATUS_PHASE[form.status];
            const relativeDate = formatRelativeDate(
              form.updatedAt ?? form.submittedAt,
            );
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={form.templateId}
                className={cn(
                  "group flex flex-col rounded-md border border-slate-200 border-l-4 bg-surface p-5 shadow-sm transition-all hover:shadow-md dark:border-white/10",
                  STATUS_ACCENT[form.status],
                )}
              >
                {/* Title + Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-text-primary">
                      {form.title}
                    </h3>
                    {form.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-foreground/60">
                        {form.description}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
                      statusConfig.bg,
                      statusConfig.color,
                      statusConfig.border,
                    )}
                  >
                    <StatusIcon className="size-3" />
                    {statusConfig.label}
                  </span>
                </div>

                {/* Meta row */}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-foreground/60">
                  <span className="inline-flex items-center gap-1">
                    <ClipboardList className="size-3.5" />
                    {form.questionCount} questions
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground/50">Workflow Progress</span>
                    <span className="font-medium text-foreground/70">
                      {phase}/{TOTAL_PHASES}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${(phase / TOTAL_PHASES) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Footer: date + action */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-white/[0.06]">
                  <span className="text-xs text-foreground/50">
                    {relativeDate ? `Updated ${relativeDate}` : "Not started"}
                  </span>
                  <Link
                    href={`/dashboard/my-forms/${form.templateId}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      canFill
                        ? "bg-primary text-white hover:bg-primary/90"
                        : "border border-slate-300 text-slate-700 hover:bg-primary/10 dark:border-white/15 dark:text-slate-300",
                    )}
                  >
                    <Eye className="size-3.5" />
                    {canFill ? "Fill Form" : "View"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hint when only 1 form exists */}
      {data && data.length === 1 ? (
        <p className="text-center text-xs text-foreground/40">
          More forms will appear here as they are assigned to you.
        </p>
      ) : null}
      </div>

      </div>




    </div>
  );
}

