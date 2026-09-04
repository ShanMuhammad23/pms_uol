"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Mail,
  Search,
  User,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ElementType } from "react";
import { queryKeys } from "@/app/queries/keys";
import { cn } from "@/lib/utils";

type ReminderRole = "EMPLOYEE" | "MANAGER";
type RoleFilter = "ALL" | ReminderRole;

interface ReminderItem {
  id: string;
  role: ReminderRole;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  formTitle: string | null;
  cycleFiscalYear: number | null;
  lastReminderAt: string;
}

interface TodayStats {
  total: number;
  employee: number;
  manager: number;
}

interface RemindersResponse {
  items: ReminderItem[];
  total: number;
  page: number;
  pageSize: number;
  today: TodayStats;
}

const ROLE_FILTERS: Array<{ value: RoleFilter; label: string }> = [
  { value: "ALL", label: "All roles" },
  { value: "EMPLOYEE", label: "Employee" },
  { value: "MANAGER", label: "Manager" },
];

async function fetchReminders(params: {
  page: number;
  pageSize: number;
  search: string;
  role: RoleFilter;
}): Promise<RemindersResponse> {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    role: params.role,
  });
  if (params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }

  const response = await fetch(
    `/api/admin/assessment-reminders?${searchParams}`,
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load assessment reminders.");
  }
  return data as RemindersResponse;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function RoleBadge({ role }: { role: ReminderRole }) {
  const isManager = role === "MANAGER";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
        isManager
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
          : "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
      )}
    >
      {isManager ? "Manager" : "Employee"}
    </span>
  );
}

function TodayStatCard({
  title,
  value,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  title: string;
  value: number;
  icon: ElementType;
  tone: "slate" | "sky" | "amber";
  active?: boolean;
  onClick?: () => void;
}) {
  const tones = {
    slate: {
      icon: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      value: "text-slate-900 dark:text-slate-50",
    },
    sky: {
      icon: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
      value: "text-sky-800 dark:text-sky-200",
    },
    amber: {
      icon: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
      value: "text-amber-800 dark:text-amber-200",
    },
  } as const;
  const t = tones[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition dark:bg-slate-900",
        active
          ? "border-primary ring-2 ring-primary/20"
          : "border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20",
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          t.icon,
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {title}
        </p>
        <p className={cn("text-2xl font-bold tabular-nums", t.value)}>
          {value.toLocaleString()}
        </p>
      </div>
    </button>
  );
}

export default function AssessmentRemindersManager() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("ALL");
  const pageSize = 50;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const query = useQuery({
    queryKey: queryKeys.assessmentReminders(page, pageSize, search, role),
    queryFn: () => fetchReminders({ page, pageSize, search, role }),
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const today = query.data?.today ?? { total: 0, employee: 0, manager: 0 };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasActiveFilters = search.trim().length > 0 || role !== "ALL";

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setRole("ALL");
    setPage(1);
  };

  const emptyMessage = useMemo(() => {
    if (hasActiveFilters) {
      return "No reminders match the current filters.";
    }
    return "No assessment reminders have been sent yet.";
  }, [hasActiveFilters]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <TodayStatCard
          title="Total sent today"
          value={today.total}
          icon={Mail}
          tone="slate"
          active={role === "ALL" && !search.trim()}
          onClick={() => {
            setRole("ALL");
            setPage(1);
          }}
        />
        <TodayStatCard
          title="Employee reminders today"
          value={today.employee}
          icon={User}
          tone="sky"
          active={role === "EMPLOYEE"}
          onClick={() => {
            setRole("EMPLOYEE");
            setPage(1);
          }}
        />
        <TodayStatCard
          title="Manager reminders today"
          value={today.manager}
          icon={Users}
          tone="amber"
          active={role === "MANAGER"}
          onClick={() => {
            setRole("MANAGER");
            setPage(1);
          }}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search reminders</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search SAP code, name, email, or form…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 dark:border-white/15 dark:bg-slate-950 dark:focus:ring-white/20"
            />
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <Filter className="size-3.5 shrink-0" />
            <span className="sr-only sm:not-sr-only">Role</span>
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value as RoleFilter);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/15 dark:bg-slate-950 dark:text-slate-100"
            >
              {ROLE_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {query.isLoading
              ? "Loading…"
              : `${total.toLocaleString()} reminder${total === 1 ? "" : "s"}`}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <X className="size-3.5" />
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {query.isError ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {(query.error as Error).message}
        </div>
      ) : null}

      {query.isLoading && items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-400">
          Loading reminders…
        </div>
      ) : null}

      {!query.isLoading && !query.isError && items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm dark:border-white/10 dark:bg-slate-900">
          <Mail className="mx-auto size-8 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
            {emptyMessage}
          </p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white dark:border-neutral-700 dark:bg-slate-900">
          <table className="min-w-full">
            <thead className="bg-primary text-left text-sm font-semibold whitespace-nowrap text-white">
              <tr className="divide-x divide-white/15">
                <th className="px-4 py-3.5">Employee ID</th>
                <th className="px-4 py-3.5">Name</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Email</th>
                <th className="px-4 py-3.5">Form</th>
                <th className="px-4 py-3.5">Last Reminder Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm dark:divide-neutral-700">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="divide-x divide-slate-200 dark:divide-neutral-700"
                >
                  <td className="px-4 py-4 font-medium whitespace-nowrap text-slate-900 dark:text-slate-50">
                    {item.employeeId}
                  </td>
                  <td className="px-4 py-4 text-slate-900 dark:text-slate-50">
                    {item.employeeName}
                  </td>
                  <td className="px-4 py-4">
                    <RoleBadge role={item.role} />
                  </td>
                  <td className="px-4 py-4 text-slate-700 dark:text-slate-300">
                    {item.employeeEmail}
                  </td>
                  <td className="px-4 py-4 text-slate-700 dark:text-slate-300">
                    {item.role === "MANAGER" ? (
                      <span className="text-slate-400 dark:text-slate-500">
                        Manager digest
                      </span>
                    ) : (
                      <>
                        {item.formTitle ?? "—"}
                        {item.cycleFiscalYear != null ? (
                          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                            FY {item.cycleFiscalYear}
                          </span>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                    {formatWhen(item.lastReminderAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {total > pageSize ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Page {page} of {totalPages}
            {query.isFetching ? " · updating…" : null}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-white/15"
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || query.isFetching}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-white/15"
            >
              Next
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
