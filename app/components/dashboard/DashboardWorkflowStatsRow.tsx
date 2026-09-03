"use client";

import { Gavel, Scale, User } from "lucide-react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { EligibilityStatCard } from "@/app/components/dashboard/EligibilityStatCard";
import { ManagerReviewStatCard } from "@/app/components/dashboard/ManagerReviewStatCard";
import { StatCard } from "@/app/components/dashboard/StatCard";
import { containerVariants } from "@/app/helpers/dashboard-animations";
import type { CardFilterId } from "@/app/helpers/dashboard-types";
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
  selectedCardFilter: CardFilterId | null;
  onFilterByCard: (cardId: CardFilterId) => void;
}

export function DashboardWorkflowStatsRow({
  eligibilityData,
  selfAssessmentStats,
  managerReviewStats,
  hrAlignmentStats,
  boardApprovalStats,
  selectedCardFilter,
  onFilterByCard,
}: DashboardWorkflowStatsRowProps) {
  const { data: session } = useSession();
  const showHrAndBoardStats = !isHeadRole(session?.user?.role);

  // Resolve the active eligibility category name (if any) from the card filter.
  const activeEligibilityCategory =
    selectedCardFilter?.startsWith("eligibility:")
      ? selectedCardFilter.slice("eligibility:".length)
      : null;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mb-0 flex flex-col gap-3  lg:flex lg:flex-row lg:gap-2"
    >
      <EligibilityStatCard
        data={eligibilityData}
        delay={0}
        onCategoryClick={(name) => onFilterByCard(`eligibility:${name}` as CardFilterId)}
        activeCategory={activeEligibilityCategory}
      />
      <StatCard
        title="Assessments"
        awaiting={selfAssessmentStats.awaiting}
        completed={selfAssessmentStats.completed}
        percentageLabel={selfAssessmentStats.percentageLabel}
        awaitingtitle="Eligible"
        completedtitle="Submitted"
        tone="slate"
        icon={User}
        delay={0.1}
        onAwaitingClick={() => onFilterByCard("selfAssessment:eligible")}
        onCompletedClick={() => onFilterByCard("selfAssessment:submitted")}
        awaitingActive={selectedCardFilter === "selfAssessment:eligible"}
        completedActive={selectedCardFilter === "selfAssessment:submitted"}
      />
      <ManagerReviewStatCard
        manager1={managerReviewStats.manager1}
        manager2={managerReviewStats.manager2}
        delay={0.2}
        onManager1SubmittedClick={() => onFilterByCard("manager1:submitted")}
        onManager1ReviewedClick={() => onFilterByCard("manager1:reviewed")}
        onManager2SubmittedClick={() => onFilterByCard("manager2:submitted")}
        onManager2ReviewedClick={() => onFilterByCard("manager2:reviewed")}
        manager1SubmittedActive={selectedCardFilter === "manager1:submitted"}
        manager1ReviewedActive={selectedCardFilter === "manager1:reviewed"}
        manager2SubmittedActive={selectedCardFilter === "manager2:submitted"}
        manager2ReviewedActive={selectedCardFilter === "manager2:reviewed"}
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
            onAwaitingClick={() => onFilterByCard("hrAlignment:submitted")}
            onCompletedClick={() => onFilterByCard("hrAlignment:aligned")}
            awaitingActive={selectedCardFilter === "hrAlignment:submitted"}
            completedActive={selectedCardFilter === "hrAlignment:aligned"}
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
            onAwaitingClick={() => onFilterByCard("boardApproval:pending")}
            onCompletedClick={() => onFilterByCard("boardApproval:approved")}
            awaitingActive={selectedCardFilter === "boardApproval:pending"}
            completedActive={selectedCardFilter === "boardApproval:approved"}
          />
        </>
      ) : null}
    </motion.div>
  );
}
