"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  Copy,
  Download,
  Eye,
  MoreVertical,
  Pencil,
  Printer,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface FormActionsDropdownProps {
  templateId: number;
  templateTitle: string;
  appraisalCount: number;
  onDelete: (id: number, title: string, appraisalCount: number) => void;
  deletePending: boolean;
}

interface ActionItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  colorClass: string;
  disabled?: boolean;
}

interface ActionSection {
  heading: string;
  headingColor: string;
  items: ActionItem[];
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
  const menuHeightEstimate = 230;
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

export default function FormActionsDropdown({
  templateId,
  templateTitle,
  appraisalCount,
  onDelete,
  deletePending,
}: FormActionsDropdownProps) {
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

  const sections: ActionSection[] = [
    {
      heading: "View & Export",
      headingColor: "text-indigo-600 dark:text-indigo-400",
      items: [
        {
          label: "View Form",
          icon: <Eye className="size-4" />,
          href: `/dashboard/forms/${templateId}/view`,
          colorClass:
            "text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40",
        },
        {
          label: "Print",
          icon: <Printer className="size-4" />,
          onClick: () =>
            window.open(
              `/dashboard/forms/${templateId}/view?print=true`,
              "_blank",
            ),
          colorClass:
            "text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40",
        },
        {
          label: "Download PDF",
          icon: <Download className="size-4" />,
          onClick: () =>
            window.open(
              `/dashboard/forms/${templateId}/view?download=true`,
              "_blank",
            ),
          colorClass:
            "text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-950/40",
        },
      ],
    },
    {
      heading: "Manage",
      headingColor: "text-teal-600 dark:text-teal-400",
      items: [
        {
          label: "Edit Form",
          icon: <Pencil className="size-4" />,
          href: `/dashboard/forms/${templateId}`,
          colorClass:
            "text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/40",
        },
        {
          label: "Copy Form",
          icon: <Copy className="size-4" />,
          href: `/dashboard/forms/${templateId}/copy`,
          colorClass:
            "text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40",
        },
      ],
    },
    {
      heading: "Danger Zone",
      headingColor: "text-red-600 dark:text-red-400",
      items: [
        {
          label: "Delete Form",
          icon: <Trash2 className="size-4" />,
          onClick: () => onDelete(templateId, templateTitle, appraisalCount),
          colorClass:
            "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40",
          disabled: deletePending,
        },
      ],
    },
  ];

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
            <div className="max-h-80 overflow-y-auto py-1.5">
              {sections.map((section, sectionIdx) => (
                <div key={section.heading}>
                  {sectionIdx > 0 ? (
                    <div className="my-1.5 border-t border-slate-100 dark:border-slate-700/50" />
                  ) : null}
                  <p
                    className={cn(
                      "px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
                      section.headingColor,
                    )}
                  >
                    {section.heading}
                  </p>
                  {section.items.map((item) => {
                    const content = (
                      <>
                        <span className="shrink-0">{item.icon}</span>
                        <span className="truncate">{item.label}</span>
                      </>
                    );

                    const baseClass = cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors",
                      item.colorClass,
                      item.disabled && "cursor-not-allowed opacity-50",
                    );

                    if (item.href) {
                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          className={baseClass}
                          onClick={() => setOpen(false)}
                        >
                          {content}
                        </Link>
                      );
                    }

                    return (
                      <button
                        key={item.label}
                        type="button"
                        disabled={item.disabled}
                        className={baseClass}
                        onClick={() => {
                          setOpen(false);
                          item.onClick?.();
                        }}
                      >
                        {content}
                      </button>
                    );
                  })}
                </div>
              ))}
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
