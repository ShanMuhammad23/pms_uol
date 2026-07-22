import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/app/queries/keys";
import type { FormSubmissionListItem } from "@/types/form-submissions";

const STAFF_LISTING_KEYS = [
  queryKeys.formSubmissions,
  queryKeys.dashboardOverview,
] as const;

export async function cancelStaffListingQueries(queryClient: QueryClient) {
  await Promise.all(
    STAFF_LISTING_KEYS.map((queryKey) =>
      queryClient.cancelQueries({ queryKey }),
    ),
  );
}

export function getStaffListingSnapshots(queryClient: QueryClient) {
  return {
    previousSubmissions: queryClient.getQueryData<FormSubmissionListItem[]>(
      queryKeys.formSubmissions,
    ),
    previousOverview: queryClient.getQueryData<FormSubmissionListItem[]>(
      queryKeys.dashboardOverview,
    ),
  };
}

export function restoreStaffListingSnapshots(
  queryClient: QueryClient,
  snapshots: {
    previousSubmissions?: FormSubmissionListItem[];
    previousOverview?: FormSubmissionListItem[];
  },
) {
  if (snapshots.previousSubmissions) {
    queryClient.setQueryData(
      queryKeys.formSubmissions,
      snapshots.previousSubmissions,
    );
  }
  if (snapshots.previousOverview) {
    queryClient.setQueryData(
      queryKeys.dashboardOverview,
      snapshots.previousOverview,
    );
  }
}

export function patchStaffListingCaches(
  queryClient: QueryClient,
  patch: (row: FormSubmissionListItem) => FormSubmissionListItem,
) {
  for (const queryKey of STAFF_LISTING_KEYS) {
    queryClient.setQueryData<FormSubmissionListItem[]>(queryKey, (current) =>
      current?.map(patch),
    );
  }
}

export function invalidateStaffListingQueries(queryClient: QueryClient) {
  for (const queryKey of STAFF_LISTING_KEYS) {
    void queryClient.invalidateQueries({ queryKey });
  }
}
