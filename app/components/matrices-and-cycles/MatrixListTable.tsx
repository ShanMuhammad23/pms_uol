"use client";

import { Grid3X3 } from "lucide-react";
import MatrixActionsDropdown from "./MatrixActionsDropdown";

export interface MatrixListRow {
  financialYearId: number;
  financialYearLabel: string;
  isActiveYear: boolean;
  matrixLabel: string;
  title: string;
  assignedEmployeeCount: number;
  updatedAt: string;
  metricLabel: string;
  metricValue: number;
  secondaryMetricLabel?: string;
  secondaryMetricValue?: number;
}

interface MatrixListTableProps {
  rows: MatrixListRow[];
  isLoading: boolean;
  error: boolean;
  emptyTitle: string;
  emptyDescription: string;
  createLabel: string;
  onCreate: () => void;
  onEdit: (row: MatrixListRow) => void;
  onCopy: (row: MatrixListRow) => void;
  onAssign: (row: MatrixListRow) => void;
  onDelete: (row: MatrixListRow) => void;
  deletePending?: boolean;
  copyPending?: boolean;
}

export default function MatrixListTable({
  rows,
  isLoading,
  error,
  emptyTitle,
  emptyDescription,
  createLabel,
  onCreate,
  onEdit,
  onCopy,
  onAssign,
  onDelete,
  deletePending = false,
  copyPending = false,
}: MatrixListTableProps) {
  if (isLoading && rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-400">
        Loading matrices...
      </div>
    );
  }

  if (error && rows.length === 0) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Failed to load matrices.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm dark:border-white/10 dark:bg-slate-900">
        <Grid3X3 className="mx-auto size-8 text-slate-300 dark:text-slate-600" />
        <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
          {emptyTitle}
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {emptyDescription}
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          {createLabel}
        </button>
      </div>
    );
  }

  const showSecondary = rows.some((row) => row.secondaryMetricLabel);

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white dark:border-neutral-700 dark:bg-slate-900">
      <table className="min-w-full">
        <thead className="whitespace-nowrap bg-primary text-left text-sm font-semibold text-white">
          <tr className="divide-x divide-white/15">
            <th className="px-4 py-3.5">Title</th>
            <th className="w-1/16 px-2 py-2 text-center">Assigned</th>
            <th className="w-4/16 px-4 py-3.5 text-center">Cycle</th>
            <th className="w-1/16 px-4 py-3.5 text-center">
              {rows[0]?.metricLabel ?? "Items"}
            </th>
            {showSecondary ? (
              <th className="w-1/16 px-4 py-3.5 text-center">
                {rows[0]?.secondaryMetricLabel}
              </th>
            ) : null}
            <th className="px-4 py-3.5 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm dark:divide-neutral-700">
          {rows.map((row) => (
            <tr
              key={`${row.financialYearId}:${row.matrixLabel}`}
              className="divide-x divide-slate-200 dark:divide-neutral-700"
            >
              <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-50">
                <button
                  type="button"
                  onClick={() => onEdit(row)}
                  className="text-left font-semibold text-primary hover:underline dark:text-sky-300"
                >
                  <span className="block whitespace-nowrap">{row.title}</span>
                  {row.title !== row.matrixLabel ? (
                    <span className="mt-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      {row.matrixLabel}
                    </span>
                  ) : null}
                </button>
              </td>
              <td className="px-2 py-2 text-center text-slate-700 dark:text-slate-300">
                {row.assignedEmployeeCount}
              </td>
              <td className="px-4 py-4 text-center text-slate-700 dark:text-slate-300">
                {row.financialYearLabel}
                {row.isActiveYear ? (
                  <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">
                    Active
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-4 text-center text-slate-700 dark:text-slate-300">
                {row.metricValue}
              </td>
              {showSecondary ? (
                <td className="px-4 py-4 text-center text-slate-700 dark:text-slate-300">
                  {row.secondaryMetricValue ?? 0}
                </td>
              ) : null}
    
              <td className="px-4 py-4 text-center whitespace-nowrap">
                <MatrixActionsDropdown
                  matrixLabel={row.matrixLabel}
                  onEdit={() => onEdit(row)}
                  onCopy={() => onCopy(row)}
                  onAssign={() => onAssign(row)}
                  onDelete={() => onDelete(row)}
                  deletePending={deletePending}
                  copyPending={copyPending}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
