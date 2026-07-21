"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BulkEditStaffModal } from "@/app/components/dashboard/BulkEditStaffModal";
import { InlineGradeGroupCell } from "@/app/components/dashboard/InlineGradeGroupCell";
import { InlineRoleCategoryCell } from "@/app/components/dashboard/InlineRoleCategoryCell";
import { UsersMasterFilter } from "@/app/components/users/UsersMasterFilter";
import { UsersTableColumnHeaderFilter } from "@/app/components/users/UsersTableColumnHeaderFilter";
import { itemVariants } from "@/app/helpers/dashboard-animations";
import {
  EMPTY_USERS_MASTER_FILTER_STATE,
  applyUsersMasterFilters,
  isUsersMasterFilterableColumn,
  type UsersMasterFilterMultiSelection,
  type UsersMasterFilterState,
  type UsersMasterFilterTextColumnId,
} from "@/app/helpers/users-master-filters";
import {
  USERS_TABLE_COLUMNS,
  type UsersTableColumnDef,
  type UsersTableColumnId,
} from "@/app/helpers/users-table-columns";
import type { UserRecord } from "@/types/users";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

interface UsersListingTableProps {
  users: UserRecord[];
  allUsers?: UserRecord[];
  onEdit: (user: UserRecord) => void;
  onDelete: (user: UserRecord) => void;
  deletePending?: boolean;
  onClearAllFilters: () => void;
}

function columnCellClassName(
  column: UsersTableColumnDef,
  extra?: string,
) {
  return cn(
    "px-2 py-1",
    "whitespace-nowrap",
    column.align === "right" && "text-right",
    column.align === "center" && "text-center",
    extra,
  );
}

const STICKY_EDGE_SHADOW_LEFT =
  "shadow-[6px_0_12px_-8px_rgba(15,23,42,0.2)] dark:shadow-[6px_0_12px_-8px_rgba(0,0,0,0.5)]";

function stickySelectHeaderClassName() {
  return cn(
    "sticky left-0 top-0 z-40 border-b border-primary/80 bg-primary px-3 py-3",
    STICKY_EDGE_SHADOW_LEFT,
  );
}

function stickySelectCellClassName(isSelected: boolean) {
  return cn(
    "sticky left-0 z-20 border-b border-slate-100 px-2 py-1 dark:border-white/[0.03]",
    STICKY_EDGE_SHADOW_LEFT,
    isSelected
      ? "bg-amber-50/60 dark:bg-amber-500/5"
      : "bg-white group-hover:bg-slate-50/50 dark:bg-slate-900 dark:group-hover:bg-white/[0.02]",
  );
}

function stickyHeaderClassName() {
  return "sticky top-0 z-30 border-b border-primary/80 bg-primary";
}

function renderCell(
  column: UsersTableColumnDef,
  user: UserRecord,
  value: string,
  onEdit: (user: UserRecord) => void,
  onDelete: (user: UserRecord) => void,
  deletePending: boolean,
) {
  if (column.id === "actions") {
    return (
      <div className="flex items-center justify-end gap-2">
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
    );
  }

  if (column.id === "sapCode") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onEdit(user)}
          title="Edit user"
          aria-label={`Edit ${user.firstName} ${user.lastName}`}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <span
          className="block max-w-[180px] truncate text-slate-700 dark:text-slate-300"
          title={value === "—" ? undefined : value}
        >
          {value}
        </span>
      </span>
    );
  }

  if (column.id === "status") {
    return (
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
    );
  }

  if (column.id === "roleCategory") {
    return (
      <InlineRoleCategoryCell
        employeeId={user.employeeId}
        value={user.roleCategory}
      />
    );
  }

  if (column.id === "gradeGroup") {
    return (
      <InlineGradeGroupCell
        employeeId={user.employeeId}
        value={user.gradeGroup}
      />
    );
  }

  return (
    <span
      className={cn(
        "block max-w-[220px] truncate text-slate-700 dark:text-slate-300",
        column.id === "employeeName" &&
          "font-semibold text-slate-900 dark:text-white",
      )}
      title={value === "—" ? undefined : value}
    >
      {value}
    </span>
  );
}

export function UsersListingTable({
  users,
  allUsers = users,
  onEdit,
  onDelete,
  deletePending = false,
  onClearAllFilters,
}: UsersListingTableProps) {
  const [page, setPage] = useState(1);
  const [masterFilters, setMasterFilters] = useState<UsersMasterFilterState>(
    EMPTY_USERS_MASTER_FILTER_STATE,
  );
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const masterFilteredUsers = useMemo(
    () => applyUsersMasterFilters(users, masterFilters),
    [masterFilters, users],
  );

  const totalCount = masterFilteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [users, masterFilters]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    const available = new Set(masterFilteredUsers.map((row) => row.employeeId));
    setSelectedEmployeeIds((current) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of current) {
        if (available.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [masterFilteredUsers]);

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return masterFilteredUsers.slice(start, start + PAGE_SIZE);
  }, [page, masterFilteredUsers]);

  const filteredEmployeeIds = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const row of masterFilteredUsers) {
      if (seen.has(row.employeeId)) continue;
      seen.add(row.employeeId);
      ids.push(row.employeeId);
    }
    return ids;
  }, [masterFilteredUsers]);

  const selectedCount = selectedEmployeeIds.size;
  const allFilteredSelected =
    filteredEmployeeIds.length > 0 &&
    filteredEmployeeIds.every((id) => selectedEmployeeIds.has(id));
  const someFilteredSelected = selectedCount > 0 && !allFilteredSelected;

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);
  const showPagination = totalCount > 0;

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedEmployeeIds((current) => {
      if (
        filteredEmployeeIds.length > 0 &&
        filteredEmployeeIds.every((id) => current.has(id))
      ) {
        return new Set();
      }
      return new Set(filteredEmployeeIds);
    });
  };

  const handleMasterTextChange = (
    columnId: UsersMasterFilterTextColumnId,
    next: string,
  ) => {
    setMasterFilters((current) => {
      const text = { ...current.text };

      if (!next.trim()) {
        delete text[columnId];
      } else {
        text[columnId] = next;
      }

      return { ...current, text };
    });
  };

  const handleMasterMultiChange = (
    columnId: UsersTableColumnId,
    next: UsersMasterFilterMultiSelection,
  ) => {
    setMasterFilters((current) => {
      const multi = { ...current.multi };

      if (next === null) {
        delete multi[columnId];
      } else {
        multi[columnId] = next;
      }

      return { ...current, multi };
    });
  };

  const clearMasterFilters = () => {
    setMasterFilters(EMPTY_USERS_MASTER_FILTER_STATE);
  };

  const handleClearAllFilters = () => {
    clearMasterFilters();
    onClearAllFilters();
  };

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.2 }}
      className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
    >
      <UsersMasterFilter
        users={users}
        allUsers={allUsers}
        filters={masterFilters}
        onTextChange={handleMasterTextChange}
        onMultiChange={handleMasterMultiChange}
        onClearAll={clearMasterFilters}
      />

      <div className="relative z-50 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-white/5">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            Users listing ( Total: {totalCount}
            {totalCount !== users.length ? ` of ${users.length}` : ""} )
          </p>
          {selectedCount > 0 ? (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {selectedCount} selected
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setBulkEditOpen(true)}
            disabled={selectedCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            <Pencil className="h-3.5 w-3.5" />
            Bulk edit
            {selectedCount > 0 ? ` (${selectedCount})` : ""}
          </button>
        </div>
      </div>

      <div className="w-full max-w-full max-h-[calc(100vh-5.5rem)] overflow-auto overscroll-contain">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="bg-primary text-white">
              <th className={stickySelectHeaderClassName()}>
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={(element) => {
                    if (element) {
                      element.indeterminate = someFilteredSelected;
                    }
                  }}
                  onChange={toggleSelectAllFiltered}
                  disabled={filteredEmployeeIds.length === 0}
                  aria-label="Select all filtered users"
                  className="h-4 w-4 rounded border-white/40 text-amber-600 focus:ring-amber-500/30 disabled:opacity-40"
                />
              </th>
              {USERS_TABLE_COLUMNS.map((column) => (
                <th
                  key={column.id}
                  className={columnCellClassName(
                    column,
                    cn(
                      stickyHeaderClassName(),
                      "text-xs font-semibold uppercase tracking-wider text-white",
                    ),
                  )}
                >
                  {isUsersMasterFilterableColumn(column.id) ? (
                    <UsersTableColumnHeaderFilter
                      column={column}
                      users={users}
                      allUsers={allUsers}
                      filters={masterFilters}
                      onTextChange={handleMasterTextChange}
                      onMultiChange={handleMasterMultiChange}
                    />
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {paginatedUsers.map((user, index) => {
                const isSelected = selectedEmployeeIds.has(user.employeeId);
                return (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{
                      duration: 0.35,
                      delay: Math.min(index, 10) * 0.02,
                      ease: [0.23, 1, 0.32, 1],
                    }}
                    className={cn(
                      "group transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02]",
                      isSelected && "bg-amber-50/60 dark:bg-amber-500/5",
                    )}
                  >
                    <td className={stickySelectCellClassName(isSelected)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleEmployeeSelection(user.employeeId)}
                        aria-label={`Select ${user.firstName} ${user.lastName}`}
                        className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 dark:border-white/20 dark:bg-slate-950"
                      />
                    </td>
                    {USERS_TABLE_COLUMNS.map((column) => {
                      const value = column.getValue(user);
                      return (
                        <td
                          key={column.id}
                          className={columnCellClassName(
                            column,
                            "align-middle border-b border-slate-100 dark:border-white/[0.03]",
                          )}
                        >
                          {renderCell(
                            column,
                            user,
                            value,
                            onEdit,
                            onDelete,
                            deletePending,
                          )}
                        </td>
                      );
                    })}
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {totalCount === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <Search className="h-10 w-10 text-slate-300 dark:text-slate-700" />
          <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-500">
            No records match your filters
          </p>
          <button
            type="button"
            onClick={handleClearAllFilters}
            className="mt-2 text-xs text-amber-600 hover:underline dark:text-amber-400"
          >
            Clear all filters
          </button>
        </motion.div>
      ) : null}

      {showPagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-white/5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {rangeStart}–{rangeEnd} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.04]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <span className="min-w-20 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.04]"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <BulkEditStaffModal
        open={bulkEditOpen}
        selectedEmployeeIds={[...selectedEmployeeIds]}
        onClose={() => setBulkEditOpen(false)}
        onSuccess={() => setSelectedEmployeeIds(new Set())}
      />
    </motion.div>
  );
}
