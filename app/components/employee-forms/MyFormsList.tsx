"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  Briefcase,
  Building2,
  Check,
  ClipboardList,
  Eye,
  GraduationCap,
  Hash,
  Inbox,
  Layers,
  Network,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSubmissionStatusConfig } from "@/app/helpers/dashboard-form-state";
import IneligibilityBanner from "@/app/components/forms/EligibilityStatusBanner";
import { SlowRequestBanner } from "@/app/components/employee-forms/SlowRequestBanner";
import { fetchAssignedForms } from "@/lib/queries/employee-forms-client";
import type { AppraisalStatus } from "@/types/forms";
import { USER_ROLE_LABELS } from "@/types/users";
import { cn } from "@/lib/utils";

/** Show slow-load banner if My Forms API has not settled by this time. */
const SLOW_LOAD_MS = 5_000;

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

const WORKFLOW_STEPS = [
  { id: 1, label: "Self", fullLabel: "Self Assessment" },
  { id: 2, label: "Manager", fullLabel: "Manager Review" },
  { id: 3, label: "HR", fullLabel: "HR Alignment" },
  { id: 4, label: "Board", fullLabel: "Board Approval" },
  { id: 5, label: "Done", fullLabel: "Approved" },
] as const;

const easeOut = [0.23, 1, 0.32, 1] as const;

type WorkflowStepState = "complete" | "current" | "upcoming";

function getWorkflowStepState(
  stepId: number,
  phase: number,
  status: AppraisalStatus,
): WorkflowStepState {
  const allComplete = status === "APPROVED" || status === "COMPLETED";
  if (allComplete || stepId < phase) return "complete";
  if (stepId === phase) return "current";
  return "upcoming";
}

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
  const reduceMotion = useReducedMotion();
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["my-forms"],
    queryFn: fetchAssignedForms,
  });

  const [slowLoad, setSlowLoad] = useState(false);
  const [slowBannerDismissed, setSlowBannerDismissed] = useState(false);

  const waitingOnForms = isLoading || isFetching;

  if (!waitingOnForms) {
    if (slowLoad) {
      setSlowLoad(false);
    }
    if (slowBannerDismissed) {
      setSlowBannerDismissed(false);
    }
  }

  useEffect(() => {
    if (!waitingOnForms) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSlowLoad(true);
    }, SLOW_LOAD_MS);

    return () => window.clearTimeout(timer);
  }, [waitingOnForms]);

  const showSlowBanner = slowLoad && !slowBannerDismissed && waitingOnForms;

  const handleHoldOn = () => {
    setSlowBannerDismissed(true);
  };

  const handleRefreshPage = () => {
    window.location.reload();
  };

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

  const blockedEligibility =
    data?.find((form) => form.eligibilityStatus === "Ineligible") ??
    data?.find((form) => form.eligibilityStatus === "Not Eligible");
  const showEligibilityBanner = blockedEligibility != null;

  const pageShellClass =
    "relative isolate min-w-0 space-y-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 via-[#eef2f8] to-[#f7efe9]  dark:from-slate-950 dark:via-slate-900 dark:to-[#1a1512]";



  if (isLoading) {
    return (
      <div className={pageShellClass}>
        <div className="rounded-2xl border border-primary/10 bg-surface/90 p-6 shadow-[0_8px_30px_rgb(15,44,89,0.06)] backdrop-blur-sm dark:border-white/10 dark:bg-surface/80">
          <div className="flex items-center gap-4">
            <div className="size-14 animate-pulse rounded-2xl bg-primary/15 dark:bg-primary/25" />
            <div className="space-y-2">
              <div className="h-5 w-48 animate-pulse rounded bg-primary/10 dark:bg-white/10" />
              <div className="h-3 w-64 animate-pulse rounded bg-primary/10 dark:bg-white/10" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-primary/8 pt-5 sm:grid-cols-3 lg:grid-cols-6 dark:border-white/6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2 rounded-xl bg-primary/[0.03] p-3 dark:bg-white/[0.03]">
                <div className="h-3 w-16 animate-pulse rounded bg-primary/10 dark:bg-white/10" />
                <div className="h-4 w-24 animate-pulse rounded bg-primary/10 dark:bg-white/10" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl border border-primary/10 bg-surface/80 dark:border-white/10"
            />
          ))}
        </div>
        <SlowRequestBanner
          open={showSlowBanner}
          onHoldOn={handleHoldOn}
          onRefresh={handleRefreshPage}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={pageShellClass}>
        
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <p className="font-medium">Failed to load assigned forms.</p>
          <p className="mt-1 text-red-600/90 dark:text-red-300/80">
            The server may be busy. Wait a moment and try again, or refresh the
            page.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void refetch();
              }}
              className="inline-flex cursor-pointer items-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={handleRefreshPage}
              className="inline-flex cursor-pointer items-center rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
            >
              Refresh page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={pageShellClass}>
      <div
        className="pointer-events-none absolute -left-24 top-40 h-64 w-64 rounded-full bg-primary/[0.07] blur-3xl dark:bg-primary/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-10 h-56 w-56 rounded-full bg-secondary/[0.12] blur-3xl dark:bg-secondary/10"
        aria-hidden="true"
      />

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

      <SlowRequestBanner
        open={showSlowBanner}
        onHoldOn={handleHoldOn}
        onRefresh={handleRefreshPage}
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut }}
      >
        
      </motion.div>

      {/* Welcome + profile */}
      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: reduceMotion ? 0 : 0.06, ease: easeOut }}
        className="relative overflow-hidden rounded-2xl border border-primary/10 bg-surface/95 shadow-[0_8px_30px_rgb(15,44,89,0.06)] backdrop-blur-sm dark:border-white/10 dark:bg-surface/90 dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]"
      >
        <div
          className="h-1 w-full bg-gradient-to-r from-primary via-secondary to-amber-400"
          aria-hidden="true"
        />
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#1a3f73] text-lg font-bold text-white shadow-[0_8px_20px_-6px_rgba(15,44,89,0.55)] ring-2 ring-primary/20 ring-offset-2 ring-offset-surface dark:from-primary dark:to-primary/70 dark:ring-offset-surface">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
                Welcome, {userName ?? "User"}
              </h2>
              <p className="mt-0.5 truncate text-sm text-foreground/60">
                {subtitleParts.length > 0 ? subtitleParts.join(" · ") : "—"}
              </p>
            </div>
          </div>

          {infoFields.length > 0 ? (
            <div className="mt-5 grid grid-cols-1 gap-3 border-t border-primary/8 pt-5 sm:grid-cols-2 lg:grid-cols-3 dark:border-white/8">
              {infoFields.map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="min-w-0 rounded-xl border border-primary/[0.06] bg-gradient-to-br from-primary/[0.04] to-transparent px-3.5 py-3 dark:border-white/8 dark:from-white/[0.04]"
                >
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary/70 dark:text-primary/80">
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    {label}
                  </p>
                  <p
                    className="mt-1.5 truncate text-sm font-semibold text-text-primary"
                    title={value}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </motion.section>

      {/* Assigned Forms */}
      <section className="relative space-y-4 p-4 sm:p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text-primary sm:text-xl">
              Assigned Forms
            </h2>
            {data && data.length > 0 ? (
              <p className="mt-0.5 text-sm text-foreground/55">
                {data.length} form{data.length > 1 ? "s" : ""} ready for this
                cycle
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-foreground/55">
                Your appraisal assignments appear here
              </p>
            )}
          </div>
        </div>

        {!data || data.length === 0 ? (
          <div className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-primary/25 bg-surface/80 px-6 py-16 text-center shadow-[0_8px_30px_rgb(15,44,89,0.04)] dark:border-white/15 dark:bg-surface/70">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary/20">
              <Inbox className="size-8 text-primary dark:text-primary" aria-hidden="true" />
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.map((form, index) => {
              const statusConfig = getSubmissionStatusConfig(form);
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
                <motion.div
                  key={form.templateId}
                  initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.35,
                    delay: reduceMotion ? 0 : 0.08 + index * 0.05,
                    ease: easeOut,
                  }}
                  className={cn(
                    "group flex flex-col rounded-2xl border border-primary/10 border-l-4 bg-surface/95 p-5 shadow-[0_6px_24px_-8px_rgba(15,44,89,0.12)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-12px_rgba(15,44,89,0.22)] dark:border-white/10 dark:bg-surface/90 dark:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.4)]",
                    STATUS_ACCENT[form.status],
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className=" font-semibold text-text-primary">
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
                      <StatusIcon className="size-3" aria-hidden="true" />
                      {statusConfig.label}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-foreground/60">
                    <span className="inline-flex items-center gap-1">
                      <ClipboardList className="size-3.5" aria-hidden="true" />
                      {form.questionCount} questions
                    </span>
                  </div>

                  <div className="mt-4">
                    <p className="mb-3 text-xs font-medium text-foreground/50">
                      Workflow Progress
                    </p>
                    <ol
                      className="flex w-full items-start"
                      aria-label="Appraisal workflow progress"
                    >
                      {WORKFLOW_STEPS.map((step, stepIndex) => {
                        const state = getWorkflowStepState(
                          step.id,
                          phase,
                          form.status,
                        );
                        const isLast = stepIndex === WORKFLOW_STEPS.length - 1;

                        return (
                          <li
                            key={step.id}
                            className={cn(
                              "relative flex flex-1 flex-col items-center",
                              !isLast &&
                                "after:absolute after:top-3.5 after:left-[calc(50%+14px)] after:right-0 after:h-0.5 after:content-['']",
                              !isLast &&
                                (state === "complete"
                                  ? "after:bg-primary dark:after:bg-primary"
                                  : "after:bg-primary/15 dark:after:bg-white/15"),
                            )}
                          >
                            <span
                              className={cn(
                                "relative z-10 flex size-7 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors",
                                state === "complete" &&
                                  "border-primary bg-primary text-white",
                                state === "current" &&
                                  "border-secondary bg-secondary/15 text-secondary ring-2 ring-secondary/25",
                                state === "upcoming" &&
                                  "border-primary/20 bg-surface text-foreground/40 dark:border-white/20",
                              )}
                              title={step.fullLabel}
                              aria-current={
                                state === "current" ? "step" : undefined
                              }
                            >
                              {state === "complete" ? (
                                <Check
                                  className="size-3.5"
                                  strokeWidth={3}
                                  aria-hidden="true"
                                />
                              ) : (
                                step.id
                              )}
                            </span>
                            <span
                              className={cn(
                                "mt-1.5 max-w-full truncate px-0.5 text-center text-[10px] font-semibold leading-tight",
                                state === "complete" && "text-primary",
                                state === "current" && "text-secondary",
                                state === "upcoming" && "text-foreground/40",
                              )}
                              title={step.fullLabel}
                            >
                              {step.label}
                            </span>
                            <span className="sr-only">
                              {step.fullLabel}
                              {state === "complete"
                                ? ", completed"
                                : state === "current"
                                  ? ", current step"
                                  : ", upcoming"}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-primary/8 pt-4 dark:border-white/[0.06]">
                    <span className="text-xs text-foreground/50">
                      {relativeDate ? `Updated ${relativeDate}` : "Not started"}
                    </span>
                    <Link
                      href={`/dashboard/my-forms/${form.templateId}`}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                        canFill
                          ? "bg-primary text-white hover:bg-primary/90"
                          : "border border-primary/20 text-primary hover:bg-primary/10 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10",
                      )}
                    >
                      <Eye className="size-3.5" aria-hidden="true" />
                      {canFill ? "Fill Form" : "View"}
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {data && data.length === 1 ? (
          <p className="text-center text-xs text-foreground/45">
            More forms will appear here as they are assigned to you.
          </p>
        ) : null}
      </section>
    </div>
  );
}
