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
        "group relative flex-1 cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-primary p-4 text-white shadow-sm transition-all duration-300 dark:border-slate-700",
        active
          ? "shadow-md ring-1 ring-amber-500 ring-offset-2 ring-offset-slate-50 dark:ring-amber-400 dark:ring-offset-slate-950"
          : "hover:shadow-md",
      )}
    >
      <div className="grid grid-cols-[minmax(0,6.5rem)_1fr_1fr] items-center gap-x-2 gap-y-2">
        {/* Row 1: title + manager labels */}
        <p className="text-sm font-semibold uppercase tracking-wider text-white">
          Review
        </p>
        <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-white/90">
          Manager 1
        </p>
        <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-white/90">
          Manager 2
        </p>

        {/* Row 2: percentages under managers */}
        <span aria-hidden className="block" />
        <p
          className="text-center text-xs font-semibold tabular-nums text-amber-200"
          title="Completion percentage"
        >
          {manager1.percentageLabel}
        </p>
        <p
          className="text-center text-xs font-semibold tabular-nums text-amber-200"
          title="Completion percentage"
        >
          {manager2.percentageLabel}
        </p>

        {/* Row 3: Submitted counts */}
        <p className="text-xs text-white/90">Submitted</p>
        <p className="text-center text-xl font-bold tracking-tight tabular-nums text-white">
          {manager1.awaiting}
        </p>
        <p className="text-center text-xl font-bold tracking-tight tabular-nums text-white">
          {manager2.awaiting}
        </p>

        {/* Row 4: Reviewed counts */}
        <p className="text-xs text-white/90">Reviewed</p>
        <p className="text-center text-xl font-bold tracking-tight tabular-nums text-white">
          {manager1.completed}
        </p>
        <p className="text-center text-xl font-bold tracking-tight tabular-nums text-white">
          {manager2.completed}
        </p>
      </div>
    </motion.div>
  );
}
