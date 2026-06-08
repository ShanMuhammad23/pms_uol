"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import IncrementMatrixGrid from "../IncrementMatrixGrid";
import WorkflowStepper from "../WorkflowStepper";
import { createAppraisalCycle } from "@/lib/queries/forms-client";
import type {
  AppraisalCycleRecord,
  IncrementMatrixInput,
} from "@/types/forms";
import { Button } from "@/app/components/auth/Button";

interface ProcedureSetupStepProps {
  cycles: AppraisalCycleRecord[];
  cycleId: number | null;
  incrementMatrices: IncrementMatrixInput[];
  errors: Record<string, string>;
  onCycleChange: (cycleId: number) => void;
  onMatricesChange: (matrices: IncrementMatrixInput[]) => void;
  onCycleCreated: (cycle: AppraisalCycleRecord) => void;
}

export default function ProcedureSetupStep({
  cycles,
  cycleId,
  incrementMatrices,
  errors,
  onCycleChange,
  onMatricesChange,
  onCycleCreated,
}: ProcedureSetupStepProps) {
  const [showCreateCycle, setShowCreateCycle] = useState(cycles.length === 0);
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const createCycleMutation = useMutation({
    mutationFn: createAppraisalCycle,
    onSuccess: (cycle) => {
      onCycleCreated(cycle);
      onCycleChange(cycle.id);
      setShowCreateCycle(false);
      setCreateError(null);
    },
    onError: (error: Error) => {
      setCreateError(error.message);
    },
  });

  const handleCreateCycle = () => {
    if (!fiscalYear || !startDate || !endDate) {
      setCreateError("Fiscal year, start date, and end date are required.");
      return;
    }

    createCycleMutation.mutate({
      fiscalYear: Number(fiscalYear),
      startDate,
      endDate,
      isActive: true,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          Procedure Setup
        </h2>
        <p className="mt-1 text-sm text-foreground/70">
          Link this form to an appraisal cycle, configure increment percentages,
          and review the workflow.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-300/80 bg-surface p-4 dark:border-white/15">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Appraisal Cycle
          </h3>
          <button
            type="button"
            onClick={() => setShowCreateCycle((current) => !current)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {showCreateCycle ? "Use existing cycle" : "Create new cycle"}
          </button>
        </div>

        {showCreateCycle ? (
          <div className="grid gap-3 md:grid-cols-3">
            <input
              type="number"
              value={fiscalYear}
              onChange={(event) => setFiscalYear(event.target.value)}
              placeholder="Fiscal year"
              className="h-10 rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
            />
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
            />
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
            />
            <div className="md:col-span-3">
              <Button
                type="button"
                className="!w-auto px-4"
                isLoading={createCycleMutation.isPending}
                onClick={handleCreateCycle}
              >
                Create Cycle
              </Button>
              {createError ? (
                <p className="mt-2 text-xs text-red-600">{createError}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div>
            <select
              value={cycleId ?? ""}
              onChange={(event) => onCycleChange(Number(event.target.value))}
              className="h-11 w-full rounded-lg border border-slate-300 bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15"
            >
              <option value="">Select appraisal cycle</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  FY {cycle.fiscalYear} ({cycle.startDate} to {cycle.endDate})
                </option>
              ))}
            </select>
            {errors.cycleId ? (
              <p className="mt-1 text-xs text-red-600">{errors.cycleId}</p>
            ) : null}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          Increment Matrix
        </h3>
        <p className="text-xs text-foreground/70">
          Set recommended increment percentages by performance rating and
          quartile.
        </p>
        <IncrementMatrixGrid
          matrices={incrementMatrices}
          onChange={onMatricesChange}
        />
      </div>

      <WorkflowStepper />
    </div>
  );
}
