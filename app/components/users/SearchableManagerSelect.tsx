"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { UserRecord } from "@/types/users";
import { cn } from "@/lib/utils";

interface SearchableManagerSelectProps {
  id: string;
  value: string;
  options: UserRecord[];
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function formatManagerLabel(user: UserRecord): string {
  const name = `${user.firstName} ${user.lastName}`;
  if (user.designation) {
    return `${name} — ${user.designation}`;
  }
  return name;
}

export function SearchableManagerSelect({
  id,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "None",
  className,
}: SearchableManagerSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedUser = useMemo(
    () => options.find((u) => String(u.id) === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((u) => {
      const name = `${u.firstName} ${u.lastName}`.toLowerCase();
      const empId = u.employeeId.toLowerCase();
      const designation = (u.designation ?? "").toLowerCase();
      return (
        name.includes(q) ||
        empId.includes(q) ||
        designation.includes(q)
      );
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery("");
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const displayText = selectedUser
    ? formatManagerLabel(selectedUser)
    : placeholder;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => !prev);
            if (!open) {
              setTimeout(() => inputRef.current?.focus(), 0);
            }
          }
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors disabled:opacity-70 dark:border-white/10 dark:bg-slate-950 dark:text-white",
          "focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20",
          open && "border-amber-400 ring-2 ring-amber-500/20",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            !selectedUser && "text-slate-400 dark:text-slate-500",
          )}
          title={selectedUser ? displayText : undefined}
        >
          {displayText}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900">
          <div className="relative shrink-0 border-b border-slate-100 p-2 dark:border-white/5">
            <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, SAP ID, or designation..."
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => handleSelect("")}
              className={cn(
                "flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-white/5",
                !value
                  ? "font-medium text-amber-700 dark:text-amber-400"
                  : "text-slate-600 dark:text-slate-300",
              )}
            >
              {placeholder}
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-400">
                No matches found
              </p>
            ) : (
              filtered.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelect(String(user.id))}
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-white/5",
                    String(user.id) === value
                      ? "font-medium text-amber-700 dark:text-amber-400"
                      : "text-slate-700 dark:text-slate-300",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {formatManagerLabel(user)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
