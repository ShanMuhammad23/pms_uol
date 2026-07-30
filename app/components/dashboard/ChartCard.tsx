"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { itemVariants } from "@/app/helpers/dashboard-animations";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  delay: number;
  className?: string;
  action?: ReactNode;
  clipOverflow?: boolean;
}

export function ChartCard({
  title,
  subtitle,
  children,
  delay,
  className,
  action,
  clipOverflow = true,
}: ChartCardProps) {
  return (
    <motion.div
      variants={itemVariants}
      transition={{ delay }}
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900",
        clipOverflow ? "overflow-hidden" : "overflow-visible",
        className,
      )}
    >
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  );
}
