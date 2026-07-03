"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchStaffCategoriesWithSubCategories } from "@/lib/queries/staff-categories-client";

interface CategoryAssignmentStepProps {
  staffCategoryId: number | "";
  staffSubCategoryId: number | "";
  errors: Record<string, string>;
  onCategoryChange: (categoryId: number) => void;
  onSubCategoryChange: (subCategoryId: number) => void;
}

export default function CategoryAssignmentStep({
  staffCategoryId,
  staffSubCategoryId,
  errors,
  onCategoryChange,
  onSubCategoryChange,
}: CategoryAssignmentStepProps) {
  const { data: staffCategories = [], isLoading } = useQuery({
    queryKey: ["staff-categories-for-forms"],
    queryFn: fetchStaffCategoriesWithSubCategories,
  });

  const selectedCategory = staffCategories.find(
    (category) => category.id === staffCategoryId,
  );
  const subCategories = selectedCategory?.subCategories ?? [];

  const selectedSubCategory = subCategories.find(
    (subCategory) => subCategory.id === staffSubCategoryId,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          Staff Category Assignment
        </h2>
        <p className="mt-1 text-sm text-foreground/70">
          Choose which staff category and sub-category this form applies to.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/70">Loading staff categories...</p>
      ) : staffCategories.length === 0 ? (
        <p className="text-sm text-foreground/70">
          No staff categories found. Create staff categories before publishing a
          form.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-text-primary">
              Staff Category
            </label>
            <select
              value={staffCategoryId}
              onChange={(event) =>
                onCategoryChange(Number(event.target.value))
              }
              className="h-11 w-full rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
            >
              <option value="">Select staff category</option>
              {staffCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.staffCategoryId ? (
              <p className="mt-1 text-xs text-red-600">{errors.staffCategoryId}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text-primary">
              Sub-Category
            </label>
            <select
              value={staffSubCategoryId}
              onChange={(event) =>
                onSubCategoryChange(Number(event.target.value))
              }
              disabled={!staffCategoryId}
              className="h-11 w-full rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 dark:border-white/15"
            >
              <option value="">Select sub-category</option>
              {subCategories.map((subCategory) => (
                <option key={subCategory.id} value={subCategory.id}>
                  {subCategory.name}
                </option>
              ))}
            </select>
            {errors.staffSubCategoryId ? (
              <p className="mt-1 text-xs text-red-600">
                {errors.staffSubCategoryId}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {selectedCategory && selectedSubCategory ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-text-primary">
          This form will be available to staff in the{" "}
          <span className="font-semibold">{selectedCategory.name}</span> category
          under the{" "}
          <span className="font-semibold">{selectedSubCategory.name}</span>{" "}
          sub-category.
        </div>
      ) : null}
    </div>
  );
}
