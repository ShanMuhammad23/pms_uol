"use client";

import type { EmployeeCategory, SubCategory } from "@/types/forms";
import {
  CATEGORY_LABELS,
  CATEGORY_SUB_MAP,
  EMPLOYEE_CATEGORIES,
  SUB_CATEGORY_LABELS,
} from "@/types/forms";

interface CategoryAssignmentStepProps {
  targetCategory: EmployeeCategory | "";
  targetSubCategory: SubCategory | "";
  errors: Record<string, string>;
  onCategoryChange: (category: EmployeeCategory) => void;
  onSubCategoryChange: (subCategory: SubCategory) => void;
}

export default function CategoryAssignmentStep({
  targetCategory,
  targetSubCategory,
  errors,
  onCategoryChange,
  onSubCategoryChange,
}: CategoryAssignmentStepProps) {
  const subCategories = targetCategory
    ? CATEGORY_SUB_MAP[targetCategory]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          Category Assignment
        </h2>
        <p className="mt-1 text-sm text-foreground/70">
          Choose which employee category and sub-category this form applies to.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
          sub-category during the selected appraisal cycle.
        </div>
      ) : null}
    </div>
  );
}
