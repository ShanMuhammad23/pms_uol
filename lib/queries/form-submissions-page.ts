import "server-only";

import {
  applyMasterFilters,
  buildMasterFilterOptions,
  MASTER_FILTER_MULTI_COLUMNS,
  type MasterFilterState,
} from "@/app/helpers/dashboard-master-filters";
import { matchesSubmissionFilters } from "@/app/helpers/dashboard-filters";
import type { DashboardTableColumnId } from "@/app/helpers/dashboard-table-columns";
import { toSubmissionFilterState } from "@/lib/queries/dashboard-overview-counts";
import { listFormSubmissions } from "@/lib/queries/form-submissions";
import type { StaffListScope } from "@/lib/queries/staff-list-scope";
import type {
  CountOption,
  DashboardFilterParams,
  FormSubmissionsPageResponse,
} from "@/types/dashboard-api";
import type { EntityRecord } from "@/types/entities";
import type { FormSubmissionListItem } from "@/types/form-submissions";

/**
 * Columns whose facet lists are computed server-side from the full filtered
 * dataset. All multi-select columns are included so that filter option counts
 * are always consistent with the actual filtered results — never derived from
 * the current page only (which would produce inconsistent counts as filters
 * change and pagination shifts).
 */
const SERVER_COLUMN_COUNT_IDS = new Set<DashboardTableColumnId>(
  MASTER_FILTER_MULTI_COLUMNS.map((column) => column.id),
);

const MAX_OPTIONS_PER_COLUMN = 200;

export type ListFormSubmissionsPageOptions = StaffListScope & {
  page: number;
  pageSize: number;
  filters: DashboardFilterParams;
  masterFilters: MasterFilterState;
  entities: EntityRecord[];
  /** Optional transform applied before filtering (e.g. HEAD field strip). */
  mapRow?: (row: FormSubmissionListItem) => FormSubmissionListItem;
  /** Optional visibility filter before dashboard filters. */
  filterRow?: (row: FormSubmissionListItem) => boolean;
};

function buildColumnCounts(
  filteredByDashboard: FormSubmissionListItem[],
  masterFilters: MasterFilterState,
): Partial<Record<DashboardTableColumnId, CountOption[]>> {
  const columnCounts: Partial<Record<DashboardTableColumnId, CountOption[]>> =
    {};

  for (const column of MASTER_FILTER_MULTI_COLUMNS) {
    if (!SERVER_COLUMN_COUNT_IDS.has(column.id)) {
      continue;
    }

    const options = buildMasterFilterOptions(
      filteredByDashboard,
      column,
      masterFilters,
      masterFilters.multi[column.id] ?? null,
    );
    columnCounts[column.id] = options.slice(0, MAX_OPTIONS_PER_COLUMN).map(
      (option) => ({
        value: option.value,
        count: option.count,
      }),
    );
  }

  return columnCounts;
}

/**
 * Full staff listing with server-side dashboard/master filters, column facet
 * counts, matching employee IDs (for bulk select-all), and a page of rows.
 */
export async function listFormSubmissionsPage(
  options: ListFormSubmissionsPageOptions,
): Promise<FormSubmissionsPageResponse> {
  const {
    page,
    pageSize,
    filters,
    masterFilters,
    entities,
    mapRow,
    filterRow,
    ...scope
  } = options;

  const submissions = await listFormSubmissions(scope);
  let scoped = filterRow ? submissions.filter(filterRow) : submissions;
  if (mapRow) {
    scoped = scoped.map(mapRow);
  }

  const filterState = toSubmissionFilterState(filters, entities);
  const dashboardFiltered = scoped.filter((submission) =>
    matchesSubmissionFilters(submission, filterState),
  );

  const masterFiltered = applyMasterFilters(dashboardFiltered, masterFilters);
  const total = masterFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const items = masterFiltered.slice(start, start + pageSize);

  return {
    items,
    total,
    page: safePage,
    pageSize,
    matchingEmployeeIds: masterFiltered.map((row) => row.employeeId),
    columnCounts: buildColumnCounts(
      dashboardFiltered,
      masterFilters,
    ),
  };
}
