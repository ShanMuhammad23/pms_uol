import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import {
  DASHBOARD_TABLE_COLUMNS,
  type DashboardTableColumnId,
  type DashboardTableColumnDef,
} from "@/app/helpers/dashboard-table-columns";
import type { FormSubmissionListItem } from "@/types/form-submissions";

/** Columns excluded from the master filter entirely. */
const MASTER_FILTER_EXCLUDED_IDS = new Set<DashboardTableColumnId>([
  "actions",
  "dateOfJoining",
  "hodReviewComments",
  "remarksCompensation",
]);

/**
 * Free-text / high-cardinality fields use a search box instead of multi-select.
 * Identifiers, names, and open remarks belong here.
 */
export const MASTER_FILTER_TEXT_COLUMN_IDS = [
  "sapCode",
  "employeeName",
  "remarksEvaluation",
  "qualificationSubject",
  "qualificationInstitute",
] as const satisfies readonly DashboardTableColumnId[];

export type MasterFilterTextColumnId =
  (typeof MASTER_FILTER_TEXT_COLUMN_IDS)[number];

const MASTER_FILTER_TEXT_ID_SET = new Set<DashboardTableColumnId>(
  MASTER_FILTER_TEXT_COLUMN_IDS,
);

/** `null` = all selected (no filter). `[]` = none selected. */
export type MasterFilterMultiSelection = string[] | null;

export type MasterFilterState = {
  text: Partial<Record<MasterFilterTextColumnId, string>>;
  multi: Partial<Record<DashboardTableColumnId, MasterFilterMultiSelection>>;
};

export const EMPTY_MASTER_FILTER_STATE: MasterFilterState = {
  text: {},
  multi: {},
};

export const MASTER_FILTER_TEXT_COLUMNS: DashboardTableColumnDef[] =
  DASHBOARD_TABLE_COLUMNS.filter((column) =>
    MASTER_FILTER_TEXT_ID_SET.has(column.id),
  );

export const MASTER_FILTER_MULTI_COLUMNS: DashboardTableColumnDef[] =
  DASHBOARD_TABLE_COLUMNS.filter(
    (column) =>
      !MASTER_FILTER_EXCLUDED_IDS.has(column.id) &&
      !MASTER_FILTER_TEXT_ID_SET.has(column.id),
  );

export function buildMasterFilterOptions(
  submissions: FormSubmissionListItem[],
  column: DashboardTableColumnDef,
): MultiSelectOption[] {
  const counts = new Map<string, number>();

  for (const submission of submissions) {
    const value = column.getValue(submission);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: value,
      count,
    }))
    .sort((left, right) => {
      if (left.value === "—") return 1;
      if (right.value === "—") return -1;
      return left.label.localeCompare(right.label, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

function matchesTextQuery(cellValue: string, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  if (cellValue === "—") {
    return false;
  }

  return cellValue.toLowerCase().includes(normalizedQuery);
}

export function matchesMasterFilters(
  submission: FormSubmissionListItem,
  filters: MasterFilterState,
): boolean {
  for (const column of MASTER_FILTER_TEXT_COLUMNS) {
    const query = filters.text[column.id as MasterFilterTextColumnId];
    if (!query?.trim()) {
      continue;
    }

    if (!matchesTextQuery(column.getValue(submission), query)) {
      return false;
    }
  }

  for (const column of MASTER_FILTER_MULTI_COLUMNS) {
    const selected = filters.multi[column.id];

    if (selected === undefined || selected === null) {
      continue;
    }

    if (selected.length === 0) {
      return false;
    }

    if (!selected.includes(column.getValue(submission))) {
      return false;
    }
  }

  return true;
}

export function applyMasterFilters(
  submissions: FormSubmissionListItem[],
  filters: MasterFilterState,
): FormSubmissionListItem[] {
  if (!hasActiveMasterFilters(filters)) {
    return submissions;
  }

  return submissions.filter((submission) =>
    matchesMasterFilters(submission, filters),
  );
}

export function hasActiveMasterFilters(filters: MasterFilterState): boolean {
  return countActiveMasterFilters(filters) > 0;
}

export function countActiveMasterFilters(filters: MasterFilterState): number {
  const textCount = MASTER_FILTER_TEXT_COLUMNS.reduce((count, column) => {
    const query = filters.text[column.id as MasterFilterTextColumnId];
    return query?.trim() ? count + 1 : count;
  }, 0);

  const multiCount = MASTER_FILTER_MULTI_COLUMNS.reduce((count, column) => {
    const selected = filters.multi[column.id];
    return selected !== undefined && selected !== null ? count + 1 : count;
  }, 0);

  return textCount + multiCount;
}
