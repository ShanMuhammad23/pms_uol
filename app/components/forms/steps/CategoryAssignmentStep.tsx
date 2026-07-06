"use client";

import Link from "next/link";
import type { AppraisalCycleRecord, EmployeeCategory, SubCategory } from "@/types/forms";
import {
  CATEGORY_LABELS,
  CATEGORY_SUB_MAP,
  EMPLOYEE_CATEGORIES,
  SUB_CATEGORY_LABELS,
} from "@/types/forms";

interface CategoryAssignmentStepProps {
  appraisalCycles: AppraisalCycleRecord[];
  cycleId: number | "";
  targetCategory: EmployeeCategory | "";
  targetSubCategory: SubCategory | "";
  errors: Record<string, string>;
  onCycleChange: (cycleId: number) => void;
  onCategoryChange: (category: EmployeeCategory) => void;
  onSubCategoryChange: (subCategory: SubCategory) => void;
}

export default function CategoryAssignmentStep({
  appraisalCycles,
  cycleId,
  targetCategory,
  targetSubCategory,
  errors,
  onCycleChange,
  onCategoryChange,
  onSubCategoryChange,
}: CategoryAssignmentStepProps) {
  const subCategories = targetCategory
    ? CATEGORY_SUB_MAP[targetCategory]
    : [];
  const selectedCycle = appraisalCycles.find((cycle) => cycle.id === cycleId);

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

        <div>
          <label className="mb-2 block text-sm font-medium text-text-primary">
            Employee Category
          </label>
          <select
            value={targetCategory}
            onChange={(event) =>
              onCategoryChange(event.target.value as EmployeeCategory)
            }
            className="h-11 w-full rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
          >
            <option value="">Select category</option>
            {EMPLOYEE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
          {errors.targetCategory ? (
            <p className="mt-1 text-xs text-red-600">{errors.targetCategory}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text-primary">
            Sub-Category
          </label>
          <select
            value={targetSubCategory}
            onChange={(event) =>
              onSubCategoryChange(event.target.value as SubCategory)
            }
            disabled={!targetCategory}
            className="h-11 w-full rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 dark:border-white/15"
          >
            <option value="">Select sub-category</option>
            {subCategories.map((subCategory) => (
              <option key={subCategory} value={subCategory}>
                {SUB_CATEGORY_LABELS[subCategory]}
              </option>
            ))}
          </select>
          {errors.targetSubCategory ? (
            <p className="mt-1 text-xs text-red-600">
              {errors.targetSubCategory}
            </p>
          ) : null}
        </div>
      </div>

      {targetCategory && targetSubCategory ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-text-primary">
          This form will be shown to{" "}
          <span className="font-semibold">
            {CATEGORY_LABELS[targetCategory]}
          </span>{" "}
          employees in the{" "}
          <span className="font-semibold">
            {SUB_CATEGORY_LABELS[targetSubCategory]}
          </span>{" "}
          sub-category
          {selectedCycle ? (
            <>
              {" "}
              during appraisal cycle{" "}
              <span className="font-semibold">
                FY {selectedCycle.fiscalYear}
              </span>
            </>
          ) : (
            " during the selected appraisal cycle"
          )}
          .
        </div>
      ) : null}

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
    </div>
  );
}
