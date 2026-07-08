"use client";

import { useMemo } from "react";
import { buildCalibrationData } from "@/app/helpers/dashboard-calibration";
import { createPieLabelRenderer } from "@/app/helpers/dashboard-chart-utils";
import { buildEligibilityData } from "@/app/helpers/dashboard-eligibility";
import { buildRatingQuartileMatrix } from "@/app/helpers/dashboard-rating-matrix";
import {
  buildSubmissionCategoryCounts,
  buildSubmissionCompletionByCategory,
} from "@/app/helpers/dashboard-submission-charts";
import { countWorkflowStage } from "@/app/helpers/dashboard-workflow-stats";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { PerformanceLevelWithQuartiles } from "@/types/performance-matrices";
import type { StaffCategoryWithSubCategories } from "@/types/staff-categories";

interface UseDashboardChartMetricsParams {
  filteredSubmissions: FormSubmissionListItem[];
  staffCategories: StaffCategoryWithSubCategories[];
  isDarkMode: boolean;
  matrixForDistribution: PerformanceLevelWithQuartiles[];
}

export function useDashboardChartMetrics({
  filteredSubmissions,
  staffCategories,
  isDarkMode,
  matrixForDistribution,
}: UseDashboardChartMetricsParams) {
  const themedCategoryDistribution = useMemo(
    () => buildSubmissionCategoryCounts(filteredSubmissions, staffCategories, isDarkMode),
    [filteredSubmissions, staffCategories, isDarkMode],
  );

  const filteredCalibrationData = useMemo(
    () => buildCalibrationData(filteredSubmissions),
    [filteredSubmissions],
  );

  const ratingQuartileMatrix = useMemo(
    () => buildRatingQuartileMatrix(filteredSubmissions, matrixForDistribution),
    [filteredSubmissions, matrixForDistribution],
  );

  const filteredCompletionByCategory = useMemo(
    () => buildSubmissionCompletionByCategory(filteredSubmissions, staffCategories),
    [filteredSubmissions, staffCategories],
  );

  const pieLabelRenderer = useMemo(
    () => createPieLabelRenderer(isDarkMode ? "#cbd5e1" : "#475569"),
    [isDarkMode],
  );

  const eligibilityData = useMemo(
    () => buildEligibilityData(filteredSubmissions, isDarkMode),
    [filteredSubmissions, isDarkMode],
  );

  const selfAssessmentStats = useMemo(
    () =>
      countWorkflowStage(filteredSubmissions, "PENDING_SELF_ASSESSMENT", [
        "PENDING_HEAD_REVIEW",
        "PENDING_HR_CALIBRATION",
        "PENDING_BOARD_APPROVAL",
        "APPROVED",
        "COMPLETED",
      ]),
    [filteredSubmissions],
  );

  const managerReviewStats = useMemo(
    () =>
      countWorkflowStage(filteredSubmissions, "PENDING_HEAD_REVIEW", [
        "PENDING_HR_CALIBRATION",
        "PENDING_BOARD_APPROVAL",
        "APPROVED",
        "COMPLETED",
      ]),
    [filteredSubmissions],
  );

  const hrAlignmentStats = useMemo(
    () =>
      countWorkflowStage(filteredSubmissions, "PENDING_HR_CALIBRATION", [
        "PENDING_BOARD_APPROVAL",
        "APPROVED",
        "COMPLETED",
      ]),
    [filteredSubmissions],
  );

  return {
    themedCategoryDistribution,
    filteredCalibrationData,
    ratingQuartileMatrix,
    filteredCompletionByCategory,
    pieLabelRenderer,
    eligibilityData,
    selfAssessmentStats,
    managerReviewStats,
    hrAlignmentStats,
  };
}
