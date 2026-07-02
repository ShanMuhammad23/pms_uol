"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Pencil, Plus, Table2, Trash2, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { fetchEntityCategories } from "@/lib/queries/entity-categories-client";
import {
  createEntity,
  deleteEntity,
  fetchEntities,
  updateEntity,
} from "@/lib/queries/entities-client";
import type { EntityRecord } from "@/types/entities";

type MessageTone = "success" | "error";

interface FormMessage {
  tone: MessageTone;
  text: string;
}

interface EntityFormState {
  name: string;
  entityCategoryId: string;
  parentEntityId: string;
}

type EntitySectionTab = "list" | "add";

const emptyForm: EntityFormState = {
  name: "",
  entityCategoryId: "",
  parentEntityId: "",
};

export default function EntitiesManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EntityFormState>(emptyForm);
  const [editingEntity, setEditingEntity] = useState<EntityRecord | null>(null);
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  const [activeTab, setActiveTab] = useState<EntitySectionTab>("list");

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["entity-categories"],
    queryFn: fetchEntityCategories,
  });

  const {
    data: entities,
    isLoading: entitiesLoading,
    error,
  } = useQuery({
    queryKey: ["entities"],
    queryFn: fetchEntities,
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingEntity(null);
  };

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: ["entities"] });
  };

  const createMutation = useMutation({
    mutationFn: createEntity,
    onSuccess: (entity) => {
      setFormMessage({
        tone: "success",
        text: `Entity "${entity.name}" created successfully.`,
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
      input,
    }: {
      id: number;
      input: {
        name: string;
        entityCategoryId: number;
        parentEntityId: number | null;
      };
    }) => updateEntity(id, input),
    onSuccess: (entity) => {
      setFormMessage({
        tone: "success",
        text: `Entity "${entity.name}" updated successfully.`,
      });
      resetForm();
      invalidateList();
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEntity,
    onSuccess: () => {
      setFormMessage({
        tone: "success",
        text: "Entity deleted successfully.",
      });
      if (editingEntity) {
        resetForm();
      }
      invalidateList();
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isLoading = categoriesLoading || entitiesLoading;

  const parentOptions = useMemo(() => {
    if (!entities) {
      return [];
    }

    if (!editingEntity) {
      return entities;
    }

    const invalidParentIds = new Set<number>([editingEntity.id]);
    const childrenByParent = new Map<number, number[]>();

    for (const entity of entities) {
      if (entity.parentEntityId !== null) {
        const siblings = childrenByParent.get(entity.parentEntityId) ?? [];
        siblings.push(entity.id);
        childrenByParent.set(entity.parentEntityId, siblings);
      }
    }

    const stack = [editingEntity.id];

    while (stack.length > 0) {
      const current = stack.pop()!;

      for (const childId of childrenByParent.get(current) ?? []) {
        if (!invalidParentIds.has(childId)) {
          invalidParentIds.add(childId);
          stack.push(childId);
        }
      }
    }

    return entities.filter((entity) => !invalidParentIds.has(entity.id));
  }, [entities, editingEntity]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);

    const payload = {
      name: form.name.trim(),
      entityCategoryId: Number(form.entityCategoryId),
      parentEntityId: form.parentEntityId ? Number(form.parentEntityId) : null,
    };

    if (editingEntity) {
      updateMutation.mutate({ id: editingEntity.id, input: payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const handleEdit = (entity: EntityRecord) => {
    setActiveTab("list");
    setEditingEntity(entity);
    setForm({
      name: entity.name,
      entityCategoryId: String(entity.entityCategoryId),
      parentEntityId: entity.parentEntityId ? String(entity.parentEntityId) : "",
    });
    setFormMessage(null);
  };

  const handleDelete = (entity: EntityRecord) => {
    const confirmed = window.confirm(
      `Delete entity "${entity.name}"?\n\nChild entities will have their parent cleared. This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setFormMessage(null);
    deleteMutation.mutate(entity.id);
  };

  const handleCancelEdit = () => {
    resetForm();
    setFormMessage(null);
  };

  const hasCategories = (categories?.length ?? 0) > 0;

  const handleSwitchTab = (tab: EntitySectionTab) => {
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
            {editingEntity ? "Edit Entity" : "Add Entity"}
          </h2>
          <p className="mt-1 text-sm text-foreground/70">
            Create organizational entities linked to a category and optional
            parent entity.
          </p>
        </div>

        {editingEntity ? (
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

      {!hasCategories && !categoriesLoading ? (
        <p className="mt-4 text-sm text-foreground/70">
          Add at least one entity category before creating entities.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="entity-name"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Name
            </label>
            <input
              id="entity-name"
              type="text"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              maxLength={150}
              required
              placeholder="e.g. Faculty of Engineering"
              className="w-full max-w-md rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
            />
          </div>

          <div>
            <label
              htmlFor="entity-category"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Category
            </label>
            <select
              id="entity-category"
              value={form.entityCategoryId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  entityCategoryId: event.target.value,
                }))
              }
              required
              className="w-full max-w-xs rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
            >
              <option value="" disabled>
                Select category
              </option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="entity-parent"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Parent Entity
            </label>
            <select
              id="entity-parent"
              value={form.parentEntityId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  parentEntityId: event.target.value,
                }))
              }
              className="w-full max-w-md rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
            >
              <option value="">None (top-level)</option>
              {parentOptions.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !hasCategories}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {editingEntity ? (
              <>
                <Pencil className="size-4" />
                Update Entity
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Add Entity
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-300/80 dark:border-white/15">
        <nav aria-label="Entity section tabs" className="-mb-px flex gap-1">
          {(
            [
              { id: "list", label: "Entities", icon: Table2 },
              { id: "add", label: "Add Entity", icon: Plus },
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

      {activeTab === "add" || editingEntity ? renderFormCard() : null}

      {isLoading ? (
        <div className="rounded-xl border border-slate-300/80 p-8 text-sm text-foreground/70 dark:border-white/15">
          Loading entities...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Failed to load entities.
        </div>
      ) : null}

      {!isLoading && !error && (!entities || entities.length === 0) ? (
        <div className="rounded-xl border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
          <Building2 className="mx-auto size-8 text-foreground/50" />
          <p className="mt-3 text-sm font-medium text-text-primary">
            No entities yet
          </p>
          <p className="mt-1 text-sm text-foreground/70">
            Add your first entity from the Add Entity tab.
          </p>
        </div>
      ) : null}

      {!isLoading && !error && entities && entities.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-300/80 dark:border-white/15">
          <table className="min-w-full text-sm">
            <thead className="bg-primary/5">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-text-primary">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-text-primary">
                  Category
                </th>
                <th className="px-4 py-3 text-left font-semibold text-text-primary">
                  Parent
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
              {entities.map((entity) => (
                <tr
                  key={entity.id}
                  className="border-t border-slate-300/80 dark:border-white/15"
                >
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {entity.name}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {entity.categoryCode}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {entity.parentName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {new Date(entity.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(entity)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entity)}
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
