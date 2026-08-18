"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { Copy, MoreVertical, Pencil, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatrixActionsDropdownProps {
  matrixLabel: string;
  onEdit: () => void;
  onCopy: () => void;
  onAssign: () => void;
  onDelete: () => void;
  deletePending?: boolean;
  copyPending?: boolean;
}

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  openUpward: boolean;
};

const MENU_WIDTH = 224;

function getMenuPosition(trigger: HTMLElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const gap = 6;
  const menuHeightEstimate = 220;
  const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
  const spaceAbove = rect.top - gap - 8;
  const openUpward =
    spaceBelow < menuHeightEstimate && spaceAbove > spaceBelow;

  return {
    top: openUpward ? rect.top - gap : rect.bottom + gap,
    left: rect.right - MENU_WIDTH,
    width: MENU_WIDTH,
    openUpward,
  };
}

export default function MatrixActionsDropdown({
  matrixLabel,
  onEdit,
  onCopy,
  onAssign,
  onDelete,
  deletePending = false,
  copyPending = false,
}: MatrixActionsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }

    const updatePosition = () => {
      if (!triggerRef.current) {
        return;
      }
      setPosition(getMenuPosition(triggerRef.current));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const menu =
    open && mounted && position
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: position.openUpward ? undefined : position.top,
              bottom: position.openUpward
                ? window.innerHeight - position.top
                : undefined,
              left: position.left,
              width: position.width,
              zIndex: 1000,
            }}
            className="rounded-md border border-slate-200 bg-white shadow-lg shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-900/40"
          >
            <div className="py-1.5">
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Manage
              </p>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
              >
                <Pencil className="size-4" />
                Edit Matrix
              </button>
              <button
                type="button"
                disabled={copyPending}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
                onClick={() => {
                  setOpen(false);
                  onCopy();
                }}
              >
                <Copy className="size-4" />
                Copy Matrix
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
                onClick={() => {
                  setOpen(false);
                  onAssign();
                }}
              >
                <Users className="size-4" />
                Assign Employees
              </button>
              <div className="my-1.5 border-t border-slate-100 dark:border-slate-700/50" />
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                Danger Zone
              </p>
              <button
                type="button"
                disabled={deletePending}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
              >
                <Trash2 className="size-4" />
                Delete {matrixLabel}
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={dropdownRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
          open
            ? "border-primary bg-primary/10 text-primary"
            : "border-slate-300 text-text-primary hover:bg-primary/10 dark:border-white/15",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical className="size-3.5" />
        Actions
      </button>
      {menu}
    </div>
  );
}
