"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Eye } from "lucide-react";
import {
  fetchViewAsOptions,
  type ViewAsOption,
} from "@/lib/queries/auth-client";
import { cn } from "@/lib/utils";

/**
 * "View As" dropdown — lets managers and admin roles (HR / Board / Super Admin)
 * switch their effective role to Employee or Manager for the current session.
 *
 * The role switch is persisted in the JWT token and respected by both client
 * and server-side authorization. The user can always return to their original
 * role by selecting the "default" option.
 */
export function ViewAsDropdown() {
  const { data: session, update } = useSession();
  const queryClient = useQueryClient();
  const [options, setOptions] = useState<ViewAsOption[]>([]);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const realRole = session?.user?.realRole ?? session?.user?.role;
  const viewAsRole = session?.user?.viewAsRole ?? null;

  // Fetch available options on mount and when the real role changes.
  useEffect(() => {
    if (!realRole || realRole === "EMPLOYEE") {
      setOptions([]);
      return;
    }

    let cancelled = false;
    fetchViewAsOptions()
      .then((res) => {
        if (cancelled) return;
        setOptions(res.options);
        setCurrentRole(res.currentViewAsRole);
      })
      .catch(() => {
        if (cancelled) return;
        setOptions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [realRole]);

  // Close dropdown when clicking outside.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Don't render for employees or if there are no options.
  if (!realRole || realRole === "EMPLOYEE" || options.length === 0) {
    return null;
  }

  // The effective role label to display.
  const effectiveRole = viewAsRole ?? realRole;
  const currentOption = options.find(
    (o) =>
      o.value === (viewAsRole ?? "") ||
      (!viewAsRole && o.value === ""),
  );
  const displayLabel = currentOption?.label ?? effectiveRole;

  async function handleSelect(option: ViewAsOption) {
    setOpen(false);
    if (loading) return;

    // Don't re-select the current option.
    const targetValue = option.value || null;
    if (targetValue === currentRole) return;

    setLoading(true);
    try {
      // Update the JWT token via NextAuth's session update mechanism.
      // This triggers the jwt callback with trigger="update".
      await update({ viewAsRole: targetValue });

      // Clear all React Query caches so stale data from the previous role
      // is not displayed. This forces every query to refetch with the new
      // role's authorization context.
      queryClient.clear();

      // Determine the destination based on the new effective role.
      const newRole = targetValue ?? realRole ?? undefined;
      const destination =
        newRole === "EMPLOYEE" ? "/dashboard/my-forms" : "/dashboard";

      // Use a hard navigation (window.location) instead of router.push +
      // router.refresh. This ensures the server re-reads the updated JWT
      // cookie and renders with the new role. Soft navigation can race with
      // the session update and serve stale server components.
      window.location.href = destination;
    } catch (error) {
      console.error("Failed to switch view-as role:", error);
      setLoading(false);
    }
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={loading}
        title="View as different role"
        className={cn(
          "flex w-full items-center justify-between gap-1.5 rounded-lg border border-slate-300/80 px-2.5 py-1.5 text-xs font-medium transition hover:bg-slate-100/60 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5",
          viewAsRole && "border-amber-400/60 bg-amber-50/60 dark:border-amber-600/40 dark:bg-amber-950/20",
        )}
      >
        <span className="flex items-center gap-1.5 truncate">
          <Eye className="size-3 shrink-0 text-slate-500 dark:text-slate-400" />
          <span className="truncate">
            {viewAsRole ? `Viewing: ${displayLabel}` : "View As"}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-3 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900">
          {options.map((option) => {
            const isSelected =
              (option.value || null) === (viewAsRole ?? null);
            return (
              <button
                key={option.value || "default"}
                type="button"
                onClick={() => handleSelect(option)}
                disabled={loading}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left text-xs transition hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50",
                  isSelected
                    ? "bg-amber-50 font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                    : "text-slate-700 dark:text-slate-300",
                )}
              >
                {option.label}
                {isSelected ? (
                  <span className="text-amber-500">●</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
