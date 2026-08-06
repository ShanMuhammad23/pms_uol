"use client";

import type { ElementType } from "react";
import { motion } from "framer-motion";
import { itemVariants } from "@/app/helpers/dashboard-animations";
import { cn } from "@/lib/utils";

export type StatCardTone =
  | "navy"
  | "amber"
  | "orange"
  | "violet"
  | "emerald"
  | "slate";

interface StatCardProps {
  title: string;
  awaiting: number;
  awaitingtitle: string;
  completedtitle: string;
  completed: number;
  percentageLabel: string;
  tone: StatCardTone;
  icon: ElementType;
  delay: number;
  /** Click handler for the whole card (legacy). */
  onClick?: () => void;
  active?: boolean;
  /** Click handler for the awaiting number only. */
  onAwaitingClick?: () => void;
  /** Click handler for the completed number only. */
  onCompletedClick?: () => void;
  /** Whether the awaiting number is the active filter. */
  awaitingActive?: boolean;
  /** Whether the completed number is the active filter. */
  completedActive?: boolean;
}

export function StatCard({
  title,
  awaiting,
  awaitingtitle,
  completed,
  completedtitle,
  percentageLabel,
  tone,
  delay,
  onClick,
  active,
  onAwaitingClick,
  onCompletedClick,
  awaitingActive,
  completedActive,
}: StatCardProps) {
  const tones = {
    navy: {
      badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    },
    amber: {
      badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
    },
    orange: {
      badge: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
    },
    violet: {
      badge: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400",
    },
    emerald: {
      badge:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
    },
    slate: {
      badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
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
        "group flex-1 relative min-w-0 cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-primary p-3 text-white shadow-sm transition-all duration-300 sm:p-4 lg:p-5 dark:border-slate-700",
        active
          ? "shadow-md ring-1 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950"
          : "hover:shadow-md",
      )}
    >
      <div className="min-w-0 space-y-2 sm:space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-[10px] font-semibold uppercase leading-tight tracking-wider text-white sm:text-xs lg:text-sm">
            {title}
          </p>
          <span
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums sm:px-2 sm:text-xs",
              t.badge,
            )}
            title="Completion percentage"
          >
            {percentageLabel}
          </span>
        </div>
        <ul className="space-y-1 sm:space-y-1.5">
          <li className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[10px] text-white sm:text-xs">
              {awaitingtitle}
            </span>
            <button
              type="button"
              onClick={onAwaitingClick ?? onClick}
              className={cn(
                "shrink-0 rounded text-lg font-bold tracking-tight tabular-nums text-white transition-all sm:text-xl lg:text-2xl",
                onAwaitingClick && "cursor-pointer hover:underline",
                awaitingActive && "underline ring-1 ring-white/60 rounded px-1",
              )}
            >
              {awaiting}
            </button>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[10px] text-white sm:text-xs">
              {completedtitle}
            </span>
            <button
              type="button"
              onClick={onCompletedClick ?? onClick}
              className={cn(
                "shrink-0 rounded text-lg font-bold tracking-tight tabular-nums text-white transition-all sm:text-xl lg:text-2xl",
                onCompletedClick && "cursor-pointer hover:underline",
                completedActive && "underline ring-1 ring-white/60 rounded px-1",
              )}
            >
              {completed}
            </button>
          </li>
        </ul>
      </div>
    </motion.div>
  );
}
