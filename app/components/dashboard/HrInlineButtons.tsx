"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface HrInlineSaveButtonProps {
  onSave: () => void;
  isPending: boolean;
  disabled?: boolean;
}

export function HrInlineSaveButton({
  onSave,
  isPending,
  disabled,
}: HrInlineSaveButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={disabled || isPending}
        className="ml-1 inline-flex shrink-0 items-center rounded border border-orange-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold leading-none text-orange-800 hover:bg-orange-50 disabled:opacity-60 dark:border-orange-700 dark:bg-slate-900 dark:text-orange-200 dark:hover:bg-orange-950/40"
      >
        {isPending ? "..." : "Save"}
      </button>

      {showConfirm ? (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
            onClick={() => setShowConfirm(false)}
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/15 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Confirm Save
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to save the current score adjustments? You can continue editing after saving.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  onSave();
                }}
                disabled={isPending}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? "Saving..." : "Confirm Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

interface HrInlineApproveButtonProps {
  onApprove: () => void;
  isPending: boolean;
  label?: string;
  disabled?: boolean;
}

export function HrInlineApproveButton({
  onApprove,
  isPending,
  label = "Approve",
  disabled,
}: HrInlineApproveButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={disabled || isPending}
        className="ml-1 inline-flex shrink-0 items-center rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "..." : label}
      </button>

      {showConfirm ? (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
            onClick={() => setShowConfirm(false)}
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/15 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Confirm Approval
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to approve this appraisal? This will advance it to the next stage.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  onApprove();
                }}
                disabled={isPending}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? "Approving..." : "Confirm Approve"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
