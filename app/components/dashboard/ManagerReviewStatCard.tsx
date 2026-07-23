"use client";

import { motion } from "framer-motion";
import { itemVariants } from "@/app/helpers/dashboard-animations";
import type { WorkflowStageStats } from "@/app/helpers/dashboard-workflow-stats";
import { cn } from "@/lib/utils";

interface ManagerReviewStatCardProps {
  manager1: WorkflowStageStats;
  manager2: WorkflowStageStats;
  delay: number;
  onClick?: () => void;
  active?: boolean;
}

export function ManagerReviewStatCard({
  manager1,
  manager2,
  delay,
  onClick,
  active,
}: ManagerReviewStatCardProps) {
  return (
    <motion.div
      variants={itemVariants}
      transition={{ delay }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        "group relative flex-1 min-w-0 cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-primary p-3 text-white shadow-sm transition-all duration-300 sm:p-4 dark:border-slate-700",
        active
          ? "shadow-md ring-1 ring-amber-500 ring-offset-2 ring-offset-slate-50 dark:ring-amber-400 dark:ring-offset-slate-950"
          : "hover:shadow-md",
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1.5 sm:gap-x-2 sm:gap-y-2">
        <p className="min-w-0 text-[10px] font-semibold uppercase leading-tight tracking-wider text-white sm:text-xs lg:text-sm">
          Review
        </p>
        <p className="truncate text-center text-[9px] font-semibold uppercase tracking-wider text-white/90 sm:text-[10px]">
          Manager 1
        </p>
        <p className="truncate text-center text-[9px] font-semibold uppercase tracking-wider text-white/90 sm:text-[10px]">
          Manager 2
        </p>

        <span aria-hidden className="block" />
        <p
          className="text-center text-[10px] font-semibold tabular-nums text-amber-200 sm:text-xs"
          title="Completion percentage"
        >
          {manager1.percentageLabel}
        </p>
        <p
          className="text-center text-[10px] font-semibold tabular-nums text-amber-200 sm:text-xs"
          title="Completion percentage"
        >
          {manager2.percentageLabel}
        </p>

        <p className="truncate text-[10px] text-white/90 sm:text-xs">Submitted</p>
        <p className="text-center text-base font-bold tracking-tight tabular-nums text-white sm:text-lg lg:text-xl">
          {manager1.awaiting}
        </p>
        <p className="text-center text-base font-bold tracking-tight tabular-nums text-white sm:text-lg lg:text-xl">
          {manager2.awaiting}
        </p>

        <p className="truncate text-[10px] text-white/90 sm:text-xs">Reviewed</p>
        <p className="text-center text-base font-bold tracking-tight tabular-nums text-white sm:text-lg lg:text-xl">
          {manager1.completed}
        </p>
        <p className="text-center text-base font-bold tracking-tight tabular-nums text-white sm:text-lg lg:text-xl">
          {manager2.completed}
        </p>
      </div>
    </motion.div>
  );
}
