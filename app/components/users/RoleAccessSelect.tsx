"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  USER_ROLE_LABELS,
  USER_ROLES,
  type UserRole,
} from "@/types/users";
import {
  ADDITIONAL_ACCESS_MODULES,
  ADDITIONAL_ACCESS_MODULE_LABELS,
  ADDITIONAL_ACCESS_LEVEL_LABELS,
  type AdditionalAccessLevel,
  type AdditionalAccessModule,
} from "@/types/additional-access";
import { cn } from "@/lib/utils";

interface RoleAccessSelectProps {
  /** Currently selected system role. */
  value: UserRole;
  /** Called when the user selects a different primary role. */
  onRoleChange: (role: UserRole) => void;
  /** Current additional access map (module -> level or null). */
  additionalAccess: Record<AdditionalAccessModule, AdditionalAccessLevel | null>;
  /** Called when an additional access module is toggled or its level changes. */
  onAdditionalAccessChange: (
    next: Record<AdditionalAccessModule, AdditionalAccessLevel | null>,
  ) => void;
  /** Disable all interactions. */
  disabled?: boolean;
  /** Optional id for the trigger button (for label association). */
  id?: string;
}

/**
 * Combined "System Role + Additional Access" dropdown.
 *
 * Renders a custom popover that contains:
 * 1. The 5 primary system roles as radio-style options
 * 2. A divider labelled "Additional Access"
 * 3. Each additional-access module as a checkbox + level select
 *
 * The underlying form state and persistence mechanism are unchanged —
 * this component only changes where the controls are presented.
 */
export function RoleAccessSelect({
  value,
  onRoleChange,
  additionalAccess,
  onAdditionalAccessChange,
  disabled,
  id,
}: RoleAccessSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const activeAccessCount = ADDITIONAL_ACCESS_MODULES.filter(
    (m) => additionalAccess[m] !== null,
  ).length;

  const triggerLabel = USER_ROLE_LABELS[value];
  const accessSuffix =
    activeAccessCount > 0 ? ` +${activeAccessCount}` : "";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors",
          "focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20",
          "disabled:opacity-70 dark:border-white/10 dark:bg-slate-950 dark:text-white",
          open && "border-amber-400 ring-2 ring-amber-500/20",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">
          <span className="font-medium">{triggerLabel}</span>
          {accessSuffix ? (
            <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">
              {accessSuffix}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900"
            role="listbox"
          >
            <div className="max-h-[60vh] overflow-y-auto py-1">
              {/* Primary roles */}
              {USER_ROLES.map((role) => {
                const selected = role === value;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      onRoleChange(role);
                    }}
                    disabled={disabled}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors",
                      "hover:bg-slate-50 dark:hover:bg-white/5",
                      selected
                        ? "font-semibold text-amber-600 dark:text-amber-400"
                        : "text-slate-700 dark:text-slate-300",
                      disabled && "cursor-not-allowed opacity-50",
                    )}
                    role="option"
                    aria-selected={selected}
                  >
                    <span>{USER_ROLE_LABELS[role]}</span>
                    {selected ? (
                      <Check className="h-4 w-4 shrink-0" />
                    ) : null}
                  </button>
                );
              })}

              {/* Divider + Additional Access header */}
              <div className="my-1 border-t border-slate-200 dark:border-white/10" />
              <div className="px-3 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Additional Access
                </span>
                <p className="mt-0.5 text-xs text-slate-400">
                  Grant module-level permissions supplementary to the role.
                </p>
              </div>

              {/* Additional access modules */}
              {ADDITIONAL_ACCESS_MODULES.map((module) => {
                const currentLevel = additionalAccess[module];
                const checked = currentLevel !== null;
                return (
                  <div
                    key={module}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <label
                      className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          onAdditionalAccessChange({
                            ...additionalAccess,
                            [module]: e.target.checked ? "VIEW_ONLY" : null,
                          })
                        }
                        disabled={disabled}
                        className="size-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 dark:border-white/20"
                      />
                      <span className="font-medium">
                        {ADDITIONAL_ACCESS_MODULE_LABELS[module]}
                      </span>
                    </label>
                    {checked ? (
                      <select
                        value={currentLevel}
                        onChange={(e) =>
                          onAdditionalAccessChange({
                            ...additionalAccess,
                            [module]: e.target.value as AdditionalAccessLevel,
                          })
                        }
                        disabled={disabled}
                        onClick={(e) => e.stopPropagation()}
                        className="ml-auto rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-white/15 dark:bg-slate-900 dark:text-slate-300"
                      >
                        {(["VIEW_ONLY", "EDIT"] as AdditionalAccessLevel[]).map(
                          (level) => (
                            <option key={level} value={level}>
                              {ADDITIONAL_ACCESS_LEVEL_LABELS[level]}
                            </option>
                          ),
                        )}
                      </select>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
