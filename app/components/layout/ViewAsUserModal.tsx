"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Eye, Search, X } from "lucide-react";
import { useUsersOverviewQuery } from "@/app/queries/users";
import { useEntitiesQuery } from "@/app/queries/organization";
import type { UserRecord } from "@/types/users";
import { cn } from "@/lib/utils";

interface ViewAsUserModalProps {
  open: boolean;
  onClose: () => void;
}

function formatUserLabel(user: UserRecord): string {
  const name = `${user.firstName} ${user.lastName}`;
  const parts = [name];
  if (user.employeeId) parts.push(`(${user.employeeId})`);
  return parts.join(" ");
}

/**
 * Modal dialog for HR / Board / Super Admin to search and select a user
 * whose dashboard they want to view. Reuses the existing useUsersOverviewQuery
 * (cached by React Query) and client-side filtering — no new API calls.
 */
export function ViewAsUserModal({ open, onClose }: ViewAsUserModalProps) {
  const { data: session, update } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: users = [], isLoading } = useUsersOverviewQuery();
  const { data: entities = [] } = useEntitiesQuery();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState<number | "all">("all");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [submitting, setSubmitting] = useState(false);

  const realRole = session?.user?.realRole ?? session?.user?.role;

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      // Exclude the admin themselves and the default admin account.
      if (String(u.id) === String(session?.user?.realId ?? session?.user?.id)) {
        return false;
      }
      if (u.employeeId === "EMP-0001") return false;

      if (q) {
        const name = `${u.firstName} ${u.lastName}`.toLowerCase();
        const empId = u.employeeId.toLowerCase();
        const email = u.email.toLowerCase();
        const designation = (u.designation ?? "").toLowerCase();
        if (
          !name.includes(q) &&
          !empId.includes(q) &&
          !email.includes(q) &&
          !designation.includes(q)
        ) {
          return false;
        }
      }

      if (selectedEntityId !== "all" && u.entityId !== selectedEntityId) {
        return false;
      }

      if (selectedRole !== "all" && u.systemRole !== selectedRole) {
        return false;
      }

      return true;
    });
  }, [users, searchQuery, selectedEntityId, selectedRole, session?.user?.realId, session?.user?.id]);

  if (!open) return null;

  async function handleSelect(user: UserRecord) {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Update the JWT token with the target user's ID.
      await update({ viewAsUserId: String(user.id) });

      // Clear all React Query caches so stale data from the admin's own
      // dashboard is not displayed.
      queryClient.clear();

      // Navigate to the dashboard root — the session now reflects the
      // target user's identity.
      router.push("/dashboard");
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 dark:bg-black/60"
      onClick={onClose}
    >
      <div
        className="mt-8 w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl dark:border-white/15 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Eye className="size-5 text-primary" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                View Dashboard As User
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Select a user to view their dashboard, forms, and profile.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="space-y-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, SAP ID, email, or designation..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={selectedEntityId === "all" ? "all" : String(selectedEntityId)}
              onChange={(e) =>
                setSelectedEntityId(
                  e.target.value === "all" ? "all" : Number(e.target.value),
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-amber-400 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="all">All Departments</option>
              {entities.map((entity) => (
                <option key={entity.id} value={String(entity.id)}>
                  {entity.name}
                </option>
              ))}
            </select>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-amber-400 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="all">All Roles</option>
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="HR">HR</option>
              <option value="BOARD">Board</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
            <span className="ml-auto self-center text-xs text-slate-400">
              {filtered.length} user{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* User list */}
        <div className="max-h-[50vh] overflow-y-auto">
          {isLoading ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              Loading users...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              No users found. Try adjusting your search or filters.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {filtered.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSelect(user)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-amber-50/60 disabled:opacity-50 dark:hover:bg-amber-950/20"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {user.firstName[0]?.toUpperCase()}
                      {user.lastName[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                        {formatUserLabel(user)}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {user.designation ?? "—"}
                        {user.entityName ? ` · ${user.entityName}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        user.systemRole === "EMPLOYEE"
                          ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          : user.systemRole === "MANAGER"
                            ? "bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
                      )}
                    >
                      {user.systemRole}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3 dark:border-white/10">
          <p className="text-[11px] text-slate-400">
            Viewing as another user shows their dashboard, forms, and profile.
            Your actions are logged with your real identity ({realRole}).
            Click "Exit View Mode" in the banner to return to your dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
