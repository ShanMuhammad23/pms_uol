// InputField.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ChangeEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputFieldProps {
  id: string;
  name: string;
  label: string;
  type?: "email" | "password" | "text";
  value: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  icon?: ReactNode;
  error?: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  rightElement?: ReactNode;
}

export function InputField({
  id,
  name,
  label,
  type = "text",
  value,
  placeholder,
  autoComplete,
  required = false,
  icon,
  error,
  onChange,
  rightElement,
}: InputFieldProps) {
  const hasError = Boolean(error);
  const errorId = `${id}-error`;

  return (
    <div className="group space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-amber-700 dark:text-slate-400 dark:group-focus-within:text-amber-400"
      >
        {label}
      </label>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 transition-colors group-focus-within:text-amber-600 dark:group-focus-within:text-amber-400">
            {icon}
          </span>
        ) : null}
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          className={cn(
            "h-11 w-full rounded-md border bg-white text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400",
            "focus-visible:ring-2 focus-visible:ring-amber-500/20 focus-visible:border-amber-500/50",
            "hover:border-slate-400",
            icon ? "pl-10" : "pl-4",
            rightElement ? "pr-10" : "pr-4",
            hasError
              ? "border-red-400 focus-visible:border-red-500/50 focus-visible:ring-red-500/20"
              : "border-slate-200 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:hover:border-white/20"
          )}
        />
        {rightElement ? (
          <span className="absolute inset-y-0 right-0 flex items-center pr-3">
            {rightElement}
          </span>
        ) : null}
      </div>
      <AnimatePresence>
        {hasError ? (
          <motion.p
            id={errorId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs font-medium text-red-600 dark:text-red-400"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}