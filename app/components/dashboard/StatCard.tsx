"use client";

import type { ElementType } from "react";
import { motion } from "framer-motion";
import { itemVariants } from "@/app/helpers/dashboard-animations";
import { cn } from "@/lib/utils";

export type StatCardTone = "navy" | "amber" | "orange" | "emerald" | "slate";

interface StatCardProps {
  title: string;
  awaiting: number;
  awaitingtitle: string;
  completedtitle: string;
  completed: number;
  tone: StatCardTone;
  icon: ElementType;
  delay: number;
  onClick?: () => void;
  active?: boolean;
}

export function StatCard({
  title,
  awaiting,
  awaitingtitle,
  completed,
  completedtitle,
  tone,
  delay,
  onClick,
  active,
}: StatCardProps) {
  const tones = {
    navy: {
      border: active ? "border-slate-800 dark:border-slate-600" : "border-slate-200 dark:border-slate-700",
      bg: "bg-white dark:bg-slate-900",
      value: "text-slate-900 dark:text-white",
      top: "from-slate-700 via-slate-600 to-slate-700",
    },
    amber: {
      border: active ? "border-amber-500 dark:border-amber-400" : "border-amber-200 dark:border-amber-800/50",
      bg: "bg-white dark:bg-slate-900",
      value: "text-amber-700 dark:text-amber-400",
      top: "from-amber-600 via-amber-500 to-amber-600",
    },
    orange: {
      border: active ? "border-orange-500 dark:border-orange-400" : "border-orange-200 dark:border-orange-800/50",
      bg: "bg-white dark:bg-slate-900",
      value: "text-orange-700 dark:text-orange-400",
      top: "from-orange-600 via-orange-500 to-orange-600",
    },
    emerald: {
      border: active ? "border-emerald-500 dark:border-emerald-400" : "border-emerald-200 dark:border-emerald-800/50",
      bg: "bg-white dark:bg-slate-900",
      value: "text-emerald-700 dark:text-emerald-400",
      top: "from-emerald-600 via-emerald-500 to-emerald-600",
    },
    slate: {
      border: active ? "border-slate-500 dark:border-slate-400" : "border-slate-200 dark:border-slate-700",
      bg: "bg-white dark:bg-slate-900",
      value: "text-slate-700 dark:text-slate-300",
      top: "from-slate-500 via-slate-400 to-slate-500",
    },
  };

  const t = tones[tone];

  return (
    <motion.div
      variants={itemVariants}
      transition={{ delay }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-300",
        active ? "shadow-md ring-1 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950" : "hover:shadow-md",
        t.border,
        t.bg,
        active && tone === "navy" && "ring-slate-400",
        active && tone === "amber" && "ring-amber-400",
        active && tone === "orange" && "ring-orange-400",
        active && tone === "emerald" && "ring-emerald-400",
      )}
    >
      <div className={cn("absolute left-0 right-0 top-0 h-1 bg-gradient-to-r", t.top)} />
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-base font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <ul className="space-y-1.5">
            <li className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">{awaitingtitle}</span>
              <span className={cn("text-2xl font-bold tracking-tight tabular-nums", t.value)}>
                {awaiting}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">{completedtitle}</span>
              <span className="text-2xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
                {completed}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
}
