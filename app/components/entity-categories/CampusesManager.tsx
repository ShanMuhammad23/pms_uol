"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Plus, Table2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { createCampus, fetchCampuses } from "@/lib/queries/campuses-client";
import type { CampusRecord } from "@/types/campuses";

type MessageTone = "success" | "error";

interface FormMessage {
  tone: MessageTone;
  text: string;
}

type CampusSectionTab = "list" | "add";

interface CampusFormState {
  name: string;
  code: string;
}

const emptyForm: CampusFormState = {
  name: "",
  code: "",
};

export default function CampusesManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CampusFormState>(emptyForm);
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  const [activeTab, setActiveTab] = useState<CampusSectionTab>("list");

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
        text: `Campus "${campus.name}" created successfully.`,
      });
      resetForm();
      invalidateList();
      setActiveTab("list");
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const isSubmitting = createMutation.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);
    createMutation.mutate({
      name: form.name.trim(),
      code: form.code.trim(),
      isActive: true,
    });
  };

  const handleSwitchTab = (tab: CampusSectionTab) => {
    setActiveTab(tab);
    setFormMessage(null);
    if (tab === "add") {
      resetForm();
    }
  };

  const renderFormCard = () => (
    <div className="rounded-md border border-slate-300/80 p-6 dark:border-white/15">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Add Campus</h2>
        <p className="mt-1 text-sm text-foreground/70">
          Create a new campus. Entities assigned to this campus will appear under
          it in the organization tree.
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
        >
          <Plus className="size-4" />
          Add Campus
        </button>
      </form>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-300/80 dark:border-white/15">
        <nav
          aria-label="Campus section tabs"
          className="-mb-px flex gap-1"
        >
          {(
            [
              { id: "list", label: "Campuses", icon: Table2 },
              { id: "add", label: "Add Campus", icon: Plus },
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

      {activeTab === "add" ? renderFormCard() : null}

      {isLoading ? (
        <div className="rounded-md border border-slate-300/80 p-8 text-sm text-foreground/70 dark:border-white/15">
          Loading campuses...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Failed to load campuses.
        </div>
      ) : null}

      {!isLoading && !error && (!campuses || campuses.length === 0) ? (
        <div className="rounded-md border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
          <Building2 className="mx-auto size-8 text-foreground/50" />
          <p className="mt-3 text-sm font-medium text-text-primary">
            No campuses yet
          </p>
          <p className="mt-1 text-sm text-foreground/70">
            Add your first campus from the Add Campus tab.
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
