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
  /** Click handler for Manager 1 Submitted number. */
  onManager1SubmittedClick?: () => void;
  /** Click handler for Manager 1 Reviewed number. */
  onManager1ReviewedClick?: () => void;
  /** Click handler for Manager 2 Submitted number. */
  onManager2SubmittedClick?: () => void;
  /** Click handler for Manager 2 Reviewed number. */
  onManager2ReviewedClick?: () => void;
  /** Active states for each number. */
  manager1SubmittedActive?: boolean;
  manager1ReviewedActive?: boolean;
  manager2SubmittedActive?: boolean;
  manager2ReviewedActive?: boolean;
}

export function ManagerReviewStatCard({
  manager1,
  manager2,
  delay,
  onClick,
  active,
  onManager1SubmittedClick,
  onManager1ReviewedClick,
  onManager2SubmittedClick,
  onManager2ReviewedClick,
  manager1SubmittedActive,
  manager1ReviewedActive,
  manager2SubmittedActive,
  manager2ReviewedActive,
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
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-1 gap-y-1.5 sm:gap-y-2 xl:gap-x-1.5 2xl:gap-x-2">
        <p className="min-w-0 truncate text-[10px] font-semibold uppercase leading-tight tracking-wide text-white sm:text-xs 2xl:tracking-wider 2xl:text-sm">
          Review
        </p>
        <p className="min-w-0 truncate text-center text-[9px] font-semibold uppercase leading-tight tracking-wide text-white/90 sm:text-[10px]">
          <span className="2xl:hidden">Mgr 1</span>
          <span className="hidden 2xl:inline">Manager 1</span>
        </p>
        <p className="min-w-0 truncate text-center text-[9px] font-semibold uppercase leading-tight tracking-wide text-white/90 sm:text-[10px]">
          <span className="2xl:hidden">Mgr 2</span>
          <span className="hidden 2xl:inline">Manager 2</span>
        </p>

        <span aria-hidden className="block" />
        <p
          className="min-w-0 text-center text-[10px] font-semibold tabular-nums text-amber-200 sm:text-xs"
          title="Completion percentage"
        >
          {manager1.percentageLabel}
        </p>
        <p
          className="min-w-0 text-center text-[10px] font-semibold tabular-nums text-amber-200 sm:text-xs"
          title="Completion percentage"
        >
          {manager2.percentageLabel}
        </p>

        <p className="min-w-0 truncate text-[10px] text-white/90 sm:text-xs">Submitted</p>
        <button
          type="button"
          onClick={onManager1SubmittedClick ?? onClick}
          className={cn(
            "min-w-0 text-center text-base font-bold tracking-tight tabular-nums text-white transition-all sm:text-lg 2xl:text-xl",
            onManager1SubmittedClick && "cursor-pointer hover:underline",
            manager1SubmittedActive && "underline ring-1 ring-white/60 rounded",
          )}
        >
          {manager1.awaiting}
        </button>
        <button
          type="button"
          onClick={onManager2SubmittedClick ?? onClick}
          className={cn(
            "min-w-0 text-center text-base font-bold tracking-tight tabular-nums text-white transition-all sm:text-lg 2xl:text-xl",
            onManager2SubmittedClick && "cursor-pointer hover:underline",
            manager2SubmittedActive && "underline ring-1 ring-white/60 rounded",
          )}
        >
          {manager2.awaiting}
        </button>

        <p className="min-w-0 truncate text-[10px] text-white/90 sm:text-xs">Reviewed</p>
        <button
          type="button"
          onClick={onManager1ReviewedClick ?? onClick}
          className={cn(
            "min-w-0 text-center text-base font-bold tracking-tight tabular-nums text-white transition-all sm:text-lg 2xl:text-xl",
            onManager1ReviewedClick && "cursor-pointer hover:underline",
            manager1ReviewedActive && "underline ring-1 ring-white/60 rounded",
          )}
        >
          {manager1.completed}
        </button>
        <button
          type="button"
          onClick={onManager2ReviewedClick ?? onClick}
          className={cn(
            "min-w-0 text-center text-base font-bold tracking-tight tabular-nums text-white transition-all sm:text-lg 2xl:text-xl",
            onManager2ReviewedClick && "cursor-pointer hover:underline",
            manager2ReviewedActive && "underline ring-1 ring-white/60 rounded",
          )}
        >
          {manager2.completed}
        </button>
      </div>
    </motion.div>
  );
}
