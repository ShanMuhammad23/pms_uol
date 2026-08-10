import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import {
  USERS_TABLE_COLUMNS,
  type UsersTableColumnDef,
  type UsersTableColumnId,
} from "@/app/helpers/users-table-columns";
import {
  hasNumericRange,
  matchesNumericRange,
  parseNumericCell,
  type NumericRangeFilter,
} from "@/app/helpers/numeric-range-filter";
import type { UserRecord } from "@/types/users";

/** Columns excluded from the master filter entirely. */
const MASTER_FILTER_EXCLUDED_IDS = new Set<UsersTableColumnId>([
  "dateOfJoining",
  "actions",
  "email",
]);

/**
 * Free-text / high-cardinality fields use a search box instead of multi-select.
 */
export const USERS_MASTER_FILTER_TEXT_COLUMN_IDS = [
  "sapCode",
  "employeeName",
  "qualificationSubject",
  "qualificationInstitute",
] as const satisfies readonly UsersTableColumnId[];

/** Multi-select options list every distinct value from the full dataset (Excel-style). */
export const USERS_MASTER_FILTER_DATABASE_UNIQUE_COLUMN_IDS =
  new Set<UsersTableColumnId>(["roleCategory"]);

export type UsersMasterFilterTextColumnId =
  (typeof USERS_MASTER_FILTER_TEXT_COLUMN_IDS)[number];

const MASTER_FILTER_TEXT_ID_SET = new Set<UsersTableColumnId>(
  USERS_MASTER_FILTER_TEXT_COLUMN_IDS,
);

/** `null` = all selected (no filter). `[]` = none selected. */
export type UsersMasterFilterMultiSelection = string[] | null;

export type UsersMasterFilterState = {
  text: Partial<Record<UsersMasterFilterTextColumnId, string>>;
  multi: Partial<Record<UsersTableColumnId, UsersMasterFilterMultiSelection>>;
  numeric: Partial<Record<UsersTableColumnId, NumericRangeFilter>>;
};

export const EMPTY_USERS_MASTER_FILTER_STATE: UsersMasterFilterState = {
  text: {},
  multi: {},
  numeric: {},
};

export const USERS_MASTER_FILTER_TEXT_COLUMNS: UsersTableColumnDef[] =
  USERS_TABLE_COLUMNS.filter((column) =>
    MASTER_FILTER_TEXT_ID_SET.has(column.id),
  );

export const USERS_MASTER_FILTER_MULTI_COLUMNS: UsersTableColumnDef[] =
  USERS_TABLE_COLUMNS.filter(
    (column) =>
      !MASTER_FILTER_EXCLUDED_IDS.has(column.id) &&
      !MASTER_FILTER_TEXT_ID_SET.has(column.id),
  );

export const USERS_MASTER_FILTER_NUMERIC_COLUMNS: UsersTableColumnDef[] =
  USERS_TABLE_COLUMNS.filter(
    (column) =>
      !MASTER_FILTER_EXCLUDED_IDS.has(column.id) &&
      column.numeric === true,
  );

export function isUsersMasterFilterTextColumn(
  columnId: UsersTableColumnId,
): columnId is UsersMasterFilterTextColumnId {
  return MASTER_FILTER_TEXT_ID_SET.has(columnId);
}

export function isUsersMasterFilterableColumn(
  columnId: UsersTableColumnId,
): boolean {
  return !MASTER_FILTER_EXCLUDED_IDS.has(columnId);
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

export function matchesUsersMasterFilters(
  user: UserRecord,
  filters: UsersMasterFilterState,
): boolean {
  return matchesUsersMasterFiltersExcluding(user, filters, null);
}

export function matchesUsersMasterFiltersExcluding(
  user: UserRecord,
  filters: UsersMasterFilterState,
  excludeColumnId: UsersTableColumnId | null,
): boolean {
  for (const column of USERS_MASTER_FILTER_TEXT_COLUMNS) {
    if (excludeColumnId === column.id) {
      continue;
    }

    const query = filters.text[column.id as UsersMasterFilterTextColumnId];
    if (!query?.trim()) {
      continue;
    }

    if (!matchesTextQuery(column.getValue(user), query)) {
      return false;
    }
  }

  for (const column of USERS_MASTER_FILTER_MULTI_COLUMNS) {
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

    if (!selected.includes(column.getValue(user))) {
      return false;
    }
  }

  for (const column of USERS_MASTER_FILTER_NUMERIC_COLUMNS) {
    if (excludeColumnId === column.id) {
      continue;
    }

    const range = filters.numeric[column.id];
    if (!hasNumericRange(range)) {
      continue;
    }

    const cellValue = column.getValue(user);
    const numValue = parseNumericCell(cellValue);
    if (numValue === null || !matchesNumericRange(numValue, range!)) {
      return false;
    }
  }

  return true;
}

export function buildUsersMasterFilterOptions(
  users: UserRecord[],
  column: UsersTableColumnDef,
  filters: UsersMasterFilterState = EMPTY_USERS_MASTER_FILTER_STATE,
  selectedValues: UsersMasterFilterMultiSelection = null,
  allUsers?: UserRecord[],
): MultiSelectOption[] {
  const counts = new Map<string, number>();

  for (const user of users) {
    if (!matchesUsersMasterFiltersExcluding(user, filters, column.id)) {
      continue;
    }

    const value = column.getValue(user);
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

export function applyUsersMasterFilters(
  users: UserRecord[],
  filters: UsersMasterFilterState,
): UserRecord[] {
  if (!hasActiveUsersMasterFilters(filters)) {
    return users;
  }

  return users.filter((user) => matchesUsersMasterFilters(user, filters));
}

export function hasActiveUsersMasterFilters(
  filters: UsersMasterFilterState,
): boolean {
  return countActiveUsersMasterFilters(filters) > 0;
}

export function isUsersColumnFilterActive(
  filters: UsersMasterFilterState,
  columnId: UsersTableColumnId,
): boolean {
  if (isUsersMasterFilterTextColumn(columnId)) {
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

export function countActiveUsersMasterFilters(
  filters: UsersMasterFilterState,
): number {
  const textCount = USERS_MASTER_FILTER_TEXT_COLUMNS.reduce((count, column) => {
    const query = filters.text[column.id as UsersMasterFilterTextColumnId];
    return query?.trim() ? count + 1 : count;
  }, 0);

  const multiCount = USERS_MASTER_FILTER_MULTI_COLUMNS.reduce((count, column) => {
    const selected = filters.multi[column.id];
    return selected !== undefined && selected !== null ? count + 1 : count;
  }, 0);

  const numericCount = USERS_MASTER_FILTER_NUMERIC_COLUMNS.reduce((count, column) => {
    return hasNumericRange(filters.numeric[column.id]) ? count + 1 : count;
  }, 0);

  return textCount + multiCount + numericCount;
}
