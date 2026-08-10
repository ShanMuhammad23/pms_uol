import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import {
  DASHBOARD_COLUMN_SECTIONS,
  DASHBOARD_TABLE_COLUMNS,
  getSectionColumns,
  type DashboardColumnSection,
  type DashboardColumnSectionId,
  type DashboardTableColumnId,
  type DashboardTableColumnDef,
} from "@/app/helpers/dashboard-table-columns";
import {
  hasNumericRange,
  matchesNumericRange,
  parseNumericCell,
  type NumericRangeFilter,
} from "@/app/helpers/numeric-range-filter";
import type { FormSubmissionListItem } from "@/types/form-submissions";

/**
 * Free-text / high-cardinality fields use a search box instead of multi-select.
 * Identifiers, names, and open remarks belong here.
 */
export const MASTER_FILTER_TEXT_COLUMN_IDS = [
  "sapCode",
  "employeeName",
  "remarksEvaluation",
  "remarksCompensation",
  "qualification",
  "qualificationSubject",
  "qualificationInstitute",
  "hodReviewComments",
] as const satisfies readonly DashboardTableColumnId[];

/** Multi-select options list every distinct value from the full dataset (Excel-style). */
export const MASTER_FILTER_DATABASE_UNIQUE_COLUMN_IDS =
  new Set<DashboardTableColumnId>(["roleCategory"]);

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
  numeric: Partial<Record<DashboardTableColumnId, NumericRangeFilter>>;
};

export const EMPTY_MASTER_FILTER_STATE: MasterFilterState = {
  text: {},
  multi: {},
  numeric: {},
};

export const MASTER_FILTER_TEXT_COLUMNS: DashboardTableColumnDef[] =
  DASHBOARD_TABLE_COLUMNS.filter((column) =>
    MASTER_FILTER_TEXT_ID_SET.has(column.id),
  );

export const MASTER_FILTER_MULTI_COLUMNS: DashboardTableColumnDef[] =
  DASHBOARD_TABLE_COLUMNS.filter(
    (column) => !MASTER_FILTER_TEXT_ID_SET.has(column.id),
  );

export const MASTER_FILTER_NUMERIC_COLUMNS: DashboardTableColumnDef[] =
  DASHBOARD_TABLE_COLUMNS.filter(
    (column) => column.numeric === true,
  );

export type MasterFilterSection = {
  id: DashboardColumnSectionId;
  label: string;
  columns: DashboardTableColumnDef[];
};

export const MASTER_FILTER_SECTIONS: MasterFilterSection[] =
  DASHBOARD_COLUMN_SECTIONS.map((section: DashboardColumnSection) => ({
    id: section.id,
    label: section.label,
    columns: getSectionColumns(section.id),
  }));

export function isMasterFilterTextColumn(
  columnId: DashboardTableColumnId,
): columnId is MasterFilterTextColumnId {
  return MASTER_FILTER_TEXT_ID_SET.has(columnId);
}

export function isMasterFilterableColumn(columnId: DashboardTableColumnId): boolean {
  return DASHBOARD_TABLE_COLUMNS.some((column) => column.id === columnId);
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
  return matchesMasterFiltersExcluding(submission, filters, null);
}

/**
 * Same as matchesMasterFilters, but ignores the filter for `excludeColumnId`
 * so option lists / counts can cascade across other active filters.
 */
export function matchesMasterFiltersExcluding(
  submission: FormSubmissionListItem,
  filters: MasterFilterState,
  excludeColumnId: DashboardTableColumnId | null,
): boolean {
  for (const column of MASTER_FILTER_TEXT_COLUMNS) {
    if (excludeColumnId === column.id) {
      continue;
    }

    const query = filters.text[column.id as MasterFilterTextColumnId];
    if (!query?.trim()) {
      continue;
    }

    if (!matchesTextQuery(column.getValue(submission), query)) {
      return false;
    }
  }

  for (const column of MASTER_FILTER_MULTI_COLUMNS) {
    if (excludeColumnId === column.id) {
      continue;
    }

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

  for (const column of MASTER_FILTER_NUMERIC_COLUMNS) {
    if (excludeColumnId === column.id) {
      continue;
    }

    const range = filters.numeric[column.id];
    if (!hasNumericRange(range)) {
      continue;
    }

    const cellValue = column.getValue(submission);
    const numValue = parseNumericCell(cellValue);
    if (numValue === null || !matchesNumericRange(numValue, range!)) {
      return false;
    }
  }

  return true;
}

export function buildMasterFilterOptions(
  submissions: FormSubmissionListItem[],
  column: DashboardTableColumnDef,
  filters: MasterFilterState = EMPTY_MASTER_FILTER_STATE,
  selectedValues: MasterFilterMultiSelection = null,
  allSubmissions?: FormSubmissionListItem[],
): MultiSelectOption[] {
  const counts = new Map<string, number>();

  for (const submission of submissions) {
    if (!matchesMasterFiltersExcluding(submission, filters, column.id)) {
      continue;
    }

    const value = column.getValue(submission);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  // Keep currently selected values visible even if other filters zero them out.
  if (selectedValues) {
    for (const value of selectedValues) {
      if (!counts.has(value)) {
        counts.set(value, 0);
      }
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: value,
      count,
    }))
    .filter(
      (option) =>
        option.count > 0 || selectedValues?.includes(option.value),
    )
    .sort((left, right) => {
      if (left.value === "—") return 1;
      if (right.value === "—") return -1;
      return left.label.localeCompare(right.label, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
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

export function isColumnFilterActive(
  filters: MasterFilterState,
  columnId: DashboardTableColumnId,
): boolean {
  if (isMasterFilterTextColumn(columnId)) {
    return Boolean(filters.text[columnId]?.trim());
  }

  const selected = filters.multi[columnId];
  if (selected !== undefined && selected !== null) {
    return true;
  }

  if (hasNumericRange(filters.numeric[columnId])) {
    return true;
  }

  return false;
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

  const numericCount = MASTER_FILTER_NUMERIC_COLUMNS.reduce((count, column) => {
    return hasNumericRange(filters.numeric[column.id]) ? count + 1 : count;
  }, 0);

  return textCount + multiCount + numericCount;
}
