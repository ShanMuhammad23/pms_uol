"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  assignFormTemplateToEmployees,
  fetchFormTemplateAssignments,
} from "@/lib/queries/forms-client";
import { fetchUsers } from "@/lib/queries/users-client";

interface FormEmployeeAssignmentProps {
  templateId: number;
  templateTitle: string;
}

export default function FormEmployeeAssignment({
  templateId,
  templateTitle,
}: FormEmployeeAssignmentProps) {
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const { data: users } = useQuery({
    queryKey: ["users-for-form-assignment"],
    queryFn: fetchUsers,
  });

  const { data: assignedEmployees, refetch } = useQuery({
    queryKey: ["form-assigned-employees", templateId],
    queryFn: () => fetchFormTemplateAssignments(templateId),
  });

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return users ?? [];
    }
    return (users ?? []).filter((user) => {
      const name = `${user.firstName} ${user.lastName}`.toLowerCase();
      return (
        user.employeeId.toLowerCase().includes(query) ||
        name.includes(query)
      );
    });
  }, [search, users]);

  const assignMutation = useMutation({
    mutationFn: (employeeIds: string[]) =>
      assignFormTemplateToEmployees(templateId, employeeIds),
    onSuccess: async (result) => {
      setMessage(`Assigned form to ${result.assignedCount} employees.`);
      setIsError(false);
      setSelectedEmployeeIds([]);
      await refetch();
    },
    onError: (error: Error) => {
      setIsError(true);
      setMessage(error.message);
    },
  });

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/50">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Assign Employees</h2>
        <p className="mt-1 text-sm text-foreground/70">
          Select one or more employees to assign the form: <span className="font-medium">{templateTitle}</span>
        </p>
      </div>

      {message ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            isError
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"
          }`}
        >
          {message}
        </div>
      ) : null}

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by SAP or name"
        className="w-full rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
      />

      <select
        multiple
        value={selectedEmployeeIds}
        onChange={(event) => {
          const values = Array.from(event.currentTarget.selectedOptions).map(
            (option) => option.value,
          );
          setSelectedEmployeeIds(values);
        }}
        className="min-h-64 w-full rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
      >
        {filteredUsers.map((user) => (
          <option key={user.id} value={user.employeeId}>
            {user.employeeId} - {`${user.firstName} ${user.lastName}`.trim()}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={selectedEmployeeIds.length === 0 || assignMutation.isPending}
        onClick={() => {
          setMessage(null);
          assignMutation.mutate(selectedEmployeeIds);
        }}
        className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
      >
        Assign Selected Employees
      </button>

      <div>
        <h3 className="text-sm font-semibold text-text-primary">Currently Assigned</h3>
        <p className="mt-1 text-xs text-foreground/60">
          {assignedEmployees?.length ?? 0} employee(s) currently mapped to this form.
        </p>
      </div>
    </div>
  );
}

