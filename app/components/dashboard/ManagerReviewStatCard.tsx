"use client";

import { AlertTriangle } from "lucide-react";
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
        "group relative flex-1 cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-primary p-5 text-white shadow-sm transition-all duration-300 dark:border-slate-700",
        active
          ? "shadow-md ring-1 ring-amber-500 ring-offset-2 ring-offset-slate-50 dark:ring-amber-400 dark:ring-offset-slate-950"
          : "hover:shadow-md",
      )}
    >
      
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-base font-semibold uppercase tracking-wider text-white">
          Review
        </p> 
        <div className="flex items-center gap-2 ">
      <span
            className="mt-0.5 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
            title="Completion percentage"
          >
            {manager1.percentageLabel}
          </span>
          <span
            className="mt-0.5 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
            title="Completion percentage"
          >
            {manager2.percentageLabel}
          </span>
      </div>
      </div>

      <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1.5 items-center">
        <span />
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/90">
            Manager 1
          </p>
        
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/90">
            Manager 2
          </p>
          
        </div>

        <span className="text-xs text-white">Submitted</span>
        <span className="text-center text-xl font-bold tracking-tight tabular-nums text-white">
          {manager1.awaiting}
        </span>
        <span className="text-center text-xl font-bold tracking-tight tabular-nums text-white">
          {manager2.awaiting}
        </span>

        <span className="text-xs text-white">Reviewed</span>
        <span className="text-center text-xl font-bold tracking-tight tabular-nums text-white">
          {manager1.completed}
        </span>
        <span className="text-center text-xl font-bold tracking-tight tabular-nums text-white">
          {manager2.completed}
        </span>
      </div>
    </motion.div>
  );
}
