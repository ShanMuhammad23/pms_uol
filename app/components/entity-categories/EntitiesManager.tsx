"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Pencil, Plus, Search, Table2, Trash2, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { EntitiesTableColumnHeaderFilter } from "@/app/components/entity-categories/EntitiesTableColumnHeaderFilter";
import { filterEntityRecords } from "@/app/helpers/dashboard-entity-filters";
import {
  applyEntitiesMasterFilters,
  EMPTY_ENTITIES_MASTER_FILTER_STATE,
  hasActiveEntitiesMasterFilters,
  isEntitiesMasterFilterableColumn,
  type EntitiesMasterFilterMultiSelection,
  type EntitiesMasterFilterState,
  type EntitiesMasterFilterTextColumnId,
} from "@/app/helpers/entities-master-filters";
import {
  ENTITIES_TABLE_COLUMNS,
  type EntitiesTableColumnId,
} from "@/app/helpers/entities-table-columns";
import type { NumericRangeFilter } from "@/app/helpers/numeric-range-filter";
import { cn } from "@/lib/utils";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [masterFilters, setMasterFilters] = useState<EntitiesMasterFilterState>(
    EMPTY_ENTITIES_MASTER_FILTER_STATE,
  );

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

  const filteredEntities = useMemo(
    () =>
      filterEntityRecords(entities ?? [], {
        searchQuery,
        categoryCode: "ALL",
        entityIds: null,
        childEntityIds: null,
        parentEntityIds: null,
      }),
    [entities, searchQuery],
  );

  const displayedEntities = useMemo(
    () => applyEntitiesMasterFilters(filteredEntities, masterFilters),
    [filteredEntities, masterFilters],
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    hasActiveEntitiesMasterFilters(masterFilters);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setMasterFilters(EMPTY_ENTITIES_MASTER_FILTER_STATE);
  }, []);

  const handleMasterTextChange = useCallback(
    (columnId: EntitiesMasterFilterTextColumnId, next: string) => {
      setMasterFilters((current) => ({
        ...current,
        text: {
          ...current.text,
          [columnId]: next,
        },
      }));
    },
    [],
  );

  const handleMasterMultiChange = useCallback(
    (
      columnId: EntitiesTableColumnId,
      next: EntitiesMasterFilterMultiSelection,
    ) => {
      setMasterFilters((current) => ({
        ...current,
        multi: {
          ...current.multi,
          [columnId]: next,
        },
      }));
    },
    [],
  );

  const handleMasterNumericChange = useCallback(
    (columnId: EntitiesTableColumnId, filter: NumericRangeFilter | undefined) => {
      setMasterFilters((current) => {
        const nextNumeric = { ...current.numeric };
        if (filter === undefined) {
          delete nextNumeric[columnId];
        } else {
          nextNumeric[columnId] = filter;
        }
        return { ...current, numeric: nextNumeric };
      });
    },
    [],
  );

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

  const handleCancelEdit = useCallback(() => {
    resetForm();
    setFormMessage(null);
  }, []);

  useEffect(() => {
    if (!editingEntity) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCancelEdit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingEntity, handleCancelEdit]);

  const hasCategories = (categories?.length ?? 0) > 0;

  const handleSwitchTab = (tab: EntitySectionTab) => {
    setActiveTab(tab);
    setFormMessage(null);
    if (tab === "add") {
      resetForm();
    }
  };

  const renderEntityFormFields = () => (
    <>
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
              className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
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
              className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
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
              className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
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
    </>
  );

  const renderFormMessage = () => (
    <AnimatePresence>
      {formMessage ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={`mt-4 overflow-hidden rounded-md border px-4 py-3 text-sm font-medium ${
            formMessage.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/30 dark:bg-emerald-950/20 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-300"
          }`}
        >
          {formMessage.text}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  const renderAddFormCard = () => (
    <div className="rounded-md border border-slate-300/80 p-6 dark:border-white/15">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Add Entity</h2>
        <p className="mt-1 text-sm text-foreground/70">
          Create organizational entities linked to a category and optional parent
          entity.
        </p>
      </div>

      {renderFormMessage()}
      {renderEntityFormFields()}
    </div>
  );

  const renderEditModal = () => (
    <AnimatePresence>
      {editingEntity ? (
        <motion.div
          key="entity-edit-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="entity-edit-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-100 flex items-center justify-center p-4"
        >
          <motion.button
            type="button"
            aria-label="Close edit entity dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancelEdit}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full max-w-lg overflow-hidden rounded-xl border border-slate-300/80 bg-surface p-6 shadow-2xl shadow-slate-900/10 dark:border-white/15 dark:shadow-black/40"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="entity-edit-modal-title"
                  className="text-lg font-semibold text-text-primary"
                >
                  Edit Entity
                </h2>
                <p className="mt-1 text-sm text-foreground/70">
                  Update this entity&apos;s name, category, or parent.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCancelEdit}
                aria-label="Close"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-foreground/70 hover:bg-primary/10 hover:text-text-primary dark:border-white/15"
              >
                <X className="size-4" />
              </button>
            </div>

            {renderFormMessage()}
            {renderEntityFormFields()}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
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

      {activeTab === "add" ? renderAddFormCard() : null}
      {renderEditModal()}

      {isLoading ? (
        <div className="rounded-md border border-slate-300/80 p-8 text-sm text-foreground/70 dark:border-white/15">
          Loading entities...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Failed to load entities.
        </div>
      ) : null}

      {!isLoading && !error && (!entities || entities.length === 0) ? (
        <div className="rounded-md border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
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
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-300/80 p-4 dark:border-white/15">
            <p className="text-sm text-foreground/70">
              Showing {displayedEntities.length} of {entities.length} entities
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[16rem] flex-1 sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by name or parent…"
                  className="w-full rounded-lg border border-slate-300 bg-background py-2 pl-10 pr-4 text-sm text-text-primary placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
                />
              </div>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                >
                  <X className="size-3.5" />
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {displayedEntities.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
              <Building2 className="mx-auto size-8 text-foreground/50" />
              <p className="mt-3 text-sm font-medium text-text-primary">
                No entities match the current search
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 text-sm font-medium text-primary hover:underline"
                >
                  Clear search
                </button>
              ) : null}
            </div>
          ) : (
        <div className="overflow-x-auto rounded-md border border-slate-300/80 dark:border-white/15">
          <table className="min-w-full table-fixed text-sm">
            <thead className="bg-primary/5">
              <tr>
                {ENTITIES_TABLE_COLUMNS.map((column) => (
                  <th
                    key={column.id}
                    className={cn(
                      "px-4 py-3 font-semibold text-white bg-primary",
                      column.align === "right" ? "text-right" : "text-left",
                      column.widthClass,
                    )}
                  >
                    {isEntitiesMasterFilterableColumn(column.id) ? (
                      <EntitiesTableColumnHeaderFilter
                        column={column}
                        entities={filteredEntities}
                        filters={masterFilters}
                        onTextChange={handleMasterTextChange}
                        onMultiChange={handleMasterMultiChange}
                        onNumericChange={handleMasterNumericChange}
                      />
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedEntities.map((entity) => (
                <tr
                  key={entity.id}
                  className="border-t border-slate-300/80 dark:border-white/15"
                >
                  {ENTITIES_TABLE_COLUMNS.map((column) => {
                    if (column.id === "actions") {
                      return (
                        <td
                          key={column.id}
                          className={cn("px-4 py-3", column.widthClass)}
                        >
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(entity)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(entity)}
                              disabled={deleteMutation.isPending}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-60 dark:border-red-900"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      );
                    }

                    if (column.id === "parent") {
                      return (
                        <td
                          key={column.id}
                          className={cn(
                            "px-4 py-3 text-text-primary",
                            column.widthClass,
                          )}
                        >
                          {entity.parentName ? (
                            <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
                              {entity.parentCategoryCode ? (
                                <span className="text-xs font-medium text-foreground/55">
                                  {entity.parentCategoryCode}
                                </span>
                              ) : null}
                              <span>{entity.parentName}</span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    }

                    if (column.id === "name") {
                      return (
                        <td
                          key={column.id}
                          className={cn(
                            "truncate px-4 py-3 font-medium text-text-primary",
                            column.widthClass,
                          )}
                          title={entity.name}
                        >
                          {entity.name}
                        </td>
                      );
                    }

                    if (column.id === "staff") {
                      return (
                        <td
                          key={column.id}
                          className={cn(
                            "px-4 py-3 text-right tabular-nums text-text-primary",
                            column.widthClass,
                          )}
                        >
                          {entity.staffCount}
                        </td>
                      );
                    }

                    return (
                      <td
                        key={column.id}
                        className={cn(
                          "px-4 py-3 text-text-primary",
                          column.align === "right" && "text-right",
                          column.widthClass,
                        )}
                      >
                        {column.getValue(entity)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
