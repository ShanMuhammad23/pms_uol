import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/app/queries/keys";
import type { FormSubmissionsPageResponse } from "@/types/dashboard-api";
import type { FormSubmissionListItem } from "@/types/form-submissions";

const STAFF_LISTING_KEYS = [
  queryKeys.formSubmissions,
  queryKeys.dashboardOverview,
] as const;

export async function cancelStaffListingQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: queryKeys.formSubmissions }),
    queryClient.cancelQueries({ queryKey: queryKeys.dashboardOverview }),
  ]);
}

export function getStaffListingSnapshots(queryClient: QueryClient) {
  return {
    previousSubmissions: queryClient.getQueriesData<FormSubmissionsPageResponse>(
      { queryKey: queryKeys.formSubmissions },
    ),
    previousOverview: queryClient.getQueriesData({
      queryKey: queryKeys.dashboardOverview,
    }),
  };
}

export function restoreStaffListingSnapshots(
  queryClient: QueryClient,
  snapshots: {
    previousSubmissions?: Array<[readonly unknown[], FormSubmissionsPageResponse | undefined]>;
    previousOverview?: Array<[readonly unknown[], unknown]>;
  },
) {
  for (const [queryKey, data] of snapshots.previousSubmissions ?? []) {
    queryClient.setQueryData(queryKey, data);
  }
  for (const [queryKey, data] of snapshots.previousOverview ?? []) {
    queryClient.setQueryData(queryKey, data);
  }
}

export function patchStaffListingCaches(
  queryClient: QueryClient,
  patch: (row: FormSubmissionListItem) => FormSubmissionListItem,
) {
  queryClient.setQueriesData<FormSubmissionsPageResponse>(
    { queryKey: queryKeys.formSubmissions },
    (current) => {
      if (!current?.items) return current;
      return {
        ...current,
        items: current.items.map(patch),
      };
    },
  );
}

export function invalidateStaffListingQueries(queryClient: QueryClient) {
  for (const queryKey of STAFF_LISTING_KEYS) {
    void queryClient.invalidateQueries({ queryKey });
  }
}
