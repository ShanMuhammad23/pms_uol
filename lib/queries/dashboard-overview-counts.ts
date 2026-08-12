import { hasAppraisalProgress } from "@/app/helpers/dashboard-chart-submissions";
import { getSubmissionEligibilityDisplayStatus } from "@/app/helpers/dashboard-eligibility";
import {
  formatRoleCategoryValue,
  matchesSubmissionEntityMultiFilter,
  matchesSubmissionFilters,
  matchesSubmissionFiltersExcluding,
  type SubmissionFilterState,
} from "@/app/helpers/dashboard-filters";
import { getHrApprovalStatus } from "@/app/helpers/dashboard-table-columns";
import {
  buildBoardApprovalStats,
  buildHrAlignmentStats,
  buildManagerReviewStats,
  buildSelfAssessmentStats,
  countEligibleSubmissions,
  isSubmissionEligible,
} from "@/app/helpers/dashboard-workflow-stats";
import { FORM_STATE_CONFIG } from "@/app/helpers/dashboard-form-state";
import type { FormState } from "@/app/helpers/dashboard-types";
import { resolveSubmissionPerformanceQuartile } from "@/lib/performance-rating";
import type { PerformanceQuartileBand } from "@/lib/performance-rating";
import type {
  CountOption,
  DashboardFilterParams,
  DashboardOverviewCounts,
} from "@/types/dashboard-api";
import type { EntityRecord } from "@/types/entities";
import type { FormSubmissionListItem } from "@/types/form-submissions";

export function toSubmissionFilterState(
  filters: DashboardFilterParams,
  entities: EntityRecord[],
): SubmissionFilterState {
  return {
    searchQuery: filters.searchQuery,
    selectedCategory0EntityIds: filters.category0EntityIds,
    selectedCategory1EntityIds: filters.category1EntityIds,
    selectedCategory2EntityIds: filters.category2EntityIds,
    selectedRoleCategories: filters.roleCategories,
    selectedDesignations: filters.designations,
    selectedFormStates: filters.formStates as FormState[] | null,
    selectedCardFilter: filters.cardFilter ?? null,
    entities,
  };
}

function sortCountOptions(options: CountOption[]): CountOption[] {
  return [...options].sort((left, right) => {
    if (left.value === "—") return 1;
    if (right.value === "—") return -1;
    return left.value.localeCompare(right.value, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function countByValue(
  submissions: FormSubmissionListItem[],
  getValue: (row: FormSubmissionListItem) => string,
): CountOption[] {
  const counts = new Map<string, number>();
  for (const submission of submissions) {
    const value = getValue(submission);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return sortCountOptions(
    [...counts.entries()].map(([value, count]) => ({ value, count })),
  );
}

function buildRatingQuartileCounts(
  submissions: FormSubmissionListItem[],
  bands: PerformanceQuartileBand[],
): DashboardOverviewCounts["ratingQuartileCounts"] {
  const counts = new Map<string, number>();

  for (const band of bands) {
    counts.set(`${band.performanceLevelId}-${band.quartileId}`, 0);
  }

  for (const submission of submissions) {
    if (!hasAppraisalProgress(submission)) continue;
    if (!isSubmissionEligible(submission)) continue;
    // Only count employees whose HR review is approved — normalized
    // score alone must not populate the matrix while HR is pending.
    if (getHrApprovalStatus(submission) !== "approved") continue;

    // Use the shared resolver which computes the normalized score %
    // from Score O + adjustments + calibration factor, then maps it
    // to the configured performance matrix bands. This ensures the
    // server-side aggregation uses the exact same logic as the
    // Staff Listing and the client-side matrix.
    const resolved = resolveSubmissionPerformanceQuartile(submission, bands);
    if (!resolved) continue;

    const key = `${resolved.performanceLevelId}-${resolved.quartileId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()].map(([key, count]) => {
    const [performanceLevelId, quartileId] = key.split("-").map(Number);
    return { performanceLevelId, quartileId, count };
  });
}

function buildRatingDistribution(
  submissions: FormSubmissionListItem[],
  bands: PerformanceQuartileBand[],
): CountOption[] {
  const counts = new Map<string, number>();

  for (const submission of submissions) {
    if (!hasAppraisalProgress(submission)) continue;
    if (!isSubmissionEligible(submission)) continue;
    // Match Rating × Quartile Matrix / Performance Rating Curve Actual:
    // only HR-approved alignments contribute to the distribution.
    if (getHrApprovalStatus(submission) !== "approved") continue;

    const resolved = resolveSubmissionPerformanceQuartile(submission, bands);
    if (!resolved) continue;

    const bucket = resolved.performanceLevelName;
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  return [...counts.entries()].map(([value, count]) => ({ value, count }));
}

export function buildDashboardOverviewCounts(
  submissions: FormSubmissionListItem[],
  filters: DashboardFilterParams,
  entities: EntityRecord[],
  quartileBands: PerformanceQuartileBand[],
): DashboardOverviewCounts {
  const filterState = toSubmissionFilterState(filters, entities);
  const filtered = submissions.filter((submission) =>
    matchesSubmissionFilters(submission, filterState),
  );

  const quotaEligibleCount = countEligibleSubmissions(
    submissions.filter((submission) =>
      matchesSubmissionFiltersExcluding(submission, filterState, "formState"),
    ),
  );

  const countForDimension = (
    dimension: Parameters<typeof matchesSubmissionFiltersExcluding>[2],
    predicate: (submission: FormSubmissionListItem) => boolean,
  ) => {
    let count = 0;
    for (const submission of submissions) {
      if (
        matchesSubmissionFiltersExcluding(submission, filterState, dimension) &&
        predicate(submission)
      ) {
        count += 1;
      }
    }
    return count;
  };

  const category0 = entities
    .filter((entity) => entity.categoryCode === "C0")
    .map((entity) => ({
      value: String(entity.id),
      count: countForDimension("category0", (submission) =>
        matchesSubmissionEntityMultiFilter(submission, [entity.id], entities),
      ),
    }));

  const category1 = entities
    .filter((entity) => entity.categoryCode === "C1")
    .map((entity) => ({
      value: String(entity.id),
      count: countForDimension("category1", (submission) =>
        matchesSubmissionEntityMultiFilter(submission, [entity.id], entities),
      ),
    }));

  const category2 = entities
    .filter((entity) => entity.categoryCode === "C2")
    .map((entity) => ({
      value: String(entity.id),
      count: countForDimension("category2", (submission) =>
        matchesSubmissionEntityMultiFilter(submission, [entity.id], entities),
      ),
    }));

  const selectedC0 = filters.category0EntityIds;
  const category0Distribution = category0
    .filter((option) => {
      if (selectedC0 !== null && selectedC0.length > 0) {
        return selectedC0.includes(Number(option.value));
      }
      return true;
    })
    .map((option) => ({
      value: option.value,
      count: filtered.filter((submission) =>
        matchesSubmissionEntityMultiFilter(
          submission,
          [Number(option.value)],
          entities,
        ),
      ).length,
    }))
    .filter((option) => option.count > 0);

  const roleCategoryRows = countByValue(
    submissions.filter((submission) =>
      matchesSubmissionFiltersExcluding(submission, filterState, "roleCategory"),
    ),
    (submission) => formatRoleCategoryValue(submission.roleCategory),
  );

  // Include zero-count role categories that appear anywhere in scope.
  const allRoleCategories = new Set(
    submissions.map((submission) =>
      formatRoleCategoryValue(submission.roleCategory),
    ),
  );
  for (const value of allRoleCategories) {
    if (!roleCategoryRows.some((row) => row.value === value)) {
      roleCategoryRows.push({ value, count: 0 });
    }
  }

  const designations = countByValue(
    submissions.filter((submission) =>
      matchesSubmissionFiltersExcluding(submission, filterState, "designation"),
    ),
    (submission) => submission.designation?.trim() || "—",
  ).filter((option) => option.count > 0 && option.value !== "—");

  const formStates = (Object.keys(FORM_STATE_CONFIG) as FormState[]).map(
    (state) => ({
      value: state,
      count: countForDimension(
        "formState",
        (submission) => submission.status === state,
      ),
    }),
  );

  const eligibility = {
    "Fully Eligible": 0,
    "Partially Eligible": 0,
    "Not Eligible": 0,
    Ineligible: 0,
  } as DashboardOverviewCounts["eligibility"];

  for (const submission of filtered) {
    eligibility[getSubmissionEligibilityDisplayStatus(submission)] += 1;
  }

  const managerStats = buildManagerReviewStats(filtered);

  return {
    total: filtered.length,
    quotaEligibleCount,
    filters: {
      category0,
      category1,
      category2,
      roleCategories: sortCountOptions(roleCategoryRows),
      designations,
      formStates,
      category0Distribution,
    },
    eligibility,
    workflow: {
      selfAssessment: buildSelfAssessmentStats(filtered),
      manager1: managerStats.manager1,
      manager2: managerStats.manager2,
      hrAlignment: buildHrAlignmentStats(filtered),
      boardApproval: buildBoardApprovalStats(filtered),
    },
    ratingDistribution: buildRatingDistribution(filtered, quartileBands),
    ratingQuartileCounts: buildRatingQuartileCounts(filtered, quartileBands),
    chartEmployeeCount: filtered.filter(
      (submission) => hasAppraisalProgress(submission) && isSubmissionEligible(submission),
    ).length,
  };
}
