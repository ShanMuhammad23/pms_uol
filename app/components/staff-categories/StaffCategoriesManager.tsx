"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Pencil, Plus, Shapes, Trash2 } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import {
  createStaffCategory,
  createStaffSubCategory,
  deleteStaffCategory,
  deleteStaffSubCategory,
  fetchStaffCategories,
  fetchStaffSubCategories,
  updateStaffCategory,
  updateStaffSubCategory,
} from "@/lib/queries/staff-categories-client";
import type { StaffCategoryRecord, StaffSubCategoryRecord } from "@/types/staff-categories";

type TabId = "categories" | "sub-categories";

export default function StaffCategoriesManager() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>("categories");
  const [categoryName, setCategoryName] = useState("");
  const [subCategoryName, setSubCategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [editingCategory, setEditingCategory] = useState<StaffCategoryRecord | null>(null);
  const [editingSubCategory, setEditingSubCategory] = useState<StaffSubCategoryRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["staff-categories"],
    queryFn: fetchStaffCategories,
  });
  const { data: subCategories = [], isLoading: subCategoriesLoading } = useQuery({
    queryKey: ["staff-sub-categories"],
    queryFn: fetchStaffSubCategories,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["staff-categories"] });
    queryClient.invalidateQueries({ queryKey: ["staff-sub-categories"] });
  };

  const categoryMutation = useMutation({
    mutationFn: (name: string) =>
      editingCategory
        ? updateStaffCategory(editingCategory.id, { name })
        : createStaffCategory({ name }),
    onSuccess: () => {
      setMessage(editingCategory ? "Category updated." : "Category created.");
      setCategoryName("");
      setEditingCategory(null);
      invalidate();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const subCategoryMutation = useMutation({
    mutationFn: ({ name, staffCategoryId }: { name: string; staffCategoryId: number }) =>
      editingSubCategory
        ? updateStaffSubCategory(editingSubCategory.id, { name, staffCategoryId })
        : createStaffSubCategory({ name, staffCategoryId }),
    onSuccess: () => {
      setMessage(editingSubCategory ? "Sub-category updated." : "Sub-category created.");
      setSubCategoryName("");
      setSelectedCategoryId("");
      setEditingSubCategory(null);
      invalidate();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: deleteStaffCategory,
    onSuccess: () => {
      setMessage("Category deleted.");
      invalidate();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const deleteSubCategoryMutation = useMutation({
    mutationFn: deleteStaffSubCategory,
    onSuccess: () => {
      setMessage("Sub-category deleted.");
      invalidate();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const groupedSubCategories = useMemo(() => {
    return categories.map((category) => ({
      category,
      items: subCategories.filter((item) => item.staffCategoryId === category.id),
    }));
  }, [categories, subCategories]);

  const onSubmitCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    categoryMutation.mutate(categoryName.trim());
  };

  const onSubmitSubCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    subCategoryMutation.mutate({
      name: subCategoryName.trim(),
      staffCategoryId: Number(selectedCategoryId),
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-300/80 dark:border-white/15">
        <nav className="-mb-px flex gap-1" aria-label="Staff category tabs">
          {([
            { id: "categories", label: "Staff Categories", icon: Layers },
            { id: "sub-categories", label: "Sub-Categories", icon: Shapes },
          ] as const).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-foreground/70 hover:border-primary/40 hover:text-text-primary"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {message ? (
        <div className="rounded-xl border border-slate-300/80 px-4 py-3 text-sm dark:border-white/15">
          {message}
        </div>
      ) : null}

      {tab === "categories" ? (
        <>
          <form onSubmit={onSubmitCategory} className="rounded-xl border border-slate-300/80 p-6 dark:border-white/15">
            <h2 className="text-lg font-semibold">{editingCategory ? "Edit Category" : "Add Category"}</h2>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="w-full max-w-md">
                <label htmlFor="staff-category-name" className="mb-1.5 block text-sm font-medium">
                  Category Name
                </label>
                <input
                  id="staff-category-name"
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm dark:border-white/15"
                />
              </div>
              <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white">
                <Plus className="size-4" />
                {editingCategory ? "Update" : "Add"}
              </button>
            </div>
          </form>

          {categoriesLoading ? <p className="text-sm text-foreground/70">Loading categories...</p> : null}
          <div className="overflow-x-auto rounded-xl border border-slate-300/80 dark:border-white/15">
            <table className="min-w-full text-sm">
              <thead className="bg-primary/5">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id} className="border-t border-slate-300/80 dark:border-white/15">
                    <td className="px-4 py-3">{category.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(category);
                            setCategoryName(category.name);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-white/15"
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCategoryMutation.mutate(category.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs text-red-600"
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <form onSubmit={onSubmitSubCategory} className="rounded-xl border border-slate-300/80 p-6 dark:border-white/15">
            <h2 className="text-lg font-semibold">{editingSubCategory ? "Edit Sub-Category" : "Add Sub-Category"}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="staff-sub-category-name" className="mb-1.5 block text-sm font-medium">
                  Sub-Category Name
                </label>
                <input
                  id="staff-sub-category-name"
                  value={subCategoryName}
                  onChange={(event) => setSubCategoryName(event.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm dark:border-white/15"
                />
              </div>
              <div>
                <label htmlFor="staff-sub-category-parent" className="mb-1.5 block text-sm font-medium">
                  Staff Category
                </label>
                <select
                  id="staff-sub-category-parent"
                  value={selectedCategoryId}
                  onChange={(event) => setSelectedCategoryId(event.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm dark:border-white/15"
                >
                  <option value="" disabled>
                    Select category
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white">
              <Plus className="size-4" />
              {editingSubCategory ? "Update" : "Add"}
            </button>
          </form>

          {subCategoriesLoading ? <p className="text-sm text-foreground/70">Loading sub-categories...</p> : null}
          <div className="space-y-4">
            {groupedSubCategories.map(({ category, items }) => (
              <div key={category.id} className="rounded-xl border border-slate-300/80 p-4 dark:border-white/15">
                <h3 className="text-sm font-semibold">{category.name}</h3>
                <div className="mt-3 space-y-2">
                  {items.length === 0 ? (
                    <p className="text-sm text-foreground/70">No sub-categories</p>
                  ) : (
                    items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-300/80 px-3 py-2 dark:border-white/15">
                        <span className="text-sm">{item.name}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSubCategory(item);
                              setSubCategoryName(item.name);
                              setSelectedCategoryId(String(item.staffCategoryId));
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-white/15"
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSubCategoryMutation.mutate(item.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600"
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
