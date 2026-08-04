"use client";

import { Gavel, Scale, User } from "lucide-react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { EligibilityStatCard } from "@/app/components/dashboard/EligibilityStatCard";
import { ManagerReviewStatCard } from "@/app/components/dashboard/ManagerReviewStatCard";
import { StatCard } from "@/app/components/dashboard/StatCard";
import { containerVariants } from "@/app/helpers/dashboard-animations";
import type { FormState } from "@/app/helpers/dashboard-types";
import type {
  ManagerReviewDualStats,
  WorkflowStageStats,
} from "@/app/helpers/dashboard-workflow-stats";
import { isHeadRole } from "@/lib/auth/home-path";

interface DashboardWorkflowStatsRowProps {
  eligibilityData: Array<{ name: string; value: number; color: string }>;
  selfAssessmentStats: WorkflowStageStats;
  managerReviewStats: ManagerReviewDualStats;
  hrAlignmentStats: WorkflowStageStats;
  boardApprovalStats: WorkflowStageStats;
  selectedFormStates: string[] | null;
  onFilterByFormState: (state: FormState) => void;
}

function isFormStateActive(
  selectedFormStates: string[] | null,
  state: FormState,
): boolean {
  return (
    selectedFormStates !== null &&
    selectedFormStates.length === 1 &&
    selectedFormStates[0] === state
  );
}

export function DashboardWorkflowStatsRow({
  eligibilityData,
  selfAssessmentStats,
  managerReviewStats,
  hrAlignmentStats,
  boardApprovalStats,
  selectedFormStates,
  onFilterByFormState,
}: DashboardWorkflowStatsRowProps) {
  const { data: session } = useSession();
  const showHrAndBoardStats = !isHeadRole(session?.user?.role);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mb-0 flex flex-col gap-3  lg:flex lg:flex-row lg:gap-2"
    >
      <EligibilityStatCard data={eligibilityData} delay={0} />
      <StatCard
        title="Self Assessment"
        awaiting={selfAssessmentStats.awaiting}
        completed={selfAssessmentStats.completed}
        percentageLabel={selfAssessmentStats.percentageLabel}
        awaitingtitle="Eligible"
        completedtitle="Submitted"
        tone="slate"
        icon={User}
        delay={0.1}
        onClick={() => onFilterByFormState("PENDING_SELF_ASSESSMENT")}
        active={isFormStateActive(selectedFormStates, "PENDING_SELF_ASSESSMENT")}
      />
      <ManagerReviewStatCard
        manager1={managerReviewStats.manager1}
        manager2={managerReviewStats.manager2}
        delay={0.2}
        onClick={() => onFilterByFormState("PENDING_HEAD_REVIEW")}
        active={isFormStateActive(selectedFormStates, "PENDING_HEAD_REVIEW")}
      />
      {showHrAndBoardStats ? (
        <>
          <StatCard
            title="HR Alignment"
            awaiting={hrAlignmentStats.awaiting}
            completed={hrAlignmentStats.completed}
            percentageLabel={hrAlignmentStats.percentageLabel}
            awaitingtitle="Submitted"
            completedtitle="Aligned"
            tone="orange"
            icon={Scale}
            delay={0.3}
            onClick={() => onFilterByFormState("PENDING_HR_CALIBRATION")}
            active={isFormStateActive(selectedFormStates, "PENDING_HR_CALIBRATION")}
          />
          <StatCard
            title="Board Approval"
            awaiting={boardApprovalStats.awaiting}
            completed={boardApprovalStats.completed}
            percentageLabel={boardApprovalStats.percentageLabel}
            awaitingtitle="Pending"
            completedtitle="Approved"
            tone="violet"
            icon={Gavel}
            delay={0.4}
            onClick={() => onFilterByFormState("PENDING_BOARD_APPROVAL")}
            active={isFormStateActive(selectedFormStates, "PENDING_BOARD_APPROVAL")}
          />
        </>
      ) : null}
    </motion.div>
  );
}
