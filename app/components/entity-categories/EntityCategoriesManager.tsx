"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { List, Pencil, Plus, Table2, Trash2, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
  createEntityCategory,
  deleteEntityCategory,
  fetchEntityCategories,
  updateEntityCategory,
} from "@/lib/queries/entity-categories-client";
import {
  ENTITY_CATEGORY_CODES,
  type EntityCategoryCode,
  type EntityCategoryRecord,
} from "@/types/entity-categories";

type MessageTone = "success" | "error";

interface FormMessage {
  tone: MessageTone;
  text: string;
}

type CategorySectionTab = "list" | "add";

const initialCode: EntityCategoryCode = "C1";

export default function EntityCategoriesManager() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState<EntityCategoryCode>(initialCode);
  const [editingCategory, setEditingCategory] =
    useState<EntityCategoryRecord | null>(null);
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  const [activeTab, setActiveTab] = useState<CategorySectionTab>("list");

  const { data, isLoading, error } = useQuery({
    queryKey: ["entity-categories"],
    queryFn: fetchEntityCategories,
  });

  const resetForm = () => {
    setCode(initialCode);
    setEditingCategory(null);
  };

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: ["entity-categories"] });
  };

  const createMutation = useMutation({
    mutationFn: createEntityCategory,
    onSuccess: (category) => {
      setFormMessage({
        tone: "success",
        text: `Category "${category.code}" created successfully.`,
      });
      resetForm();
      invalidateList();
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      code: nextCode,
    }: {
      id: number;
      code: EntityCategoryCode;
    }) => updateEntityCategory(id, { code: nextCode }),
    onSuccess: (category) => {
      setFormMessage({
        tone: "success",
        text: `Category updated to "${category.code}" successfully.`,
      });
      resetForm();
      invalidateList();
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEntityCategory,
    onSuccess: () => {
      setFormMessage({
        tone: "success",
        text: "Category deleted successfully.",
      });
      if (editingCategory) {
        resetForm();
      }
      invalidateList();
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const usedCodes = new Set(data?.map((category) => category.code) ?? []);
  const availableCodes = ENTITY_CATEGORY_CODES.filter((option) => {
    if (editingCategory?.code === option) {
      return true;
    }

    return !usedCodes.has(option);
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, code });
      return;
    }

    createMutation.mutate({ code });
  };

  const handleEdit = (category: EntityCategoryRecord) => {
    setActiveTab("list");
    setEditingCategory(category);
    setCode(category.code);
    setFormMessage(null);
  };

  const handleDelete = (category: EntityCategoryRecord) => {
    const confirmed = window.confirm(
      `Delete category "${category.code}"?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setFormMessage(null);
    deleteMutation.mutate(category.id);
  };

  const handleCancelEdit = () => {
    resetForm();
    setFormMessage(null);
  };

  const handleSwitchTab = (tab: CategorySectionTab) => {
    setActiveTab(tab);
    setFormMessage(null);
    if (tab === "add") {
      resetForm();
    }
  };

  const renderFormCard = () => (
    <div className="rounded-xl border border-slate-300/80 p-6 dark:border-white/15">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            {editingCategory ? "Edit Category" : "Add Category"}
          </h2>
          <p className="mt-1 text-sm text-foreground/70">
            Entity categories use codes C1, C2, and C3 as defined in the system
            schema.
          </p>
        </div>

        {editingCategory ? (
          <button
            type="button"
            onClick={handleCancelEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
          >
            <X className="size-3.5" />
            Cancel
          </button>
        ) : null}
      </div>

      <AnimatePresence>
        {formMessage ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`mt-4 overflow-hidden rounded-xl border px-4 py-3 text-sm font-medium ${
              formMessage.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/30 dark:bg-emerald-950/20 dark:text-emerald-300"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-300"
            }`}
          >
            {formMessage.text}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="entity-category-code"
            className="mb-1.5 block text-sm font-medium text-text-primary"
          >
            Category Code
          </label>
          <select
            id="entity-category-code"
            value={code}
            onChange={(event) =>
              setCode(event.target.value as EntityCategoryCode)
            }
            disabled={availableCodes.length === 0 && !editingCategory}
            className="w-full max-w-xs rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
          >
            {(editingCategory ? ENTITY_CATEGORY_CODES : availableCodes).map(
              (option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ),
            )}
          </select>
          {!editingCategory && availableCodes.length === 0 ? (
            <p className="mt-2 text-sm text-foreground/70">
              All category codes are already in use.
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || (!editingCategory && availableCodes.length === 0)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
        >
          {editingCategory ? (
            <>
              <Pencil className="size-4" />
              Update Category
            </>
          ) : (
            <>
              <Plus className="size-4" />
              Add Category
            </>
          )}
        </button>
      </form>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-300/80 dark:border-white/15">
        <nav
          aria-label="Category section tabs"
          className="-mb-px flex gap-1"
        >
          {(
            [
              { id: "list", label: "Categories", icon: Table2 },
              { id: "add", label: "Add Category", icon: Plus },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSwitchTab(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-foreground/70 hover:border-primary/40 hover:text-text-primary"
                }`}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === "add" || editingCategory ? renderFormCard() : null}

      {isLoading ? (
        <div className="rounded-xl border border-slate-300/80 p-8 text-sm text-foreground/70 dark:border-white/15">
          Loading categories...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Failed to load entity categories.
        </div>
      ) : null}

      {!isLoading && !error && (!data || data.length === 0) ? (
        <div className="rounded-xl border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
          <List className="mx-auto size-8 text-foreground/50" />
          <p className="mt-3 text-sm font-medium text-text-primary">
            No entity categories yet
          </p>
          <p className="mt-1 text-sm text-foreground/70">
            Add your first category from the Add Category tab.
          </p>
        </div>
      ) : null}

      {!isLoading && !error && data && data.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-300/80 dark:border-white/15">
          <table className="min-w-full text-sm">
            <thead className="bg-primary/5">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-text-primary">
                  Code
                </th>
                <th className="px-4 py-3 text-left font-semibold text-text-primary">
                  Created
                </th>
                <th className="px-4 py-3 text-left font-semibold text-text-primary">
                  Updated
                </th>
                <th className="px-4 py-3 text-right font-semibold text-text-primary">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((category) => (
                <tr
                  key={category.id}
                  className="border-t border-slate-300/80 dark:border-white/15"
                >
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {category.code}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {new Date(category.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {new Date(category.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(category)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(category)}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-60 dark:border-red-900"
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
      ) : null}
    </div>
  );
}
