import { keepPreviousData } from "@tanstack/react-query";

/** Shared TanStack Query cache options for the main dashboard. */
export const DASHBOARD_QUERY_CACHE = {
  /** Serve from memory without refetch while fresh. */
  staleTime: 5 * 60_000,
  /** Keep unused dashboard data around across navigations. */
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  /**
   * Keep the previous page of data visible while a new query (e.g. after a
   * filter or pagination change) is loading. This prevents the table and
   * filter counts from flashing to empty/zero between filter changes, which
   * would make counts appear inconsistent with the displayed results.
   */
  placeholderData: keepPreviousData,
} as const;
