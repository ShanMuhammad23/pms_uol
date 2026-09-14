"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Pencil, Plus, Table2, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
  createCampus,
  deleteCampus,
  fetchCampuses,
  updateCampus,
} from "@/lib/queries/campuses-client";
import type { CampusRecord } from "@/types/campuses";

type MessageTone = "success" | "error";

interface FormMessage {
  tone: MessageTone;
  text: string;
}

type CampusSectionTab = "list" | "add" | "edit";

interface CampusFormState {
  name: string;
  code: string;
  isActive: boolean;
}

const emptyForm: CampusFormState = {
  name: "",
  code: "",
  isActive: true,
};

export default function CampusesManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CampusFormState>(emptyForm);
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  const [activeTab, setActiveTab] = useState<CampusSectionTab>("list");
  const [editingCampus, setEditingCampus] = useState<CampusRecord | null>(null);
  const [deletingCampus, setDeletingCampus] = useState<CampusRecord | null>(null);

  const { data: campuses, isLoading, error } = useQuery({
    queryKey: ["campuses"],
    queryFn: fetchCampuses,
  });

  const resetForm = () => {
    setForm(emptyForm);
  };

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: ["campuses"] });
  };

  const createMutation = useMutation({
    mutationFn: createCampus,
    onSuccess: (campus) => {
      setFormMessage({
        tone: "success",
        text: `Site "${campus.name}" created successfully.`,
      });
      resetForm();
      invalidateList();
      setActiveTab("list");
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: number; data: CampusFormState }) =>
      updateCampus(input.id, {
        name: input.data.name.trim(),
        code: input.data.code.trim(),
        isActive: input.data.isActive,
      }),
    onSuccess: (campus) => {
      setFormMessage({
        tone: "success",
        text: `Site "${campus.name}" updated successfully.`,
      });
      resetForm();
      setEditingCampus(null);
      invalidateList();
      setActiveTab("list");
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCampus,
    onSuccess: () => {
      setFormMessage({
        tone: "success",
        text: `Site "${deletingCampus?.name ?? ""}" deleted successfully.`,
      });
      setDeletingCampus(null);
      invalidateList();
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
      setDeletingCampus(null);
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);
    if (activeTab === "edit" && editingCampus) {
      updateMutation.mutate({ id: editingCampus.id, data: form });
    } else {
      createMutation.mutate({
        name: form.name.trim(),
        code: form.code.trim(),
        isActive: form.isActive,
      });
    }
  };

  const handleSwitchTab = (tab: CampusSectionTab) => {
    setActiveTab(tab);
    setFormMessage(null);
    if (tab === "add") {
      resetForm();
      setEditingCampus(null);
    }
  };

  const handleEdit = (campus: CampusRecord) => {
    setEditingCampus(campus);
    setForm({
      name: campus.name,
      code: campus.code,
      isActive: campus.isActive,
    });
    setFormMessage(null);
    setActiveTab("edit");
  };

  const handleDeleteClick = (campus: CampusRecord) => {
    setDeletingCampus(campus);
  };

  const handleDeleteConfirm = () => {
    if (!deletingCampus) return;
    deleteMutation.mutate(deletingCampus.id);
  };

  const handleDeleteCancel = () => {
    setDeletingCampus(null);
  };

  const renderFormCard = (mode: "add" | "edit") => (
    <div className="rounded-md border border-slate-300/80 p-6 dark:border-white/15">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          {mode === "add" ? "Add Site" : "Edit Site"}
        </h2>
        <p className="mt-1 text-sm text-foreground/70">
          {mode === "add"
            ? "Create a new site. Entities assigned to this site will appear under it in the organization tree."
            : `Update the details for "${editingCampus?.name ?? ""}".`}
        </p>
      </div>

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

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="campus-name"
            className="mb-1.5 block text-sm font-medium text-text-primary"
          >
            Name
          </label>
          <input
            id="campus-name"
            type="text"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            maxLength={150}
            required
            placeholder="e.g. Sargodha"
            className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
          />
        </div>

        <div>
          <label
            htmlFor="campus-code"
            className="mb-1.5 block text-sm font-medium text-text-primary"
          >
            Code
          </label>
          <input
            id="campus-code"
            type="text"
            value={form.code}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                code: event.target.value.toUpperCase(),
              }))
            }
            maxLength={10}
            required
            placeholder="e.g. SGD"
            className="w-full max-w-xs rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
          />
          <p className="mt-1.5 text-xs text-foreground/70">
            A short unique code (max 10 characters). Will be stored in uppercase.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">
            Status
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
              className="size-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-white/15"
            />
            <span className="text-sm text-text-primary">
              Active (visible in assignment dropdowns)
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {mode === "add" ? (
              <>
                <Plus className="size-4" />
                Add Site
              </>
            ) : (
              <>
                <Pencil className="size-4" />
                Save Changes
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setEditingCampus(null);
              setFormMessage(null);
              setActiveTab("list");
            }}
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-300/80 dark:border-white/15">
        <nav
          aria-label="Site section tabs"
          className="-mb-px flex gap-1"
        >
          {(
            [
              { id: "list", label: "Sites", icon: Table2 },
              { id: "add", label: "Add Site", icon: Plus },
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
          {activeTab === "edit" ? (
            <span className="inline-flex items-center gap-2 border-b-2 border-primary px-4 py-3 text-sm font-medium text-primary">
              <Pencil className="size-4" />
              Edit Site
            </span>
          ) : null}
        </nav>
      </div>

      {activeTab === "add" ? renderFormCard("add") : null}
      {activeTab === "edit" ? renderFormCard("edit") : null}

      {isLoading ? (
        <div className="rounded-md border border-slate-300/80 p-8 text-sm text-foreground/70 dark:border-white/15">
          Loading sites...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Failed to load sites.
        </div>
      ) : null}

      {!isLoading && !error && (!campuses || campuses.length === 0) ? (
        <div className="rounded-md border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
          <Building2 className="mx-auto size-8 text-foreground/50" />
          <p className="mt-3 text-sm font-medium text-text-primary">
            No sites yet
          </p>
          <p className="mt-1 text-sm text-foreground/70">
            Add your first site from the Add Site tab.
          </p>
        </div>
      ) : null}

      {!isLoading && !error && campuses && campuses.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-slate-300/80 dark:border-white/15">
          <table className="min-w-full text-sm">
            <thead className="bg-primary text-white">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Code</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">
                  Created At
                </th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campuses.map((campus: CampusRecord) => (
                <tr
                  key={campus.id}
                  className="border-t border-slate-300/80 dark:border-white/15"
                >
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {campus.name}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                      {campus.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {campus.isActive ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {new Date(campus.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(campus)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(campus)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
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

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {deletingCampus ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={handleDeleteCancel}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-lg border border-slate-300 bg-background p-6 shadow-xl dark:border-white/15"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                  <Trash2 className="size-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    Delete Site
                  </h3>
                  <p className="mt-1 text-sm text-foreground/70">
                    Are you sure you want to delete{" "}
                    <span className="font-semibold text-text-primary">
                      {deletingCampus.name}
                    </span>{" "}
                    ({deletingCampus.code})? This action cannot be undone.
                  </p>
                  <p className="mt-2 text-xs text-foreground/60">
                    If any entities are assigned to this site, you must reassign
                    them first.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleDeleteCancel}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleteMutation.isPending ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
