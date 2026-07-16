"use client";

import { useMemo, useState } from "react";
import { Pencil, RotateCcw, Search, Trash2 } from "lucide-react";
import {
  MultiSelectFilterDropdown,
  type MultiSelectOption,
} from "@/app/components/dashboard/MultiSelectFilterDropdown";
import {
  EMPTY_USERS_FILTER_STATE,
  USERS_FILTER_COLUMNS,
  applyUsersFilters,
  buildUsersFilterOptions,
  countActiveUsersFilters,
  type UsersFilterState,
  type UsersMultiFilterSelection,
} from "@/app/helpers/users-list-filters";
import {
  USERS_TABLE_COLUMNS,
  type UsersTableColumnId,
} from "@/app/helpers/users-table-columns";
import type { UserRecord } from "@/types/users";
import { cn } from "@/lib/utils";

interface UsersListingTableProps {
  users: UserRecord[];
  onEdit: (user: UserRecord) => void;
  onDelete: (user: UserRecord) => void;
  deletePending?: boolean;
}

export function UsersListingTable({
  users,
  onEdit,
  onDelete,
  deletePending = false,
}: UsersListingTableProps) {
  const [filters, setFilters] = useState<UsersFilterState>(
    EMPTY_USERS_FILTER_STATE,
  );

  const filteredUsers = useMemo(
    () => applyUsersFilters(users, filters),
    [filters, users],
  );

  const optionsByColumn = useMemo(() => {
    const map = new Map<UsersTableColumnId, MultiSelectOption[]>();

    for (const column of USERS_FILTER_COLUMNS) {
      map.set(
        column.id,
        buildUsersFilterOptions(
          users,
          column,
          filters,
          filters.multi[column.id] ?? null,
        ),
      );
    }

    return map;
  }, [filters, users]);

  const activeFilterCount = countActiveUsersFilters(filters);

  const handleMultiChange = (
    columnId: UsersTableColumnId,
    next: UsersMultiFilterSelection,
  ) => {
    setFilters((current) => {
      const multi = { ...current.multi };

      if (next === null) {
        delete multi[columnId];
      } else {
        multi[columnId] = next;
      }

      return { ...current, multi };
    });
  };

  const clearFilters = () => {
    setFilters(EMPTY_USERS_FILTER_STATE);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-300/80 bg-white p-4 dark:border-white/15 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={filters.searchQuery}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  searchQuery: event.target.value,
                }))
              }
              placeholder="Search by SAP code or employee name..."
              className="w-full rounded-lg border border-slate-300 bg-background py-2.5 pl-10 pr-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-white/15"
            />
          </div>

          <div className="flex items-center gap-3 text-sm text-foreground/70">
            <span>
              Showing {filteredUsers.length} of {users.length}
            </span>
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear filters ({activeFilterCount})
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {USERS_FILTER_COLUMNS.map((column) => {
            const options = optionsByColumn.get(column.id) ?? [];

            return (
              <MultiSelectFilterDropdown
                key={column.id}
                label={column.label}
                options={options}
                selectedValues={filters.multi[column.id] ?? null}
                onChange={(next) => handleMultiChange(column.id, next)}
                placeholder="All"
                searchable={options.length > 8}
                quiet
                className="min-w-0 flex-none"
              />
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-300/80 dark:border-white/15">
        <table className="min-w-full text-sm">
          <thead className="bg-primary/5">
            <tr>
              {USERS_TABLE_COLUMNS.map((column) => (
                <th
                  key={column.id}
                  className={cn(
                    "whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-primary",
                    column.align === "right" && "text-right",
                    column.align === "center" && "text-center",
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr className="border-t border-slate-300/80 dark:border-white/15">
                <td
                  colSpan={USERS_TABLE_COLUMNS.length}
                  className="px-4 py-12 text-center text-sm text-foreground/70"
                >
                  No users match your search or filters.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-t border-slate-300/80 dark:border-white/15"
                >
                  {USERS_TABLE_COLUMNS.map((column) => {
                    if (column.id === "actions") {
                      return (
                        <td key={column.id} className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onEdit(user)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-primary/10 dark:border-white/15"
                            >
                              <Pencil className="size-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(user)}
                              disabled={deletePending}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-60 dark:border-red-900"
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </button>
                          </div>
                        </td>
                      );
                    }

                    if (column.id === "status") {
                      return (
                        <td key={column.id} className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                              user.isActive
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-foreground/70",
                            )}
                          >
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      );
                    }

                    const value = column.getValue(user);

                    return (
                      <td
                        key={column.id}
                        className={cn(
                          "whitespace-nowrap px-4 py-3 text-text-primary",
                          column.align === "right" && "text-right",
                          column.align === "center" && "text-center",
                          column.id === "employeeName" && "font-medium",
                        )}
                        title={value === "—" ? undefined : value}
                      >
                        <span className="block max-w-[220px] truncate">
                          {value}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
