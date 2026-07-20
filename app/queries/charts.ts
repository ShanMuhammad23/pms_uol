"use client";

import { useMemo } from "react";
import { buildCalibrationData } from "@/app/helpers/dashboard-calibration";
import { filterSubmissionsForCharts } from "@/app/helpers/dashboard-chart-submissions";
import { createPieLabelRenderer } from "@/app/helpers/dashboard-chart-utils";
import { buildEligibilityData } from "@/app/helpers/dashboard-eligibility";
import { buildRatingQuartileMatrix } from "@/app/helpers/dashboard-rating-matrix";
import {
  buildSubmissionCategoryCounts,
  buildSubmissionCompletionByCategory,
} from "@/app/helpers/dashboard-submission-charts";
import {
  buildBoardApprovalStats,
  buildHrAlignmentStats,
  buildManagerReviewStats,
  buildSelfAssessmentStats,
  countEligibleSubmissions,
} from "@/app/helpers/dashboard-workflow-stats";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { PerformanceLevelWithQuartiles } from "@/types/performance-matrices";
import type { StaffCategoryWithSubCategories } from "@/types/staff-categories";

interface UseDashboardChartMetricsParams {
  filteredSubmissions: FormSubmissionListItem[];
  staffCategories: StaffCategoryWithSubCategories[];
  isDarkMode: boolean;
  matrixForDistribution: PerformanceLevelWithQuartiles[];
  institutionalQuotaRows?: Array<{ rating: string; quota: number }>;
}

export function useDashboardChartMetrics({
  filteredSubmissions,
  staffCategories,
  isDarkMode,
  matrixForDistribution,
  institutionalQuotaRows,
}: UseDashboardChartMetricsParams) {
  const chartSubmissions = useMemo(
    () => filterSubmissionsForCharts(filteredSubmissions),
    [filteredSubmissions],
  );

  const themedCategoryDistribution = useMemo(
    () => buildSubmissionCategoryCounts(filteredSubmissions, staffCategories, isDarkMode),
    [filteredSubmissions, staffCategories, isDarkMode],
  );

  const filteredEligibleCount = useMemo(
    () => countEligibleSubmissions(filteredSubmissions),
    [filteredSubmissions],
  );

  const filteredCalibrationData = useMemo(
    () =>
      buildCalibrationData(
        filteredSubmissions,
        institutionalQuotaRows,
        filteredEligibleCount,
      ),
    [filteredSubmissions, institutionalQuotaRows, filteredEligibleCount],
  );

  const ratingQuartileMatrix = useMemo(
    () => buildRatingQuartileMatrix(chartSubmissions, matrixForDistribution),
    [chartSubmissions, matrixForDistribution],
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
    () => buildSelfAssessmentStats(filteredSubmissions),
    [filteredSubmissions],
  );

  const managerReviewStats = useMemo(
    () => buildManagerReviewStats(filteredSubmissions),
    [filteredSubmissions],
  );

  const hrAlignmentStats = useMemo(
    () => buildHrAlignmentStats(filteredSubmissions),
    [filteredSubmissions],
  );

  const boardApprovalStats = useMemo(
    () => buildBoardApprovalStats(filteredSubmissions),
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
    boardApprovalStats,
    chartSubmissions,
  };
}
