"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { useState } from "react";
import { queryKeys } from "@/app/queries/keys";
import { cn } from "@/lib/utils";

interface SecurityEventItem {
  id: number;
  eventType: string;
  title: string;
  summary: string;
  details: string[];
  createdAt: string;
}

interface SecurityEventsResponse {
  items: SecurityEventItem[];
  total: number;
  page: number;
  pageSize: number;
}

const FILTERS = [
  { value: "ALL", label: "All events" },
  { value: "LOGIN_FAILURE", label: "Failed sign-ins" },
  { value: "AUTHZ_DENIED", label: "Permission denied" },
  { value: "AUTH_REQUIRED", label: "Signed-out attempts" },
  { value: "INACTIVE_SESSION", label: "Disabled accounts" },
  { value: "AUTH_REJECTED", label: "Blocked sign-ins" },
] as const;

async function fetchSecurityEvents(params: {
  page: number;
  pageSize: number;
  eventType: string;
}): Promise<SecurityEventsResponse> {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.eventType !== "ALL") {
    search.set("eventType", params.eventType);
  }

  const response = await fetch(`/api/admin/security-events?${search}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load security events.");
  }
  return data as SecurityEventsResponse;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toneForEvent(eventType: string): string {
  switch (eventType) {
    case "LOGIN_FAILURE":
    case "AUTHZ_DENIED":
    case "PRIVILEGE_PROBE":
    case "SUSPICIOUS_PATTERN":
      return "border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-950/20";
    case "INACTIVE_SESSION":
    case "AUTH_REJECTED":
      return "border-red-200 bg-red-50/70 dark:border-red-500/30 dark:bg-red-950/20";
    default:
      return "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/40";
  }
}

export default function SecurityEventsManager() {
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState<string>("ALL");
  const pageSize = 25;

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: queryKeys.securityEvents(page, pageSize, eventType),
    queryFn: () => fetchSecurityEvents({ page, pageSize, eventType }),
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Recent security activity
            </h2>
            <p className="mt-0.5 text-sm text-foreground/60">
              Simple notes about sign-in problems and blocked access. Only
              Super Admins can see this list.
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-1 text-xs font-medium text-foreground/70">
          Show
          <select
            value={eventType}
            onChange={(event) => {
              setEventType(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-background px-3 py-2 text-sm text-text-primary dark:border-white/15"
          >
            {FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <p className="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-foreground/60 dark:border-white/15">
          Loading security activity…
        </p>
      ) : null}

      {error ? (
        <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            {(error as Error).message ||
              "Could not load security events. Ask IT to confirm the security_events table is set up."}
          </p>
        </div>
      ) : null}

      {!isLoading && !error && (data?.items.length ?? 0) === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-foreground/60 dark:border-white/15">
          No security events yet. New failed sign-ins and blocked access will
          appear here.
        </p>
      ) : null}

      <ul className="space-y-3">
        {data?.items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "rounded-md border px-4 py-3 shadow-sm",
              toneForEvent(item.eventType),
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-text-primary">
                {item.title}
              </p>
              <p className="text-xs text-foreground/55">
                {formatWhen(item.createdAt)}
              </p>
            </div>
            <p className="mt-1 text-sm text-foreground/80">{item.summary}</p>
            {item.details.length > 0 ? (
              <ul className="mt-2 space-y-0.5 text-xs text-foreground/65">
                {item.details.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>

      {total > pageSize ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-foreground/60">
            Showing page {page} of {totalPages} ({total} events)
            {isFetching ? " · updating…" : null}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-white/15"
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
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
