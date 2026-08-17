"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, Filter, RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  MultiSelectFilterDropdown,
  type MultiSelectOption,
} from "@/app/components/dashboard/MultiSelectFilterDropdown";
import { DASHBOARD_QUERY_CACHE } from "@/app/queries/query-cache";
import { queryKeys } from "@/app/queries/keys";
import { fetchUsers } from "@/lib/queries/users-client";
import { cn } from "@/lib/utils";
import type { UserRecord } from "@/types/users";

const PAGE_SIZE = 50;

type FilterId =
  | "entityName"
  | "designation"
  | "roleCategory"
  | "headName"
  | "manager2Name"
  | "assignmentStatus";

type FilterSelection = string[] | null;
type FilterState = Record<FilterId, FilterSelection>;

const FILTER_CONFIG: { id: FilterId; label: string }[] = [
  { id: "assignmentStatus", label: "Assignment Status" },
  { id: "entityName", label: "Entity" },
  { id: "designation", label: "Designation" },
  { id: "roleCategory", label: "Role Category" },
  { id: "headName", label: "Manager 1" },
  { id: "manager2Name", label: "Manager 2" },
];

const EMPTY_FILTERS: FilterState = {
  assignmentStatus: null,
  entityName: null,
  designation: null,
  roleCategory: null,
  headName: null,
  manager2Name: null,
};

const USER_COLUMNS: {
  id: string;
  label: string;
  width?: number;
  getValue: (user: UserRecord) => string;
}[] = [
  { id: "employeeId", label: "SAP Code", width: 120, getValue: (user) => user.employeeId },
  {
    id: "name",
    label: "Employee Name",
    width: 200,
    getValue: (user) => `${user.firstName} ${user.lastName}`.trim(),
  },
  { id: "designation", label: "Designation", width: 180, getValue: (user) => user.designation ?? "—" },
  { id: "entityName", label: "Entity", width: 160, getValue: (user) => user.entityName ?? "—" },
  { id: "roleCategory", label: "Role Category", width: 150, getValue: (user) => user.roleCategory ?? "—" },
  { id: "headName", label: "Manager 1", width: 160, getValue: (user) => user.headName ?? "—" },
  { id: "manager2Name", label: "Manager 2", width: 160, getValue: (user) => user.manager2Name ?? "—" },
];

const STICKY_SHADOW_LEFT =
  "shadow-[6px_0_12px_-8px_rgba(15,23,42,0.2)] dark:shadow-[6px_0_12px_-8px_rgba(0,0,0,0.5)]";

export interface MatrixAssignmentRow {
  employeeId: string;
  matrixLabel: string;
}

interface MatrixEmployeeAssignmentProps {
  targetLabel: string;
  description: string;
  assignments: MatrixAssignmentRow[];
  disabled?: boolean;
  onAssign: (employeeIds: string[]) => Promise<{ assignedCount: number }>;
  onUnassign: (employeeIds: string[]) => Promise<{ unassignedCount: number }>;
  onSettled?: () => void;
}

function getAssignmentStatus(
  user: UserRecord,
  assignedLabelByEmployeeId: Map<string, string>,
  targetLabel: string,
): string {
  const assignedLabel = assignedLabelByEmployeeId.get(user.employeeId);
  if (!assignedLabel) {
    return "Unassigned";
  }
  return assignedLabel === targetLabel ? "Assigned" : "Assigned elsewhere";
}

function buildOptions(
  users: UserRecord[],
  field: FilterId,
  filters: FilterState,
  selected: FilterSelection,
  assignedLabelByEmployeeId: Map<string, string>,
  targetLabel: string,
): MultiSelectOption[] {
  const counts = new Map<string, number>();

  for (const user of users) {
    let passesOtherFilters = true;
    for (const filter of FILTER_CONFIG) {
      if (filter.id === field) continue;
      const sel = filters[filter.id];
      if (sel === null || sel === undefined) continue;
      if (sel.length === 0) {
        passesOtherFilters = false;
        break;
      }
      const val =
        filter.id === "assignmentStatus"
          ? getAssignmentStatus(user, assignedLabelByEmployeeId, targetLabel)
          : String(user[filter.id] ?? "—");
      if (!sel.includes(val)) {
        passesOtherFilters = false;
        break;
      }
    }
    if (!passesOtherFilters) continue;

    const value =
      field === "assignmentStatus"
        ? getAssignmentStatus(user, assignedLabelByEmployeeId, targetLabel)
        : String(user[field] ?? "—");
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  if (selected) {
    for (const value of selected) {
      if (!counts.has(value)) {
        counts.set(value, 0);
      }
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => {
      if (a.value === "—") return 1;
      if (b.value === "—") return -1;
      return a.label.localeCompare(b.label, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

function userMatchesFilters(
  user: UserRecord,
  filters: FilterState,
  assignedLabelByEmployeeId: Map<string, string>,
  targetLabel: string,
): boolean {
  for (const filter of FILTER_CONFIG) {
    const sel = filters[filter.id];
    if (sel === null || sel === undefined) continue;
    if (sel.length === 0) return false;
    const val =
      filter.id === "assignmentStatus"
        ? getAssignmentStatus(user, assignedLabelByEmployeeId, targetLabel)
        : String(user[filter.id] ?? "—");
    if (!sel.includes(val)) return false;
  }
  return true;
}

function countActiveFilters(filters: FilterState): number {
  return FILTER_CONFIG.reduce(
    (count, filter) => (filters[filter.id] !== null ? count + 1 : count),
    0,
  );
}

export default function MatrixEmployeeAssignment({
  targetLabel,
  description,
  assignments,
  disabled = false,
  onAssign,
  onUnassign,
  onSettled,
}: MatrixEmployeeAssignmentProps) {
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data: users } = useQuery({
    queryKey: queryKeys.users,
    queryFn: fetchUsers,
    ...DASHBOARD_QUERY_CACHE,
  });

  const allUsers = users ?? [];
  const activeCount = countActiveFilters(filters);

  const assignedLabelByEmployeeId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of assignments) {
      map.set(row.employeeId, row.matrixLabel);
    }
    return map;
  }, [assignments]);

  const assignedEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [employeeId, label] of assignedLabelByEmployeeId) {
      if (label === targetLabel) {
        ids.add(employeeId);
      }
    }
    return ids;
  }, [assignedLabelByEmployeeId, targetLabel]);

  const optionsByFilter = useMemo(() => {
    const map = new Map<FilterId, MultiSelectOption[]>();
    for (const filter of FILTER_CONFIG) {
      map.set(
        filter.id,
        buildOptions(
          allUsers,
          filter.id,
          filters,
          filters[filter.id],
          assignedLabelByEmployeeId,
          targetLabel,
        ),
      );
    }
    return map;
  }, [allUsers, filters, assignedLabelByEmployeeId, targetLabel]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allUsers.filter((user) => {
      if (!userMatchesFilters(user, filters, assignedLabelByEmployeeId, targetLabel)) {
        return false;
      }
      if (!query) return true;
      const name = `${user.firstName} ${user.lastName}`.toLowerCase();
      return user.employeeId.toLowerCase().includes(query) || name.includes(query);
    });
  }, [search, allUsers, filters, assignedLabelByEmployeeId, targetLabel]);

  const totalCount = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search, filters, targetLabel]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    const available = new Set(filteredUsers.map((user) => user.employeeId));
    setSelectedEmployeeIds((current) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of current) {
        if (available.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [filteredUsers]);

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [page, filteredUsers]);

  const pageEmployeeIds = useMemo(
    () => paginatedUsers.map((user) => user.employeeId),
    [paginatedUsers],
  );
  const selectedOnPageCount = pageEmployeeIds.filter((id) =>
    selectedEmployeeIds.has(id),
  ).length;
  const allPageSelected =
    pageEmployeeIds.length > 0 && selectedOnPageCount === pageEmployeeIds.length;
  const somePageSelected =
    selectedOnPageCount > 0 && selectedOnPageCount < pageEmployeeIds.length;
  const selectedCount = selectedEmployeeIds.size;
  const selectedAssignedIds = useMemo(
    () => [...selectedEmployeeIds].filter((id) => assignedEmployeeIds.has(id)),
    [assignedEmployeeIds, selectedEmployeeIds],
  );
  const selectedUnassignedIds = useMemo(
    () =>
      [...selectedEmployeeIds].filter(
        (id) => !assignedLabelByEmployeeId.has(id),
      ),
    [assignedLabelByEmployeeId, selectedEmployeeIds],
  );
  const selectedAssignedCount = selectedAssignedIds.length;
  const selectedUnassignedCount = selectedUnassignedIds.length;
  const selectedElsewhereCount = selectedCount - selectedAssignedCount - selectedUnassignedCount;

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      if (allPageSelected) {
        for (const id of pageEmployeeIds) {
          next.delete(id);
        }
      } else {
        for (const id of pageEmployeeIds) {
          next.add(id);
        }
      }
      return next;
    });
  };

  const assignMutation = useMutation({
    mutationFn: onAssign,
    onSuccess: async (result) => {
      setMessage(`Assigned to ${result.assignedCount} employees.`);
      setIsError(false);
      setSelectedEmployeeIds(new Set());
      onSettled?.();
    },
    onError: (error: Error) => {
      setIsError(true);
      setMessage(error.message);
    },
  });

  const unassignMutation = useMutation({
    mutationFn: onUnassign,
    onSuccess: async (result) => {
      setMessage(`Unassigned ${result.unassignedCount} employees.`);
      setIsError(false);
      setSelectedEmployeeIds(new Set());
      onSettled?.();
    },
    onError: (error: Error) => {
      setIsError(true);
      setMessage(error.message);
    },
  });

  const isMutating = assignMutation.isPending || unassignMutation.isPending;

  function handleFilterChange(id: FilterId, next: FilterSelection) {
    setFilters((prev) => ({ ...prev, [id]: next }));
  }

  function handleClearAllFilters() {
    setFilters(EMPTY_FILTERS);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/50">
      <div className="shrink-0 px-5 pt-4">
        <h2 className="text-base font-semibold text-text-primary">Assign Employees</h2>
        <p className="mt-0.5 text-sm text-foreground/70">
          {description}{" "}
          <span className="font-medium">{targetLabel}</span>. An employee can
          only have one assignment in the same financial year.
        </p>
      </div>

      {message ? (
        <div
          className={`mx-5 mt-3 shrink-0 rounded-lg border px-3 py-2 text-sm ${
            isError
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"
          }`}
        >
          {message}
        </div>
      ) : null}

      <div className="mt-3 shrink-0 border-y border-slate-200/80 bg-slate-50/90 dark:border-white/5 dark:bg-slate-950/40">
        <div className="flex items-center justify-between gap-3 px-5 py-2">
          <button
            type="button"
            onClick={() => setFilterPanelOpen((current) => !current)}
            className="inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30 dark:text-slate-300 dark:hover:text-white"
            aria-expanded={filterPanelOpen}
          >
            <Filter className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span>Master filter</span>
            {activeCount > 0 ? (
              <span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-700 dark:bg-white/10 dark:text-slate-200">
                {activeCount}
              </span>
            ) : null}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-slate-400 transition-transform duration-300",
                filterPanelOpen && "rotate-180",
              )}
            />
          </button>

          {activeCount > 0 ? (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <RotateCcw className="h-3 w-3" />
              Clear all
            </button>
          ) : null}
        </div>

        <AnimatePresence initial={false}>
          {filterPanelOpen ? (
            <motion.div
              key="filter-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="overflow-hidden"
            >
              <div className="space-y-3 border-t border-slate-200/70 px-5 pb-4 pt-3 dark:border-white/5">
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  {FILTER_CONFIG.map((filter) => (
                    <MultiSelectFilterDropdown
                      key={filter.id}
                      label={filter.label}
                      options={optionsByFilter.get(filter.id) ?? []}
                      selectedValues={filters[filter.id]}
                      onChange={(next) => handleFilterChange(filter.id, next)}
                      placeholder="All"
                      searchable={(optionsByFilter.get(filter.id) ?? []).length > 8}
                      quiet
                      className="min-w-0 flex-none"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 py-2">
        <div className="min-w-0 flex-1">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by SAP or name"
              className="w-full rounded-lg border border-slate-300 bg-background py-2 pl-10 pr-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {totalCount} of {allUsers.length} employees
            {selectedCount > 0 ? ` · ${selectedCount} selected` : ""}
            {selectedElsewhereCount > 0
              ? ` · ${selectedElsewhereCount} assigned elsewhere`
              : ""}
          </p>
          <button
            type="button"
            disabled={selectedAssignedCount === 0 || isMutating || disabled}
            onClick={() => {
              setMessage(null);
              unassignMutation.mutate(selectedAssignedIds);
            }}
            className="inline-flex items-center rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            {unassignMutation.isPending
              ? "Unassigning..."
              : `Unassign Selected${selectedAssignedCount > 0 ? ` (${selectedAssignedCount})` : ""}`}
          </button>
          <button
            type="button"
            disabled={selectedUnassignedCount === 0 || isMutating || disabled}
            onClick={() => {
              setMessage(null);
              assignMutation.mutate(selectedUnassignedIds);
            }}
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {assignMutation.isPending
              ? "Assigning..."
              : `Assign Selected${selectedUnassignedCount > 0 ? ` (${selectedUnassignedCount})` : ""}`}
          </button>
        </div>
      </div>

      <div className="min-h-0 max-h-[28rem] w-full overflow-auto overscroll-contain">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              <th
                className={cn(
                  "sticky left-0 top-0 z-40 border-b border-slate-200 bg-slate-50 px-3 py-3 dark:border-white/10 dark:bg-slate-900",
                  STICKY_SHADOW_LEFT,
                )}
              >
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  ref={(element) => {
                    if (element) {
                      element.indeterminate = somePageSelected;
                    }
                  }}
                  onChange={toggleSelectAllOnPage}
                  disabled={pageEmployeeIds.length === 0 || disabled}
                  aria-label="Select all employees on this page"
                  className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 disabled:opacity-40 dark:border-white/20 dark:bg-slate-950"
                />
              </th>
              {USER_COLUMNS.map((column) => (
                <th
                  key={column.id}
                  className="sticky top-0 z-30 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400"
                  style={column.width ? { minWidth: column.width } : undefined}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={USER_COLUMNS.length + 1}
                  className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  No employees match your filters.
                </td>
              </tr>
            ) : (
              paginatedUsers.map((user) => {
                const isSelected = selectedEmployeeIds.has(user.employeeId);
                const assignedLabel = assignedLabelByEmployeeId.get(user.employeeId);
                const isAssignedHere = assignedLabel === targetLabel;
                return (
                  <tr
                    key={user.id}
                    className={cn(
                      "group transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02]",
                      isSelected && "bg-amber-50/60 dark:bg-amber-500/5",
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-20 border-b border-slate-100 px-3 py-1.5 dark:border-white/[0.03]",
                        STICKY_SHADOW_LEFT,
                        isSelected
                          ? "bg-amber-50/60 dark:bg-amber-500/5"
                          : "bg-white group-hover:bg-slate-50/50 dark:bg-slate-900 dark:group-hover:bg-white/[0.02]",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleEmployeeSelection(user.employeeId)}
                        disabled={disabled}
                        aria-label={`Select ${user.firstName} ${user.lastName}`}
                        className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 dark:border-white/20 dark:bg-slate-950"
                      />
                    </td>
                    {USER_COLUMNS.map((column) => {
                      const value = column.getValue(user);
                      return (
                        <td
                          key={column.id}
                          className="whitespace-nowrap border-b border-slate-100 px-2 py-1.5 align-middle dark:border-white/[0.03]"
                          style={column.width ? { maxWidth: column.width } : undefined}
                        >
                          <span
                            className={cn(
                              "block truncate text-slate-700 dark:text-slate-300",
                              column.id === "name" && "font-semibold text-slate-900 dark:text-white",
                            )}
                            title={value === "—" ? undefined : value}
                          >
                            {value}
                            {column.id === "name" && isAssignedHere ? (
                              <span className="ml-2 inline-flex items-center rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                Assigned
                              </span>
                            ) : null}
                            {column.id === "name" && assignedLabel && !isAssignedHere ? (
                              <span className="ml-2 inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                Assigned to {assignedLabel}
                              </span>
                            ) : null}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalCount > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-2 dark:border-white/5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {rangeStart}–{rangeEnd} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.04]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <span className="min-w-20 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.04]"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="shrink-0 border-t border-slate-200 px-5 py-2 dark:border-white/5">
        <p className="text-xs text-foreground/60">
          <span className="font-semibold text-text-primary">
            {assignedEmployeeIds.size}
          </span>{" "}
          employee(s) currently assigned to this matrix.
        </p>
      </div>
    </div>
  );
}
