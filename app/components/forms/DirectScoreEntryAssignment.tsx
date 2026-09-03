"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Filter,
  RotateCcw,
  Search,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ColumnHeaderFilter } from "@/app/components/common/ColumnHeaderFilter";
import {
  MultiSelectFilterDropdown,
  type MultiSelectOption,
} from "@/app/components/dashboard/MultiSelectFilterDropdown";
import { DASHBOARD_QUERY_CACHE } from "@/app/queries/query-cache";
import { queryKeys } from "@/app/queries/keys";
import {
  assignDirectScoreEntry,
  fetchDirectScoreEntryAssignments,
  unassignDirectScoreEntry,
} from "@/lib/queries/forms-client";
import { fetchUsers } from "@/lib/queries/users-client";
import type { UserRecord } from "@/types/users";
import { cn } from "@/lib/utils";
import { useResettingPage } from "@/app/hooks/use-resetting-page";
import PrintButton from "@/app/components/forms/PrintButton";
import PrintDocumentHeader from "@/app/components/print/PrintDocumentHeader";
import PrintFooter from "@/app/components/print/PrintFooter";

type PageSizeOption = 50 | 200 | 1000 | 5000 | "all";
const PAGE_SIZE_OPTIONS: PageSizeOption[] = [50, 200, 1000, 5000, "all"];
const DEFAULT_PAGE_SIZE: PageSizeOption = 50;

type MultiFilterId =
  | "entityName"
  | "designation"
  | "roleCategory"
  | "headName"
  | "manager2Name"
  | "assignmentStatus";

type TextFilterId = "employeeId" | "name";

type FilterSelection = string[] | null;

type FilterState = {
  text: Partial<Record<TextFilterId, string>>;
  multi: Record<MultiFilterId, FilterSelection>;
};

const FILTER_CONFIG: { id: MultiFilterId; label: string }[] = [
  { id: "assignmentStatus", label: "Assignment Status" },
  { id: "entityName", label: "Entity" },
  { id: "designation", label: "Designation" },
  { id: "roleCategory", label: "Role Category" },
  { id: "headName", label: "Manager 1" },
  { id: "manager2Name", label: "Manager 2" },
];

const EMPTY_FILTERS: FilterState = {
  text: {},
  multi: {
    assignmentStatus: null,
    entityName: null,
    designation: null,
    roleCategory: null,
    headName: null,
    manager2Name: null,
  },
};

type UserColumnId = TextFilterId | MultiFilterId;

type UserColumn = {
  id: UserColumnId;
  label: string;
  width?: number;
  mode: "text" | "multi";
  getValue: (user: UserRecord) => string;
};

function getAssignmentStatus(user: UserRecord, assignedIds: Set<string>): string {
  return assignedIds.has(user.employeeId) ? "Assigned" : "Unassigned";
}

function getFilterValue(
  user: UserRecord,
  field: UserColumnId,
  assignedIds: Set<string>,
): string {
  if (field === "assignmentStatus") return getAssignmentStatus(user, assignedIds);
  if (field === "employeeId") return user.employeeId;
  if (field === "name") return `${user.firstName} ${user.lastName}`.trim();
  return String(user[field] ?? "—");
}

function matchesTextQuery(cellValue: string, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  if (cellValue === "—") return false;
  return cellValue.toLowerCase().includes(normalizedQuery);
}

function userMatchesFiltersExcluding(
  user: UserRecord,
  filters: FilterState,
  assignedEmployeeIds: Set<string>,
  excludeField: UserColumnId | null,
): boolean {
  for (const id of ["employeeId", "name"] as const) {
    if (excludeField === id) continue;
    const query = filters.text[id];
    if (!query?.trim()) continue;
    const value = getFilterValue(user, id, assignedEmployeeIds);
    if (!matchesTextQuery(value, query)) return false;
  }

  for (const f of FILTER_CONFIG) {
    if (excludeField === f.id) continue;
    const sel = filters.multi[f.id];
    if (sel === null || sel === undefined) continue;
    if (sel.length === 0) return false;
    const val = getFilterValue(user, f.id, assignedEmployeeIds);
    if (!sel.includes(val)) return false;
  }
  return true;
}

function buildOptions(
  users: UserRecord[],
  field: MultiFilterId,
  filters: FilterState,
  selected: FilterSelection,
  assignedEmployeeIds: Set<string>,
): MultiSelectOption[] {
  const counts = new Map<string, number>();

  for (const user of users) {
    if (!userMatchesFiltersExcluding(user, filters, assignedEmployeeIds, field)) {
      continue;
    }

    const value = getFilterValue(user, field, assignedEmployeeIds);
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
): boolean {
  return userMatchesFiltersExcluding(user, filters, assignedEmployeeIds, null);
}

function countActiveFilters(filters: FilterState): number {
  const textCount = (["employeeId", "name"] as const).reduce(
    (count, id) => (filters.text[id]?.trim() ? count + 1 : count),
    0,
  );
  const multiCount = FILTER_CONFIG.reduce(
    (count, f) => (filters.multi[f.id] !== null ? count + 1 : count),
    0,
  );
  return textCount + multiCount;
}

export default function DirectScoreEntryAssignment() {
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [pageSize, setPageSize] = useState<PageSizeOption>(DEFAULT_PAGE_SIZE);

  const { data: users } = useQuery({
    queryKey: queryKeys.users,
    queryFn: fetchUsers,
    ...DASHBOARD_QUERY_CACHE,
  });

  const { data: assignedEmployees, refetch } = useQuery({
    queryKey: ["direct-score-entry-employees"],
    queryFn: () => fetchDirectScoreEntryAssignments(),
  });

  const allUsers = useMemo(() => users ?? [], [users]);
  const activeCount = countActiveFilters(filters);

  const assignedEmployeeIds = useMemo(
    () => new Set((assignedEmployees ?? []).map((e) => e.employeeId)),
    [assignedEmployees],
  );

  const optionsByFilter = useMemo(() => {
    const map = new Map<MultiFilterId, MultiSelectOption[]>();
    for (const f of FILTER_CONFIG) {
      map.set(
        f.id,
        buildOptions(allUsers, f.id, filters, filters.multi[f.id], assignedEmployeeIds),
      );
    }
    return map;
  }, [allUsers, filters, assignedEmployeeIds]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allUsers.filter((user) => {
      if (!userMatchesFilters(user, filters, assignedEmployeeIds)) return false;
      if (!query) return true;
      const name = `${user.firstName} ${user.lastName}`.toLowerCase();
      return (
        user.employeeId.toLowerCase().includes(query) ||
        name.includes(query)
      );
    });
  }, [search, allUsers, filters, assignedEmployeeIds]);

  const totalCount = filteredUsers.length;
  const displayPageSize = pageSize === "all" ? Math.max(totalCount, 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalCount / displayPageSize));
  const [page, setPage] = useResettingPage(
    `${search}\0${JSON.stringify(filters)}\0${pageSize}`,
    totalPages,
  );

  const availableEmployeeIds = useMemo(
    () => new Set(filteredUsers.map((user) => user.employeeId)),
    [filteredUsers],
  );
  if (selectedEmployeeIds.size > 0) {
    let changed = false;
    const next = new Set<string>();
    for (const id of selectedEmployeeIds) {
      if (availableEmployeeIds.has(id)) {
        next.add(id);
      } else {
        changed = true;
      }
    }
    if (changed) {
      setSelectedEmployeeIds(next);
    }
  }

  const filteredEmployeeIds = useMemo(
    () => filteredUsers.map((u) => u.employeeId),
    [filteredUsers],
  );

  const paginatedUsers = useMemo(() => {
    if (pageSize === "all") return filteredUsers;
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [page, filteredUsers, pageSize]);

  const selectedCount = selectedEmployeeIds.size;
  const allFilteredSelected =
    filteredEmployeeIds.length > 0 &&
    filteredEmployeeIds.every((id) => selectedEmployeeIds.has(id));
  const someFilteredSelected = selectedCount > 0 && !allFilteredSelected;
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

  const rangeStart =
    totalCount === 0
      ? 0
      : pageSize === "all"
        ? 1
        : (page - 1) * displayPageSize + 1;
  const rangeEnd =
    pageSize === "all" ? totalCount : Math.min(page * displayPageSize, totalCount);
  const showPageControls = pageSize !== "all" && totalPages > 1;
  const hasToolbarFilters = activeCount > 0 || search.trim().length > 0;

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

  const toggleSelectAllFiltered = () => {
    setSelectedEmployeeIds((current) => {
      if (
        filteredEmployeeIds.length > 0 &&
        filteredEmployeeIds.every((id) => current.has(id))
      ) {
        return new Set();
      }
      return new Set(filteredEmployeeIds);
    });
  };

  const assignMutation = useMutation({
    mutationFn: (employeeIds: string[]) => assignDirectScoreEntry(employeeIds),
    onSuccess: async (result: { assignedCount: number }) => {
      setMessage(`Marked ${result.assignedCount} employees for direct score entry.`);
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
    mutationFn: (employeeIds: string[]) => unassignDirectScoreEntry(employeeIds),
    onSuccess: async (result: { unassignedCount: number }) => {
      setMessage(`Removed ${result.unassignedCount} employees from direct score entry.`);
      setIsError(false);
      setSelectedEmployeeIds(new Set());
      await refetch();
    },
    onError: (error: Error) => {
      setIsError(true);
      setMessage(error.message);
    },
  });

  const isMutating = assignMutation.isPending || unassignMutation.isPending;

  function handleMultiFilterChange(id: MultiFilterId, next: FilterSelection) {
    setFilters((prev) => ({
      ...prev,
      multi: { ...prev.multi, [id]: next },
    }));
  }

  function handleTextFilterChange(id: TextFilterId, next: string) {
    setFilters((prev) => {
      const text = { ...prev.text };
      if (!next.trim()) {
        delete text[id];
      } else {
        text[id] = next;
      }
      return { ...prev, text };
    });
  }

  function handleClearAllFilters() {
    setFilters(EMPTY_FILTERS);
  }

  const USER_COLUMNS: UserColumn[] = [
    { id: "employeeId", label: "SAP Code", width: 120, mode: "text", getValue: (u) => u.employeeId },
    { id: "name", label: "Employee Name", width: 220, mode: "text", getValue: (u) => `${u.firstName} ${u.lastName}`.trim() },
    { id: "designation", label: "Designation", width: 180, mode: "multi", getValue: (u) => u.designation ?? "—" },
    { id: "entityName", label: "Entity", width: 160, mode: "multi", getValue: (u) => u.entityName ?? "—" },
    { id: "roleCategory", label: "Role Category", width: 150, mode: "multi", getValue: (u) => u.roleCategory ?? "—" },
    { id: "headName", label: "Manager 1", width: 160, mode: "multi", getValue: (u) => u.headName ?? "—" },
    { id: "manager2Name", label: "Manager 2", width: 160, mode: "multi", getValue: (u) => u.manager2Name ?? "—" },
    {
      id: "assignmentStatus",
      label: "Status",
      width: 140,
      mode: "multi",
      getValue: (u) => getAssignmentStatus(u, assignedEmployeeIds),
    },
  ];

  const STICKY_SHADOW_LEFT =
    "shadow-[6px_0_12px_-8px_rgba(15,23,42,0.2)] dark:shadow-[6px_0_12px_-8px_rgba(0,0,0,0.5)]";

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-primary/15 bg-surface shadow-sm dark:border-primary/25 dark:bg-slate-900">
      <PrintDocumentHeader
        title="Direct Score Entry Assignment"
        metaItems={[
          { label: "Total Employees", value: String(allUsers.length) },
          { label: "Assigned", value: String(assignedEmployees?.length ?? 0) },
        ]}
      />

      <div className="no-print shrink-0 bg-primary px-5 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <ClipboardCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Direct Score Entry</h2>
              <p className="mt-0.5 text-sm text-white/80">
                Select employees to mark for direct score entry. Their Score (O) is
                adjusted manually from the dashboard. They will not fill a form or
                go through self-assessment or manager review.
              </p>
            </div>
          </div>
          <PrintButton
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
          />
        </div>
      </div>

      {message ? (
        <div
          className={`no-print mx-5 mt-4 shrink-0 rounded-lg border px-3 py-2 text-sm ${
            isError
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"
          }`}
        >
          {message}
        </div>
      ) : null}

      <div className="no-print mt-4 shrink-0 border-y border-primary/10 bg-primary/5 dark:border-primary/20 dark:bg-primary/10">
        <div className="flex items-center justify-between gap-3 px-5 py-2">
          <button
            type="button"
            onClick={() => setFilterPanelOpen((c) => !c)}
            className="inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-expanded={filterPanelOpen}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Master filter</span>
            {activeCount > 0 ? (
              <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                {activeCount}
              </span>
            ) : null}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-primary/60 transition-transform duration-300",
                filterPanelOpen && "rotate-180",
              )}
            />
          </button>

          {activeCount > 0 ? (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
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
              <div className="space-y-3 border-t border-primary/10 px-5 pb-4 pt-3 dark:border-primary/20">
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {FILTER_CONFIG.map((f) => (
                    <MultiSelectFilterDropdown
                      key={f.id}
                      label={f.label}
                      options={optionsByFilter.get(f.id) ?? []}
                      selectedValues={filters.multi[f.id]}
                      onChange={(next) => handleMultiFilterChange(f.id, next)}
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

      <div className="no-print flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="min-w-0 flex-1">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/50" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by SAP or name"
              className="w-full rounded-lg border border-primary/20 bg-background py-2 pl-10 pr-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-primary/30"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {hasToolbarFilters ? (
            <button
              type="button"
              onClick={() => {
                handleClearAllFilters();
                setSearch("");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 dark:border-primary/30"
            >
              <RotateCcw className="h-3 w-3" />
              Clear filters
            </button>
          ) : null}
          <p className="text-xs text-foreground/70">
            {totalCount} of {allUsers.length} employees
            {selectedCount > 0
              ? ` · ${selectedCount} selected${allFilteredSelected ? " (all)" : ""}`
              : ""}
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
              ? "Removing..."
              : `Remove Selected${selectedAssignedCount > 0 ? ` (${selectedAssignedCount})` : ""}`}
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
              ? "Adding..."
              : `Add Selected${selectedUnassignedCount > 0 ? ` (${selectedUnassignedCount})` : ""}`}
          </button>
        </div>
      </div>

      <div className="min-h-0 max-h-[calc(100vh-18rem)] w-full overflow-auto overscroll-contain">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="bg-primary text-white">
              <th
                className={cn(
                  "no-print sticky left-0 top-0 z-40 border-b border-primary/80 bg-primary px-3 py-3",
                  STICKY_SHADOW_LEFT,
                )}
              >
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={(element) => {
                    if (element) {
                      element.indeterminate = someFilteredSelected;
                    }
                  }}
                  onChange={toggleSelectAllFiltered}
                  disabled={filteredEmployeeIds.length === 0}
                  aria-label="Select all filtered employees"
                  className="h-4 w-4 rounded border-white/40 text-amber-600 focus:ring-amber-500/30 disabled:opacity-40"
                />
              </th>
              {USER_COLUMNS.map((column) => (
                <th
                  key={column.id}
                  className="sticky top-0 z-30 whitespace-nowrap border-b border-primary/80 bg-primary px-2 py-3 text-xs font-semibold uppercase tracking-wider text-white"
                  style={column.width ? { minWidth: column.width } : undefined}
                >
                  <ColumnHeaderFilter
                    label={column.label}
                    mode={column.mode}
                    options={
                      column.mode === "multi"
                        ? optionsByFilter.get(column.id as MultiFilterId)
                        : undefined
                    }
                    selectedValues={
                      column.mode === "multi"
                        ? filters.multi[column.id as MultiFilterId]
                        : undefined
                    }
                    textValue={
                      column.mode === "text"
                        ? filters.text[column.id as TextFilterId] ?? ""
                        : undefined
                    }
                    active={
                      column.mode === "text"
                        ? Boolean(filters.text[column.id as TextFilterId]?.trim())
                        : filters.multi[column.id as MultiFilterId] != null
                    }
                    onTextChange={
                      column.mode === "text"
                        ? (next) => handleTextFilterChange(column.id as TextFilterId, next)
                        : undefined
                    }
                    onMultiChange={
                      column.mode === "multi"
                        ? (next) => handleMultiFilterChange(column.id as MultiFilterId, next)
                        : undefined
                    }
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={USER_COLUMNS.length + 1}
                  className="px-5 py-12 text-center text-sm text-foreground/60"
                >
                  No employees match your filters.
                </td>
              </tr>
            ) : (
              paginatedUsers.map((user) => {
                const isSelected = selectedEmployeeIds.has(user.employeeId);
                const isAssigned = assignedEmployeeIds.has(user.employeeId);
                return (
                  <tr
                    key={user.id}
                    className={cn(
                      "group transition-colors hover:bg-primary/5 dark:hover:bg-primary/10",
                      isAssigned && "bg-emerald-50/70 dark:bg-emerald-950/20",
                      isSelected && "bg-amber-50/70 dark:bg-amber-500/10",
                    )}
                  >
                    <td
                      className={cn(
                        "no-print sticky left-0 z-20 border-b border-primary/10 px-3 py-1.5 dark:border-white/5",
                        STICKY_SHADOW_LEFT,
                        isSelected
                          ? "bg-amber-50 dark:bg-amber-950"
                          : isAssigned
                            ? "bg-emerald-50 group-hover:bg-emerald-100/80 dark:bg-emerald-950 dark:group-hover:bg-emerald-900"
                            : "bg-surface group-hover:bg-primary/5 dark:bg-slate-900 dark:group-hover:bg-primary/10",
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
                      return (
                        <td
                          key={column.id}
                          className="whitespace-nowrap border-b border-primary/10 px-2 py-1.5 align-middle dark:border-white/5"
                          style={column.width ? { maxWidth: column.width } : undefined}
                        >
                          {column.id === "assignmentStatus" ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                                value === "Assigned"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                  : "bg-primary/10 text-primary",
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "size-1.5 rounded-full",
                                  value === "Assigned" ? "bg-emerald-500" : "bg-primary/50",
                                )}
                              />
                              {value}
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "block truncate text-text-primary",
                                column.id === "name" && "font-semibold",
                              )}
                              title={value === "—" ? undefined : value}
                            >
                              {value}
                            </span>
                          )}
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
        <div className="no-print flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-primary/10 bg-primary/5 px-5 py-3 dark:border-primary/20">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-foreground/70">
              Showing {rangeStart}–{rangeEnd} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground/60">Show</span>
              <div className="inline-flex overflow-hidden rounded-lg border border-primary/20 dark:border-primary/30">
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <button
                    key={String(option)}
                    type="button"
                    onClick={() => setPageSize(option)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium transition-colors",
                      pageSize === option
                        ? "bg-primary text-white"
                        : "text-primary hover:bg-primary/10",
                    )}
                  >
                    {option === "all" ? "All" : option}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {showPageControls ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((c) => Math.max(1, c - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-primary/30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <span className="min-w-20 text-center text-xs font-medium text-text-primary">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-primary/30"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="shrink-0 border-t border-primary/10 bg-primary px-5 py-2.5 text-white">
        <p className="text-xs text-white/80">
          <span className="font-semibold text-white">{assignedEmployees?.length ?? 0}</span>{" "}
          employee(s) currently marked for direct score entry.
        </p>
      </div>
      <PrintFooter />
    </div>
  );
}
