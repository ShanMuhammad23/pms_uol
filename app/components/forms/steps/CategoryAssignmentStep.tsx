"use client";

import Link from "next/link";
import type { AppraisalCycleRecord, EmployeeCategory, SubCategory } from "@/types/forms";
import {
  CATEGORY_LABELS,
  SUB_CATEGORY_LABELS,
} from "@/types/forms";
import FormEmployeeAssignment from "../FormEmployeeAssignment";

interface CategoryAssignmentStepProps {
  appraisalCycles: AppraisalCycleRecord[];
  cycleId: number | "";
  targetCategory: EmployeeCategory | "";
  targetSubCategory: SubCategory | "";
  errors: Record<string, string>;
  onCycleChange: (cycleId: number) => void;
  onCategoryChange: (category: EmployeeCategory) => void;
  onSubCategoryChange: (subCategory: SubCategory) => void;
  templateId?: number;
  templateTitle: string;
  templateCode?: string | null;
}

export default function CategoryAssignmentStep({
  appraisalCycles,
  cycleId,
  targetCategory,
  targetSubCategory,
  errors,
  onCycleChange,
  templateId,
  templateTitle,
  templateCode,
}: CategoryAssignmentStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          Category Assignment
        </h2>
        <p className="mt-1 text-sm text-foreground/70">
          Choose the appraisal cycle and which employee group this form applies to.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-text-primary">
            Appraisal Cycle
          </label>
          {appraisalCycles.length > 0 ? (
            <select
              value={cycleId}
              onChange={(event) => onCycleChange(Number(event.target.value))}
              className="h-11 w-full rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
            >
              <option value="">Select appraisal cycle</option>
              {appraisalCycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  FY {cycle.fiscalYear}
                  {cycle.isActive ? " (Active)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              No appraisal cycles are configured yet. A default cycle will be
              created automatically when you publish, or you can run{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900/60">
                npm run setup-db
              </code>{" "}
              to seed one in advance.
            </div>
          )}
          {errors.cycleId ? (
            <p className="mt-1 text-xs text-red-600">{errors.cycleId}</p>
          ) : null}
        </div>

        {targetCategory && targetSubCategory ? (
          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950/40">
            <span className="text-foreground/60">Target audience:</span>{" "}
            <span className="font-medium text-text-primary">
              {CATEGORY_LABELS[targetCategory]} · {SUB_CATEGORY_LABELS[targetSubCategory]}
            </span>
          </div>
        ) : null}
      </div>

      {appraisalCycles.length === 0 ? (
        <p className="text-xs text-foreground/70">
          Need multiple cycles? Contact your system administrator or extend the
          appraisal cycles API at{" "}
          <Link href="/dashboard/matrices-and-cycles" className="text-primary hover:underline">
            Matrices and Cycles
          </Link>
          .
        </p>
      ) : null}

      {templateId ? (
        <FormEmployeeAssignment
          templateId={templateId}
          templateTitle={templateTitle}
          templateCode={templateCode}
        />
      ) : (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-sm text-text-primary">
          Employee assignment will be available after you publish this form.
        </div>
      )}
    </div>
  );
}
