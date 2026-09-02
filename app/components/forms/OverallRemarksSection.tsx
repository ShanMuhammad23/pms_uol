"use client";

import { cn } from "@/lib/utils";

/**
 * Shared rendering for the "Additional Remarks" section shown at the bottom
 * of assessment forms when the form template has additional_remarks_enabled
 * = TRUE. Centralizes rendering so Manager 1, Manager 2, Submission Detail
 * View, and Print/PDF all stay consistent.
 *
 * Business rules:
 * - Employees never see this section (caller must not render it for employees).
 * - Manager 1 sees only their own editable textarea.
 * - Manager 2 sees Manager 1 remarks (read-only) + their own editable textarea.
 * - HR / Board / Super Admin see both remarks read-only.
 * - Manager 1 and Manager 2 remarks are completely independent.
 */

export interface OverallRemarksSectionProps {
  /** Whether the form has additional_remarks_enabled = TRUE. */
  enabled: boolean;
  /** Manager 1 overall remarks (read-only for non-Manager-1 viewers). */
  manager1Remarks: string | null;
  /** Manager 2 overall remarks (read-only for non-Manager-2 viewers). */
  manager2Remarks: string | null;
  /** Whether Manager 2 is assigned (controls if Manager 2 block is shown). */
  hasManager2: boolean;
  /** Whether the current user is Manager 1 and can edit their remarks. */
  canEditManager1: boolean;
  /** Whether the current user is Manager 2 and can edit their remarks. */
  canEditManager2: boolean;
  /** Callback when Manager 1 remarks change (textarea input). */
  onManager1Change?: (value: string) => void;
  /** Callback when Manager 2 remarks change (textarea input). */
  onManager2Change?: (value: string) => void;
  /** When true, renders a print-friendly layout (no edit controls). */
  printMode?: boolean;
}

const SECTION_LABEL = "Additional Remarks";
const MANAGER1_LABEL = "Manager 1 Remarks";
const MANAGER2_LABEL = "Manager 2 Remarks";

function RemarkDisplay({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | null;
  accent: "violet" | "indigo";
}) {
  const accentClasses = {
    violet: "border-violet-200 bg-violet-50/50 dark:border-violet-500/20 dark:bg-violet-900/10",
    indigo: "border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/20 dark:bg-indigo-900/10",
  };
  const labelClasses = {
    violet: "text-violet-700 dark:text-violet-300",
    indigo: "text-indigo-700 dark:text-indigo-300",
  };

  return (
    <div className={cn("rounded-lg border p-4", accentClasses[accent])}>
      <p
        className={cn(
          "mb-2 text-xs font-semibold uppercase tracking-wider",
          labelClasses[accent],
        )}
      >
        {label}
      </p>
      {value && value.trim() ? (
        <p className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-300">
          {value}
        </p>
      ) : (
        <p className="text-sm italic text-slate-400 dark:text-slate-500">
          No remarks provided.
        </p>
      )}
    </div>
  );
}

function RemarkEditor({
  label,
  value,
  onChange,
  accent,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  accent: "violet" | "indigo";
  placeholder: string;
}) {
  const ringClasses = {
    violet: "focus-visible:ring-violet-400",
    indigo: "focus-visible:ring-indigo-400",
  };
  const labelClasses = {
    violet: "text-violet-700 dark:text-violet-300",
    indigo: "text-indigo-700 dark:text-indigo-300",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <label
        className={cn(
          "mb-2 block text-xs font-semibold uppercase tracking-wider",
          labelClasses[accent],
        )}
      >
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder={placeholder}
        className={cn(
          "w-full resize-y rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 dark:border-white/15 dark:bg-slate-800 dark:text-slate-300",
          ringClasses[accent],
        )}
      />
    </div>
  );
}

export default function OverallRemarksSection({
  enabled,
  manager1Remarks,
  manager2Remarks,
  hasManager2,
  canEditManager1,
  canEditManager2,
  onManager1Change,
  onManager2Change,
  printMode = false,
}: OverallRemarksSectionProps) {
  if (!enabled) return null;

  // Print mode: always read-only display of both remarks
  if (printMode) {
    return (
      <div
        className="print-only print-remarks-section mt-6 rounded-lg border border-slate-200 p-4 dark:border-slate-700"
        style={{ display: "none" }}
      >
        <h3 className="mb-4 border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wider text-slate-700 dark:border-slate-700 dark:text-slate-300">
          {SECTION_LABEL}
        </h3>
        <div className="space-y-4">
          <RemarkDisplay
            label={MANAGER1_LABEL}
            value={manager1Remarks}
            accent="violet"
          />
          {hasManager2 ? (
            <RemarkDisplay
              label={MANAGER2_LABEL}
              value={manager2Remarks}
              accent="indigo"
            />
          ) : null}
        </div>
      </div>
    );
  }

  // Interactive mode
  return (
    <div className="no-print mt-6 rounded-lg border border-slate-200 bg-slate-50/30 p-4 dark:border-slate-700 dark:bg-slate-900/30">
      <h3 className="mb-4 border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wider text-slate-700 dark:border-slate-700 dark:text-slate-300">
        {SECTION_LABEL}
      </h3>
      <div className="space-y-4">
        {/* Manager 1 block */}
        {canEditManager1 && onManager1Change ? (
          <RemarkEditor
            label={MANAGER1_LABEL}
            value={manager1Remarks ?? ""}
            onChange={onManager1Change}
            accent="violet"
            placeholder="Enter overall remarks about the employee's assessment..."
          />
        ) : (
          <RemarkDisplay
            label={MANAGER1_LABEL}
            value={manager1Remarks}
            accent="violet"
          />
        )}

        {/* Manager 2 block — only shown when Manager 2 is assigned */}
        {hasManager2 ? (
          canEditManager2 && onManager2Change ? (
            <RemarkEditor
              label={MANAGER2_LABEL}
              value={manager2Remarks ?? ""}
              onChange={onManager2Change}
              accent="indigo"
              placeholder="Enter your independent overall remarks about the employee's assessment..."
            />
          ) : (
            <RemarkDisplay
              label={MANAGER2_LABEL}
              value={manager2Remarks}
              accent="indigo"
            />
          )
        ) : null}
      </div>
    </div>
  );
}

/**
 * Print-only variant that always renders both remarks as read-only.
 * Use this in print layouts where no editing is possible.
 */
export function OverallRemarksPrintSection({
  enabled,
  manager1Remarks,
  manager2Remarks,
  hasManager2,
}: Pick<
  OverallRemarksSectionProps,
  "enabled" | "manager1Remarks" | "manager2Remarks" | "hasManager2"
>) {
  return (
    <OverallRemarksSection
      enabled={enabled}
      manager1Remarks={manager1Remarks}
      manager2Remarks={manager2Remarks}
      hasManager2={hasManager2}
      canEditManager1={false}
      canEditManager2={false}
      printMode
    />
  );
}
