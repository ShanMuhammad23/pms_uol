/** Shared TanStack Query cache options for the main dashboard. */
export const DASHBOARD_QUERY_CACHE = {
  /** Serve from memory without refetch while fresh. */
  staleTime: 5 * 60_000,
  /** Keep unused dashboard data around across navigations. */
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;
