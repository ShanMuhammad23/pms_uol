import type { MultiSelectOption } from "@/app/components/dashboard/MultiSelectFilterDropdown";
import {
  USERS_TABLE_COLUMNS,
  type UsersTableColumnDef,
  type UsersTableColumnId,
} from "@/app/helpers/users-table-columns";
import type { UserRecord } from "@/types/users";

export type UsersMultiFilterSelection = string[] | null;

export type UsersFilterState = {
  searchQuery: string;
  multi: Partial<Record<UsersTableColumnId, UsersMultiFilterSelection>>;
};

export const EMPTY_USERS_FILTER_STATE: UsersFilterState = {
  searchQuery: "",
  multi: {},
};

const FILTERABLE_COLUMNS = USERS_TABLE_COLUMNS.filter(
  (column) =>
    column.id !== "actions" &&
    column.id !== "sapCode" &&
    column.id !== "employeeName",
);

export const USERS_FILTER_COLUMNS = FILTERABLE_COLUMNS;

export function matchesUsersSearch(user: UserRecord, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
  return (
    user.employeeId.toLowerCase().includes(normalized) ||
    fullName.includes(normalized)
  );
}

export function matchesUsersFiltersExcluding(
  user: UserRecord,
  filters: UsersFilterState,
  excludeColumnId: UsersTableColumnId | null,
): boolean {
  if (!matchesUsersSearch(user, filters.searchQuery)) {
    return false;
  }

  for (const column of FILTERABLE_COLUMNS) {
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

  return true;
}

export function matchesUsersFilters(
  user: UserRecord,
  filters: UsersFilterState,
): boolean {
  return matchesUsersFiltersExcluding(user, filters, null);
}

export function buildUsersFilterOptions(
  users: UserRecord[],
  column: UsersTableColumnDef,
  filters: UsersFilterState = EMPTY_USERS_FILTER_STATE,
  selectedValues: UsersMultiFilterSelection = null,
): MultiSelectOption[] {
  const counts = new Map<string, number>();

  for (const user of users) {
    if (!matchesUsersFiltersExcluding(user, filters, column.id)) {
      continue;
    }

    const value = column.getValue(user);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  for (const user of users) {
    const value = column.getValue(user);
    if (!counts.has(value)) {
      counts.set(value, 0);
    }
  }

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
    .filter((option) => option.count > 0 || selectedValues?.includes(option.value))
    .sort((left, right) => {
      if (left.value === "—") return 1;
      if (right.value === "—") return -1;
      return left.label.localeCompare(right.label, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

export function applyUsersFilters(
  users: UserRecord[],
  filters: UsersFilterState,
): UserRecord[] {
  if (!hasActiveUsersFilters(filters)) {
    return users;
  }

  return users.filter((user) => matchesUsersFilters(user, filters));
}

export function hasActiveUsersFilters(filters: UsersFilterState): boolean {
  if (filters.searchQuery.trim()) {
    return true;
  }

  return FILTERABLE_COLUMNS.some((column) => {
    const selected = filters.multi[column.id];
    return selected !== undefined && selected !== null;
  });
}

export function countActiveUsersFilters(filters: UsersFilterState): number {
  let count = filters.searchQuery.trim() ? 1 : 0;

  for (const column of FILTERABLE_COLUMNS) {
    const selected = filters.multi[column.id];
    if (selected !== undefined && selected !== null) {
      count += 1;
    }
  }

  return count;
}
