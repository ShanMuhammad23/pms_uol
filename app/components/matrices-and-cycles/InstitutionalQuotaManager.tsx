"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Percent, Save } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { fetchFinancialYears } from "@/lib/queries/financial-years-client";
import {
  fetchInstitutionalQuotas,
  upsertInstitutionalQuotas,
} from "@/lib/queries/institutional-quotas-client";
import type { InstitutionalQuotaRecord } from "@/types/institutional-quotas";
import {
  PERFORMANCE_RATINGS,
  RATING_LABELS,
  type PerformanceRating,
} from "@/types/forms";

type MessageTone = "success" | "error";

interface FormMessage {
  tone: MessageTone;
  text: string;
}

type QuotaDraft = Record<PerformanceRating, string>;

const DEFAULT_QUOTAS: Record<PerformanceRating, number> = {
  UNSATISFACTORY: 5,
  IMPROVEMENT_NEEDED: 10,
  STRONG: 25,
  EXCELLENT: 20,
  OUTSTANDING: 5,
};

function emptyDraft(): QuotaDraft {
  return PERFORMANCE_RATINGS.reduce((acc, rating) => {
    acc[rating] = String(DEFAULT_QUOTAS[rating]);
    return acc;
  }, {} as QuotaDraft);
}

export default function InstitutionalQuotaManager() {
  const queryClient = useQueryClient();
  const [selectedYearOverride, setSelectedFinancialYearId] = useState<
    number | null
  >(null);
  const [draft, setDraft] = useState<QuotaDraft>(emptyDraft);
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  const [syncedQuotas, setSyncedQuotas] = useState<
    InstitutionalQuotaRecord[] | undefined
  >(undefined);

  const { data: financialYears, isLoading: yearsLoading } = useQuery({
    queryKey: ["financial-years"],
    queryFn: fetchFinancialYears,
  });

  const selectedFinancialYearId =
    selectedYearOverride ??
    financialYears?.find((year) => year.isActive)?.id ??
    financialYears?.[0]?.id ??
    null;

  const {
    data: quotas,
    isLoading: quotasLoading,
    error: quotasError,
  } = useQuery({
    queryKey: ["institutional-quotas", selectedFinancialYearId],
    queryFn: () => fetchInstitutionalQuotas(selectedFinancialYearId!),
    enabled: selectedFinancialYearId !== null,
  });

  if (quotas !== syncedQuotas) {
    setSyncedQuotas(quotas);
    if (quotas) {
      if (quotas.length === 0) {
        setDraft(emptyDraft());
      } else {
        const next = emptyDraft();
        quotas.forEach((row) => {
          next[row.rating] = String(row.quotaPercent);
        });
        setDraft(next);
      }
    }
  }

  const totalPercent = useMemo(
    () =>
      PERFORMANCE_RATINGS.reduce((sum, rating) => {
        const value = Number(draft[rating]);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [draft],
  );

  const saveMutation = useMutation({
    mutationFn: upsertInstitutionalQuotas,
    onSuccess: (saved) => {
      setFormMessage({
        tone: "success",
        text: "quotas saved successfully.",
      });
      queryClient.setQueryData(
        ["institutional-quotas", selectedFinancialYearId],
        saved,
      );
      queryClient.invalidateQueries({ queryKey: ["institutional-quotas"] });
      queryClient.invalidateQueries({ queryKey: ["institutional-quota-chart"] });
    },
    onError: (mutationError: Error) => {
      setFormMessage({ tone: "error", text: mutationError.message });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFormMessage(null);

    if (selectedFinancialYearId === null) {
      setFormMessage({
        tone: "error",
        text: "Select a financial year first.",
      });
      return;
    }

    const payload = PERFORMANCE_RATINGS.map((rating, index) => {
      const quotaPercent = Number(draft[rating]);
      return {
        rating,
        quotaPercent,
        sortOrder: index,
      };
    });

    for (const row of payload) {
      if (
        !Number.isFinite(row.quotaPercent) ||
        row.quotaPercent < 0 ||
        row.quotaPercent > 100
      ) {
        setFormMessage({
          tone: "error",
          text: `Quota for ${RATING_LABELS[row.rating]} must be between 0 and 100.`,
        });
        return;
      }
    }

    saveMutation.mutate({
      financialYearId: selectedFinancialYearId,
      quotas: payload,
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-300/80 bg-surface p-6 dark:border-white/15">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-primary">
              <Percent className="size-5" />
              <h2 className="text-lg font-semibold text-text-primary">
                Quota
              </h2>
            </div>
            <p className="mt-1 text-sm text-foreground/70">
              Set the target percentage distribution by rating for the selected
              financial year. These values drive the dashboard Calibration vs Quota
              chart.
            </p>
          </div>
        </div>

        <div className="mt-5 max-w-sm">
          <label
            htmlFor="quota-financial-year"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/70"
          >
            Financial Year
          </label>
          <select
            id="quota-financial-year"
            value={selectedFinancialYearId ?? ""}
            disabled={yearsLoading || !financialYears?.length}
            onChange={(event) => {
              setFormMessage(null);
              setSelectedFinancialYearId(
                event.target.value ? Number(event.target.value) : null,
              );
            }}
            className="h-11 w-full rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 dark:border-white/15"
          >
            {!financialYears?.length ? (
              <option value="">No financial years</option>
            ) : (
              financialYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label}
                  {year.isActive ? " (Active)" : ""}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {formMessage ? (
        <p
          className={
            formMessage.tone === "success"
              ? "text-sm text-emerald-600"
              : "text-sm text-red-600"
          }
        >
          {formMessage.text}
        </p>
      ) : null}

      {quotasLoading ? (
        <p className="text-sm text-foreground/70">Loading quotas...</p>
      ) : quotasError ? (
        <p className="text-sm text-red-600">Failed to load quotas.</p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-xl border border-slate-300/80 bg-surface dark:border-white/15"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Rating
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Quota %
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {PERFORMANCE_RATINGS.map((rating) => (
                  <tr key={rating}>
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {RATING_LABELS[rating]}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={draft[rating]}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            [rating]: event.target.value,
                          }))
                        }
                        className="ml-auto h-10 w-28 rounded-lg border border-slate-300 bg-background px-3 text-right text-sm tabular-nums text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40">
                  <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Total
                  </td>
                  <td
                    className={`px-4 py-3 text-right text-sm font-semibold tabular-nums ${
                      Math.abs(totalPercent - 100) < 0.01
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }`}
                  >
                    {totalPercent.toFixed(2)}%
                    {Math.abs(totalPercent - 100) >= 0.01
                      ? " (should usually total 100)"
                      : ""}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-white/10">
            <p className="text-xs text-foreground/60">
              {quotas && quotas.length === 0
                ? "No saved quotas for this year yet. Defaults are prefilled — click Save to persist."
                : "Changes apply to the selected financial year only."}
            </p>
            <button
              type="submit"
              disabled={saveMutation.isPending || selectedFinancialYearId === null}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              <Save className="size-4" />
              {saveMutation.isPending ? "Saving..." : "Save Quotas"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
