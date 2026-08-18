"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarRange, Pencil, Plus, Table2, Trash2, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
  createFinancialYear,
  deleteFinancialYear,
  fetchFinancialYears,
  updateFinancialYear,
} from "@/lib/queries/financial-years-client";
import type { FinancialYearRecord } from "@/types/financial-years";

type MessageTone = "success" | "error";

interface FormMessage {
  tone: MessageTone;
  text: string;
}

type FinancialYearSectionTab = "list" | "add";

export default function FinancialYearsManager() {
  const queryClient = useQueryClient();
  const [year, setYear] = useState("");
  const [label, setLabel] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [editingYear, setEditingYear] = useState<FinancialYearRecord | null>(
    null,
  );
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  const [activeTab, setActiveTab] = useState<FinancialYearSectionTab>("list");

  const { data, isLoading, error } = useQuery({
    queryKey: ["financial-years"],
    queryFn: fetchFinancialYears,
  });

  const resetForm = () => {
    setYear("");
    setLabel("");
    setIsActive(false);
    setEditingYear(null);
  };

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: ["financial-years"] });
  };

  const createMutation = useMutation({
    mutationFn: createFinancialYear,
    onSuccess: (record) => {
      setFormMessage({
        tone: "success",
        text: `Financial year "${record.label}" created successfully.`,
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
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: { year: number; label: string; isActive: boolean };
    }) => updateFinancialYear(id, input),
    onSuccess: (record) => {
      setFormMessage({
        tone: "success",
        text: `Financial year "${record.label}" updated successfully.`,
      });
      resetForm();
      invalidateList();
      setActiveTab("list");
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFinancialYear,
    onSuccess: () => {
      setFormMessage({
        tone: "success",
        text: "Financial year deleted successfully.",
      });
      if (editingYear) {
        resetForm();
      }
      invalidateList();
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);

    const parsedYear = Number(year);

    if (!Number.isInteger(parsedYear)) {
      setFormMessage({ tone: "error", text: "Year must be a valid integer." });
      return;
    }

    if (!label.trim()) {
      setFormMessage({ tone: "error", text: "Label is required." });
      return;
    }

    const payload = {
      year: parsedYear,
      label: label.trim(),
      isActive,
    };

    if (editingYear) {
      updateMutation.mutate({ id: editingYear.id, input: payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const handleEdit = (record: FinancialYearRecord) => {
    setEditingYear(record);
    setYear(String(record.year));
    setLabel(record.label);
    setIsActive(record.isActive);
    setFormMessage(null);
    setActiveTab("add");
  };

  const handleDelete = (record: FinancialYearRecord) => {
    const confirmed = window.confirm(
      `Delete financial year "${record.label}"?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setFormMessage(null);
    deleteMutation.mutate(record.id);
  };

  const handleCancelEdit = () => {
    resetForm();
    setFormMessage(null);
    setActiveTab("list");
  };

  const handleSwitchTab = (tab: FinancialYearSectionTab) => {
    setActiveTab(tab);
    setFormMessage(null);
    if (tab === "add") {
      resetForm();
    }
  };

  const renderFormCard = () => (
    <div className="rounded-md border border-slate-300/80 p-6 dark:border-white/15">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            {editingYear ? "Edit Financial Year" : "Add Financial Year"}
          </h2>
          <p className="mt-1 text-sm text-foreground/70">
            Define financial years used to scope performance levels and
            quartile matrices.
          </p>
        </div>

        {editingYear ? (
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

      <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="financial-year"
            className="mb-1.5 block text-sm font-medium text-text-primary"
          >
            Year
          </label>
          <input
            id="financial-year"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(event) => setYear(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
            placeholder="2025"
          />
        </div>

        <div>
          <label
            htmlFor="financial-year-label"
            className="mb-1.5 block text-sm font-medium text-text-primary"
          >
            Label
          </label>
          <input
            id="financial-year-label"
            type="text"
            maxLength={20}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
            placeholder="FY 2024-25"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-text-primary">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="size-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-white/15"
            />
            Set as active financial year
          </label>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {editingYear ? (
              <>
                <Pencil className="size-4" />
                Update Financial Year
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Add Financial Year
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-300/80 dark:border-white/15">
        <nav
          aria-label="Financial year section tabs"
          className="-mb-px flex gap-1"
        >
          {(
            [
              { id: "list", label: "Financial Years", icon: Table2 },
              { id: "add", label: "Add Financial Year", icon: Plus },
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

      {activeTab === "list" && isLoading ? (
        <div className="rounded-md border border-slate-300/80 p-8 text-sm text-foreground/70 dark:border-white/15">
          Loading financial years...
        </div>
      ) : null}

      {activeTab === "list" && error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Failed to load financial years.
        </div>
      ) : null}

      {activeTab === "list" &&
      !isLoading &&
      !error &&
      (!data || data.length === 0) ? (
        <div className="rounded-md border border-dashed border-slate-300/80 px-6 py-12 text-center dark:border-white/15">
          <CalendarRange className="mx-auto size-8 text-foreground/50" />
          <p className="mt-3 text-sm font-medium text-text-primary">
            No financial years yet
          </p>
          <p className="mt-1 text-sm text-foreground/70">
            Add your first financial year from the Add Financial Year tab.
          </p>
        </div>
      ) : null}

      {activeTab === "list" && !isLoading && !error && data && data.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-slate-300/80 dark:border-white/15">
          <table className="min-w-full text-sm">
            <thead className="bg-primary text-white">
              <tr>
                <th className="px-4 py-3 text-left font-semibold ">
                  Year
                </th>
                <th className="px-4 py-3 text-left font-semibold ">
                  Label
                </th>
                <th className="px-4 py-3 text-left font-semibold ">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-semibold ">
                  Created
                </th>
                <th className="px-4 py-3 text-right font-semibold ">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((record) => (
                <tr
                  key={record.id}
                  className="border-t border-slate-300/80 dark:border-white/15"
                >
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {record.year}
                  </td>
                  <td className="px-4 py-3 text-text-primary">{record.label}</td>
                  <td className="px-4 py-3">
                    {record.isActive ? (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        Active
                      </span>
                    ) : (
                      <span className="text-foreground/70">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {new Date(record.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(record)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(record)}
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
