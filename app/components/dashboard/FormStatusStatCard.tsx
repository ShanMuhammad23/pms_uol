"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { motion } from "framer-motion";
import { itemVariants } from "@/app/helpers/dashboard-animations";
import { APPRAISAL_STATE_CONFIG } from "@/app/helpers/dashboard-form-state";
import { fetchAssignedForms } from "@/lib/queries/employee-forms-client";
import type { AppraisalStatus } from "@/types/forms";
import { APPRAISAL_STATUS_LABELS } from "@/types/forms";
import { cn } from "@/lib/utils";

interface FormStatusStatCardProps {
  delay: number;
}

const STATUS_DOT: Record<AppraisalStatus, string> = {
  PENDING_SELF_ASSESSMENT: "#94a3b8",
  PENDING_HEAD_REVIEW: "#d97706",
  PENDING_HR_CALIBRATION: "#ea580c",
  PENDING_BOARD_APPROVAL: "#7c3aed",
  APPROVED: "#059669",
  COMPLETED: "#059669",
};

function statusLabel(status: AppraisalStatus): string {
  return (
    APPRAISAL_STATE_CONFIG[status]?.label ??
    APPRAISAL_STATUS_LABELS[status] ??
    status
  );
}

export function FormStatusStatCard({ delay }: FormStatusStatCardProps) {
  const { data: forms = [], isLoading, error } = useQuery({
    queryKey: ["my-forms"],
    queryFn: fetchAssignedForms,
  });

  const total = forms.length;
  const awaitingAction = forms.filter(
    (form) => form.status === "PENDING_SELF_ASSESSMENT" && !form.submittedAt,
  ).length;

  return (
    <motion.div
      variants={itemVariants}
      transition={{ delay }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="@container/stat group relative min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-[#FFE5B4] p-2.5 text-white shadow-sm transition-all duration-300 hover:shadow-md @[12rem]/stat:p-3 @[16rem]/stat:p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-1.5 @[14rem]/stat:gap-2">
        <p className="min-w-0 text-black font-semibold uppercase leading-tight tracking-wide">
          My Forms
        </p>
        <span
          className="shrink-0 rounded-md bg-sky-50 px-1.5 py-0.5 text-[clamp(0.625rem,3.8cqi,0.75rem)] font-semibold tabular-nums text-sky-700 dark:bg-sky-950/50 dark:text-sky-400"
          title="Forms assigned to you"
        >
          {isLoading ? "…" : total}
        </span>
      </div>

      {isLoading ? (
        <p className="mt-3 text-[clamp(0.625rem,3.8cqi,0.75rem)] text-black">
          Loading assigned forms…
        </p>
      ) : error ? (
        <p className="mt-3 text-[clamp(0.625rem,3.8cqi,0.75rem)] text-black">
          Failed to load your forms
        </p>
      ) : total === 0 ? (
        <div className="mt-3 flex items-start gap-2 text-[clamp(0.625rem,3.8cqi,0.75rem)] text-black">
          <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="text-black">No forms assigned to you</span>
        </div>
      ) : (
        <div className="mt-2 space-y-2 @[16rem]/stat:mt-3">
          {awaitingAction > 0 ? (
            <p className="text-[16px] text-[#800000]">
              {awaitingAction} Submission Pending
            </p>
          ) : null}

          <ul className="max-h-28 space-y-1.5 overflow-y-auto pr-0.5">
            {forms.map((form) => (
              <li key={form.templateId}>
                <Link
                  href={`/dashboard/my-forms/${form.templateId}`}
                  className={cn(
                    "flex items-start justify-between gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[clamp(0.625rem,3.8cqi,0.75rem)] font-medium text-black">
                      {form.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[clamp(0.5625rem,3.2cqi,0.675rem)] text-black">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: STATUS_DOT[form.status] }}
                      />
                      <span className="truncate">{statusLabel(form.status)}</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
