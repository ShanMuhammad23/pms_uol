"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type EligibilityBannerRole = "self" | "manager" | "admin";

interface EligibilityStatusBannerProps {
  role: EligibilityBannerRole;
  employeeName?: string;
  reason?: string | null;
  className?: string;
}

function buildMessage(
  role: EligibilityBannerRole,
  employeeName: string | undefined,
  reason: string | null,
): string {
  const reasonText = reason ? ` Reason: ${reason}` : "";

  if (role === "self") {
    return `Your assessment is currently unavailable because your eligibility has been temporarily disabled.${reasonText}`;
  }

  if (role === "manager") {
    return `This employee is currently unavailable for assessment because their eligibility has been disabled.${reasonText}`;
  }

  return `This employee is marked as Ineligible.${reasonText}`;
}

export default function EligibilityStatusBanner({
  role,
  employeeName,
  reason,
  className,
}: EligibilityStatusBannerProps) {
  const message = buildMessage(role, employeeName, reason ?? null);

  return (
    <div
      className={cn(
        "no-print flex items-start gap-2.5 rounded-lg border border-rose-300 bg-rose-100 px-4 py-3 dark:border-rose-800 dark:bg-rose-950/40",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
          {message}
        </p>
        {role === "admin" && employeeName ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            You can re-enable eligibility from the Staff Listing using the shield icon.
          </p>
        ) : null}
      </div>
    </div>
  );
}
