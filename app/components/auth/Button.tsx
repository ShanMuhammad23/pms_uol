// Button.tsx
"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type ButtonVariant = "primary" | "outline" | "social";

type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: ButtonVariant;
  isLoading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-slate-800 text-white hover:bg-slate-700 focus-visible:ring-slate-600 border border-transparent dark:bg-amber-600 dark:hover:bg-amber-500 dark:focus-visible:ring-amber-500",
  outline:
    "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-600 dark:bg-transparent dark:text-white dark:border-white/20 dark:hover:bg-white/5",
  social:
    "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-slate-600 dark:bg-slate-800 dark:text-white dark:border-white/10 dark:hover:bg-slate-700",
};

export function Button({
  variant = "primary",
  isLoading = false,
  icon,
  children,
  disabled,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <motion.button
      type={type}
      disabled={isDisabled}
      whileHover={!isDisabled ? { scale: 1.02, y: -1 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-4 w-4 rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icon
      )}
      <span>{children}</span>
    </motion.button>
  );
}