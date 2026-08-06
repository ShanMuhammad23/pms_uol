"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  Info,
  User,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FormAssessmentPreview, {
  type FormPreviewRole,
} from "./FormAssessmentPreview";
import { fetchFormTemplate } from "@/lib/queries/forms-client";
import type { FormTemplateRecord } from "@/types/forms";
import { cn } from "@/lib/utils";

interface ViewFormAsModalProps {
  open: boolean;
  templateId: number | null;
  templateTitle: string;
  onClose: () => void;
}

interface RoleOption {
  value: FormPreviewRole;
  label: string;
  description: string;
  icon: typeof User;
  accent: string;
  iconBg: string;
  iconColor: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: "employee",
    label: "Employee View",
    description: "Preview how employees see this form",
    icon: User,
    accent:
      "border-sky-300 hover:border-sky-400 hover:bg-sky-50 dark:border-sky-800 dark:hover:border-sky-700 dark:hover:bg-sky-950/40",
    iconBg: "bg-sky-100 dark:bg-sky-950/60",
    iconColor: "text-sky-600 dark:text-sky-300",
  },
  {
    value: "manager1",
    label: "Manager 1 View",
    description: "Preview assessment view for Manager 1",
    icon: Users,
    accent:
      "border-violet-300 hover:border-violet-400 hover:bg-violet-50 dark:border-violet-800 dark:hover:border-violet-700 dark:hover:bg-violet-950/40",
    iconBg: "bg-violet-100 dark:bg-violet-950/60",
    iconColor: "text-violet-600 dark:text-violet-300",
  },
  {
    value: "manager2",
    label: "Manager 2 View",
    description: "Preview assessment view for Manager 2",
    icon: Eye,
    accent:
      "border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40",
    iconBg: "bg-emerald-100 dark:bg-emerald-950/60",
    iconColor: "text-emerald-600 dark:text-emerald-300",
  },
];

export function ViewFormAsModal({
  open,
  templateId,
  templateTitle,
  onClose,
}: ViewFormAsModalProps) {
  const [selectedRole, setSelectedRole] = useState<FormPreviewRole | null>(null);

  // Fetch the full template record (with sections + questions) only when
  // a role has been chosen — the role selection screen doesn't need it.
  const { data: template, isLoading } = useQuery<FormTemplateRecord>({
    queryKey: ["form-template", templateId],
    queryFn: () => fetchFormTemplate(templateId as number),
    enabled: open && templateId != null && selectedRole != null,
    staleTime: 60_000,
  });

  // Close on Escape key.
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={cn(
              "relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900",
              selectedRole
                ? "max-w-[95vw] min-w-[1024px]"
                : "max-w-3xl",
            )}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                {selectedRole ? (
                  <button
                    type="button"
                    onClick={() => setSelectedRole(null)}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                    aria-label="Back to role selection"
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </button>
                ) : (
                  <Eye className="size-5 text-indigo-600 dark:text-indigo-400" />
                )}
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {selectedRole
                    ? ROLE_OPTIONS.find((opt) => opt.value === selectedRole)
                        ?.label ?? "Preview"
                    : "View Form As"}
                </h3>
                {templateTitle ? (
                  <span className="hidden truncate text-xs text-slate-400 dark:text-slate-500 sm:inline">
                    · {templateTitle}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
                aria-label="Close dialog"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[75vh] overflow-y-auto">
              {selectedRole ? (
                <PreviewBody
                  template={template}
                  isLoading={isLoading}
                  viewAs={selectedRole}
                />
              ) : (
                <RoleSelection
                  templateTitle={templateTitle}
                  onSelect={setSelectedRole}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/* Role selection screen                                                       */
/* -------------------------------------------------------------------------- */

function RoleSelection({
  templateTitle,
  onSelect,
}: {
  templateTitle: string;
  onSelect: (role: FormPreviewRole) => void;
}) {
  return (
    <div className="px-5 py-6">
      <p className="mb-1 text-sm text-slate-600 dark:text-slate-300">
        Choose a perspective to preview
        {templateTitle ? (
          <>
            {" "}
            <span className="font-medium text-slate-900 dark:text-white">
              {templateTitle}
            </span>
          </>
        ) : null}
        .
      </p>
      <p className="mb-5 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
        <Info className="size-3.5" />
        Mock data is used — no real assessment answers are loaded.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {ROLE_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={`group flex flex-col items-start gap-3 rounded-xl border-2 bg-white p-4 text-left transition-all hover:shadow-md dark:bg-slate-900 ${option.accent}`}
            >
              <span
                className={`flex size-10 items-center justify-center rounded-lg ${option.iconBg} ${option.iconColor} transition-transform group-hover:scale-110`}
              >
                <Icon className="size-5" />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {option.label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Preview body — renders FormAssessmentPreview for the selected role          */
/* -------------------------------------------------------------------------- */

function PreviewBody({
  template,
  isLoading,
  viewAs,
}: {
  template: FormTemplateRecord | undefined;
  isLoading: boolean;
  viewAs: FormPreviewRole;
}) {
  if (isLoading || !template) {
    return (
      <div className="flex items-center justify-center px-5 py-16 text-sm text-slate-500 dark:text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-white/10 dark:border-t-indigo-400" />
          Loading preview...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 px-4 py-4 dark:bg-slate-950/40">
      <FormAssessmentPreview template={template} viewAs={viewAs} />
    </div>
  );
}
