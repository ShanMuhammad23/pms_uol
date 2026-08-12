"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Filter, RotateCcw, Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MultiSelectFilterDropdown,
  type MultiSelectOption,
} from "@/app/components/dashboard/MultiSelectFilterDropdown";
import { DASHBOARD_QUERY_CACHE } from "@/app/queries/query-cache";
import { queryKeys } from "@/app/queries/keys";
import {
  assignFormTemplateToEmployees,
  fetchFormTemplateAssignments,
  unassignFormTemplateFromEmployees,
  updateAssignmentSelfAssessmentDisabled,
} from "@/lib/queries/forms-client";
import { fetchUsers } from "@/lib/queries/users-client";
import { fetchFormSubmissions } from "@/lib/queries/form-submissions-client";
import type { UserRecord } from "@/types/users";
import {
  getEligibilityShortLabel,
  getSubmissionEligibilityDisplayStatus,
} from "@/app/helpers/dashboard-eligibility";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

interface FormEmployeeAssignmentProps {
  templateId: number;
  templateTitle: string;
}

type FilterId =
  | "entityName"
  | "designation"
  | "roleCategory"
  | "headName"
  | "manager2Name"
  | "assignmentStatus"
  | "assessmentEligibility";

type FilterSelection = string[] | null;

type FilterState = Record<FilterId, FilterSelection>;

const FILTER_CONFIG: { id: FilterId; label: string }[] = [
  { id: "assignmentStatus", label: "Assignment Status" },
  { id: "assessmentEligibility", label: "Eligibility" },
  { id: "entityName", label: "Entity" },
  { id: "designation", label: "Designation" },
  { id: "roleCategory", label: "Role Category" },
  { id: "headName", label: "Manager 1" },
  { id: "manager2Name", label: "Manager 2" },
];

const EMPTY_FILTERS: FilterState = {
  assignmentStatus: null,
  assessmentEligibility: null,
  entityName: null,
  designation: null,
  roleCategory: null,
  headName: null,
  manager2Name: null,
};

function getAssignmentStatus(user: UserRecord, assignedIds: Set<string>): string {
  return assignedIds.has(user.employeeId) ? "Assigned" : "Unassigned";
}

/**
 * Returns the eligibility short label for a user, mirroring the dashboard's
 * Eligible? column: getEligibilityShortLabel(getSubmissionEligibilityDisplayStatus(row)).
 *
 * The stored eligibility status lives on the `appraisals` table, fetched via
 * the existing /api/submissions endpoint. When a submission exists for the
 * employee, its stored eligibilityStatus + assessmentEligibility override are
 * used. When no submission exists yet, we fall back to the user's
 * assessmentEligibility flag only (no duration-based computation, since the
 * form assignment page doesn't have the appraisal cycle context).
 */
function getEligibilityLabel(
  user: UserRecord,
  eligibilityOverride: Map<string, string>,
): string {
  const override = eligibilityOverride.get(user.employeeId);
  if (override) return override;
  // No submission yet — use the manual override flag only.
  return user.assessmentEligibility ? "Full" : "N/A";
}

function getFilterValue(
  user: UserRecord,
  field: FilterId,
  assignedIds: Set<string>,
  eligibilityOverride: Map<string, string>,
): string {
  if (field === "assignmentStatus") return getAssignmentStatus(user, assignedIds);
  if (field === "assessmentEligibility") return getEligibilityLabel(user, eligibilityOverride);
  return String(user[field] ?? "—");
}

function buildOptions(
  users: UserRecord[],
  field: FilterId,
  filters: FilterState,
  selected: FilterSelection,
  assignedEmployeeIds: Set<string>,
  eligibilityOverride: Map<string, string>,
): MultiSelectOption[] {
  const counts = new Map<string, number>();

  for (const user of users) {
    let passesOtherFilters = true;
    for (const f of FILTER_CONFIG) {
      if (f.id === field) continue;
      const sel = filters[f.id];
      if (sel === null || sel === undefined) continue;
      if (sel.length === 0) {
        passesOtherFilters = false;
        break;
      }
      const val = getFilterValue(user, f.id, assignedEmployeeIds, eligibilityOverride);
      if (!sel.includes(val)) {
        passesOtherFilters = false;
        break;
      }
    }
    if (!passesOtherFilters) continue;

    const value = getFilterValue(user, field, assignedEmployeeIds, eligibilityOverride);
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
      return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
    });
}

function userMatchesFilters(
  user: UserRecord,
  filters: FilterState,
  assignedEmployeeIds: Set<string>,
  eligibilityOverride: Map<string, string>,
): boolean {
  for (const f of FILTER_CONFIG) {
    const sel = filters[f.id];
    if (sel === null || sel === undefined) continue;
    if (sel.length === 0) return false;
    const val = getFilterValue(user, f.id, assignedEmployeeIds, eligibilityOverride);
    if (!sel.includes(val)) return false;
  }
  return true;
}

function countActiveFilters(filters: FilterState): number {
  return FILTER_CONFIG.reduce(
    (count, f) => (filters[f.id] !== null ? count + 1 : count),
    0,
  );
}

export default function FormEmployeeAssignment({
  templateId,
  templateTitle,
}: FormEmployeeAssignmentProps) {
  const queryClient = useQueryClient();
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(() => new Set());
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

  const { data: assignedEmployees, refetch } = useQuery({
    queryKey: ["form-assigned-employees", templateId],
    queryFn: () => fetchFormTemplateAssignments(templateId),
  });

  // Fetch submissions via the existing /api/submissions endpoint to get the
  // stored eligibility status (is_eligible / eligibility_status on the
  // appraisals table). This mirrors the dashboard's Eligible? column logic.
  const { data: submissions } = useQuery({
    queryKey: ["form-submissions-all"],
    queryFn: fetchFormSubmissions,
    ...DASHBOARD_QUERY_CACHE,
  });

  const allUsers = users ?? [];
  const activeCount = countActiveFilters(filters);

  const assignedEmployeeIds = useMemo(
    () => new Set((assignedEmployees ?? []).map((e) => e.employeeId)),
    [assignedEmployees],
  );

  // Build employeeId → eligibility short label map using the same helpers as
  // the dashboard's Eligible? column.
  const eligibilityOverride = useMemo(() => {
    const map = new Map<string, string>();
    for (const submission of submissions ?? []) {
      const status = getSubmissionEligibilityDisplayStatus(submission);
      map.set(submission.employeeId, getEligibilityShortLabel(status));
    }
    return map;
  }, [submissions]);

  const assignedSelfAssessmentDisabled = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const e of assignedEmployees ?? []) {
      map.set(e.employeeId, e.selfAssessmentDisabled);
    }
    return map;
  }, [assignedEmployees]);

  const optionsByFilter = useMemo(() => {
    const map = new Map<FilterId, MultiSelectOption[]>();
    for (const f of FILTER_CONFIG) {
      map.set(
        f.id,
        buildOptions(allUsers, f.id, filters, filters[f.id], assignedEmployeeIds, eligibilityOverride),
      );
    }
    return map;
  }, [allUsers, filters, assignedEmployeeIds, eligibilityOverride]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allUsers.filter((user) => {
      if (!userMatchesFilters(user, filters, assignedEmployeeIds, eligibilityOverride)) return false;
      if (!query) return true;
      const name = `${user.firstName} ${user.lastName}`.toLowerCase();
      return (
        user.employeeId.toLowerCase().includes(query) ||
        name.includes(query)
      );
    });
  }, [search, allUsers, filters, assignedEmployeeIds, eligibilityOverride]);

  const filteredAssignedEmployeeIds = useMemo(
    () => filteredUsers.filter((u) => assignedEmployeeIds.has(u.employeeId)).map((u) => u.employeeId),
    [filteredUsers, assignedEmployeeIds],
  );

  const filteredAssignedAllEnabled = useMemo(
    () => filteredAssignedEmployeeIds.length > 0 &&
      filteredAssignedEmployeeIds.every((id) => !assignedSelfAssessmentDisabled.get(id)),
    [filteredAssignedEmployeeIds, assignedSelfAssessmentDisabled],
  );
  const filteredAssignedSomeEnabled = useMemo(
    () => filteredAssignedEmployeeIds.some((id) => !assignedSelfAssessmentDisabled.get(id)),
    [filteredAssignedEmployeeIds, assignedSelfAssessmentDisabled],
  );

  function handleBulkToggleSelfAssessment() {
    if (filteredAssignedEmployeeIds.length === 0) return;
    const disableAll = filteredAssignedAllEnabled;
    bulkToggleSelfAssessment.mutate({
      employeeIds: filteredAssignedEmployeeIds,
      disabled: disableAll,
    });
  }

  const totalCount = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search, filters]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    const available = new Set(filteredUsers.map((u) => u.employeeId));
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
    () => paginatedUsers.map((u) => u.employeeId),
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
    () => [...selectedEmployeeIds].filter((id) => !assignedEmployeeIds.has(id)),
    [assignedEmployeeIds, selectedEmployeeIds],
  );
  const selectedAssignedCount = selectedAssignedIds.length;
  const selectedUnassignedCount = selectedUnassignedIds.length;

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
    mutationFn: (employeeIds: string[]) =>
      assignFormTemplateToEmployees(templateId, employeeIds),
    onSuccess: async (result: { assignedCount: number; templateId: number }) => {
      setMessage(`Assigned form to ${result.assignedCount} employees.`);
      setIsError(false);
      setSelectedEmployeeIds(new Set());
      await refetch();
    },
    onError: (error: Error) => {
      setIsError(true);
      setMessage(error.message);
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (employeeIds: string[]) =>
      unassignFormTemplateFromEmployees(templateId, employeeIds),
    onSuccess: async (result: {
      unassignedCount: number;
      templateId: number;
    }) => {
      setMessage(`Unassigned form from ${result.unassignedCount} employees.`);
      setIsError(false);
      setSelectedEmployeeIds(new Set());
      await refetch();
    },
    onError: (error: Error) => {
      setIsError(true);
      setMessage(error.message);
    },
  });

  const toggleSelfAssessment = useMutation({
    mutationFn: ({ employeeId, disabled }: { employeeId: string; disabled: boolean }) =>
      updateAssignmentSelfAssessmentDisabled(templateId, employeeId, disabled),
    onMutate: async ({ employeeId, disabled }) => {
      await queryClient.cancelQueries({ queryKey: ["form-assigned-employees", templateId] });
      const previous = assignedEmployees;
      queryClient.setQueryData(
        ["form-assigned-employees", templateId],
        (old: typeof previous) =>
          (old ?? []).map((e) =>
            e.employeeId === employeeId
              ? { ...e, selfAssessmentDisabled: disabled }
              : e,
          ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["form-assigned-employees", templateId], context.previous);
      }
      setIsError(true);
      setMessage("Failed to update self-assessment setting.");
    },
    onSuccess: () => {
      setIsError(false);
      setMessage(null);
    },
  });

  const bulkToggleSelfAssessment = useMutation({
    mutationFn: async ({ employeeIds, disabled }: { employeeIds: string[]; disabled: boolean }) => {
      await Promise.all(
        employeeIds.map((employeeId) =>
          updateAssignmentSelfAssessmentDisabled(templateId, employeeId, disabled),
        ),
      );
      return { employeeIds, disabled };
    },
    onMutate: async ({ employeeIds, disabled }) => {
      await queryClient.cancelQueries({ queryKey: ["form-assigned-employees", templateId] });
      const previous = assignedEmployees;
      const idSet = new Set(employeeIds);
      queryClient.setQueryData(
        ["form-assigned-employees", templateId],
        (old: typeof previous) =>
          (old ?? []).map((e) =>
            idSet.has(e.employeeId)
              ? { ...e, selfAssessmentDisabled: disabled }
              : e,
          ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["form-assigned-employees", templateId], context.previous);
      }
      setIsError(true);
      setMessage("Failed to update self-assessment settings.");
    },
    onSuccess: () => {
      setIsError(false);
      setMessage(null);
    },
  });

  const isMutating = assignMutation.isPending || unassignMutation.isPending || toggleSelfAssessment.isPending || bulkToggleSelfAssessment.isPending;
  function handleFilterChange(id: FilterId, next: FilterSelection) {
    setFilters((prev) => ({ ...prev, [id]: next }));
  }

  function handleClearAllFilters() {
    setFilters(EMPTY_FILTERS);
  }

  const USER_COLUMNS: { id: string; label: string; width?: number; getValue: (u: UserRecord) => string }[] = [
    { id: "employeeId", label: "SAP Code", width: 120, getValue: (u) => u.employeeId },
    { id: "name", label: "Employee Name", width: 200, getValue: (u) => `${u.firstName} ${u.lastName}`.trim() },
    { id: "designation", label: "Designation", width: 180, getValue: (u) => u.designation ?? "—" },
    { id: "entityName", label: "Entity", width: 160, getValue: (u) => u.entityName ?? "—" },
    { id: "roleCategory", label: "Role Category", width: 150, getValue: (u) => u.roleCategory ?? "—" },
    { id: "headName", label: "Manager 1", width: 160, getValue: (u) => u.headName ?? "—" },
    { id: "manager2Name", label: "Manager 2", width: 160, getValue: (u) => u.manager2Name ?? "—" },
  ];

  const STICKY_SHADOW_LEFT = "shadow-[6px_0_12px_-8px_rgba(15,23,42,0.2)] dark:shadow-[6px_0_12px_-8px_rgba(0,0,0,0.5)]";

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/50">
      <div className="shrink-0 px-5 pt-4">
        <h2 className="text-base font-semibold text-text-primary">Assign Employees</h2>
        <p className="mt-0.5 text-sm text-foreground/70">
          Select employees to assign or unassign:{" "}
          <span className="font-medium">{templateTitle}</span>. An employee can
          only have one form in the same appraisal cycle.
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

      {/* Master Filters */}
      <div className="mt-3 shrink-0 border-y border-slate-200/80 bg-slate-50/90 dark:border-white/5 dark:bg-slate-950/40">
        <div className="flex items-center justify-between gap-3 px-5 py-2">
          <button
            type="button"
            onClick={() => setFilterPanelOpen((c) => !c)}
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
                  {FILTER_CONFIG.map((f) => (
                    <MultiSelectFilterDropdown
                      key={f.id}
                      label={f.label}
                      options={optionsByFilter.get(f.id) ?? []}
                      selectedValues={filters[f.id]}
                      onChange={(next) => handleFilterChange(f.id, next)}
                      placeholder="All"
                      searchable={(optionsByFilter.get(f.id) ?? []).length > 8}
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

      {/* Toolbar: search + count + assign button */}
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
          {(activeCount > 0 || search.trim().length > 0) ? (
            <button
              type="button"
              onClick={() => {
                handleClearAllFilters();
                setSearch("");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <RotateCcw className="h-3 w-3" />
              Clear filters
            </button>
          ) : null}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {totalCount} of {allUsers.length} employees
            {selectedCount > 0 ? ` · ${selectedCount} selected` : ""}
          </p>
          <button
            type="button"
            disabled={selectedAssignedCount === 0 || isMutating}
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
            disabled={selectedUnassignedCount === 0 || isMutating}
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

      {/* Table */}
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
                  disabled={pageEmployeeIds.length === 0}
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
              <th
                className="sticky top-0 z-30 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400"
              >
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={filteredAssignedAllEnabled}
                    ref={(element) => {
                      if (element) {
                        element.indeterminate =
                          filteredAssignedSomeEnabled && !filteredAssignedAllEnabled;
                      }
                    }}
                    onChange={handleBulkToggleSelfAssessment}
                    disabled={filteredAssignedEmployeeIds.length === 0 || bulkToggleSelfAssessment.isPending}
                    aria-label="Toggle self assessment for all filtered assigned employees"
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30 disabled:opacity-40 dark:border-white/20 dark:bg-slate-950"
                  />
                  Self Assessment
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={USER_COLUMNS.length + 2} className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  No employees match your filters.
                </td>
              </tr>
            ) : (
              paginatedUsers.map((user) => {
                const isSelected = selectedEmployeeIds.has(user.employeeId);
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
                        aria-label={`Select ${user.firstName} ${user.lastName}`}
                        className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 dark:border-white/20 dark:bg-slate-950"
                      />
                    </td>
                    {USER_COLUMNS.map((column) => {
                      const value = column.getValue(user);
                      const isAssigned = column.id === "name" && assignedEmployeeIds.has(user.employeeId);
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
                            {isAssigned ? (
                              <span className="ml-2 inline-flex items-center rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                Assigned
                              </span>
                            ) : null}
                          </span>
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap border-b border-slate-100 px-2 py-1.5 text-center align-middle dark:border-white/[0.03]">
                      {assignedEmployeeIds.has(user.employeeId) ? (
                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={!assignedSelfAssessmentDisabled.get(user.employeeId)}
                            onChange={(e) => {
                              toggleSelfAssessment.mutate({
                                employeeId: user.employeeId,
                                disabled: !e.target.checked,
                              });
                            }}
                            disabled={toggleSelfAssessment.isPending}
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30 disabled:opacity-40 dark:border-white/20 dark:bg-slate-950"
                          />
                          <span className="text-[10px]">
                            {assignedSelfAssessmentDisabled.get(user.employeeId) ? "Disabled" : "Enabled"}
                          </span>
                        </label>
                      ) : (
                        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalCount > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-2 dark:border-white/5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {rangeStart}–{rangeEnd} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((c) => Math.max(1, c - 1))}
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
              onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.04]"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Currently Assigned */}
      <div className="shrink-0 border-t border-slate-200 px-5 py-2 dark:border-white/5">
        <p className="text-xs text-foreground/60">
          <span className="font-semibold text-text-primary">{assignedEmployees?.length ?? 0}</span> employee(s) currently assigned to this form.
        </p>
      </div>
    </div>
  );
}

