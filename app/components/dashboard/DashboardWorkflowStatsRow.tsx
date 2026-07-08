"use client";

import { AlertTriangle, Scale, User } from "lucide-react";
import { motion } from "framer-motion";
import { EligibilityStatCard } from "@/app/components/dashboard/EligibilityStatCard";
import { StatCard } from "@/app/components/dashboard/StatCard";
import { containerVariants } from "@/app/helpers/dashboard-animations";
import type { FormState } from "@/app/helpers/dashboard-types";

interface WorkflowStageStats {
  awaiting: number;
  completed: number;
}

interface DashboardWorkflowStatsRowProps {
  eligibilityData: Array<{ name: string; value: number; color: string }>;
  selfAssessmentStats: WorkflowStageStats;
  managerReviewStats: WorkflowStageStats;
  hrAlignmentStats: WorkflowStageStats;
  selectedFormState: FormState | "ALL";
  onFilterByFormState: (state: FormState) => void;
}

export function DashboardWorkflowStatsRow({
  eligibilityData,
  selfAssessmentStats,
  managerReviewStats,
  hrAlignmentStats,
  selectedFormState,
  onFilterByFormState,
}: DashboardWorkflowStatsRowProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <EligibilityStatCard data={eligibilityData} delay={0} />
      <StatCard
        title="Self Assessment"
        awaiting={selfAssessmentStats.awaiting}
        completed={selfAssessmentStats.completed}
        tone="slate"
        icon={User}
        delay={0.1}
        onClick={() => onFilterByFormState("PENDING_SELF_ASSESSMENT")}
        active={selectedFormState === "PENDING_SELF_ASSESSMENT"}
      />
      <StatCard
        title="Manager Review"
        awaiting={managerReviewStats.awaiting}
        completed={managerReviewStats.completed}
        tone="amber"
        icon={AlertTriangle}
        delay={0.2}
        onClick={() => onFilterByFormState("PENDING_HEAD_REVIEW")}
        active={selectedFormState === "PENDING_HEAD_REVIEW"}
      />
      <StatCard
        title="HR Alignment"
        awaiting={hrAlignmentStats.awaiting}
        completed={hrAlignmentStats.completed}
        tone="orange"
        icon={Scale}
        delay={0.3}
        onClick={() => onFilterByFormState("PENDING_HR_CALIBRATION")}
        active={selectedFormState === "PENDING_HR_CALIBRATION"}
      />
    </motion.div>
  );
}
