"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlowRequestBannerProps {
  open: boolean;
  onHoldOn: () => void;
  onRefresh: () => void;
  className?: string;
}

/**
 * Shown when My Forms (or similar) requests exceed the expected wait time
 * under high server load — offers patience or a full page refresh.
 */
export function SlowRequestBanner({
  open,
  onHoldOn,
  onRefresh,
  className,
}: SlowRequestBannerProps) {
  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg sm:inset-x-auto sm:right-6 sm:left-auto sm:w-full",
        className,
      )}
    >
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-lg dark:border-amber-700/60 dark:bg-amber-950/95">
        <div className="flex items-start gap-3">
          <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-amber-700 dark:text-amber-300" />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                Taking longer than expected
              </p>
              <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
                The server is busy. You can wait a bit longer, or refresh the
                page and try again.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onHoldOn}
                className="inline-flex items-center justify-center rounded-lg border border-amber-400/80 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-900"
              >
                Hold on
              </button>
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
              >
                <RefreshCw className="size-3.5" />
                Refresh page
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
