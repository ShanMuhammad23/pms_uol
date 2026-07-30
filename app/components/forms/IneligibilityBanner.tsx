"use client";

import { AlertTriangle } from "lucide-react";

interface IneligibilityBannerProps {
  message?: string;
}

export default function IneligibilityBanner({
  message,
}: IneligibilityBannerProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-rose-300 bg-rose-100 px-4 py-3 dark:border-rose-800 dark:bg-rose-950/40">
      <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
      <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
        {message ??
          "Assessment unavailable. This employee is marked as Ineligible and cannot be assessed until eligibility is re-enabled."}
      </p>
    </div>
  );
}
