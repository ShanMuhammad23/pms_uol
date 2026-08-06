import type { WorkflowStageStats } from "@/app/helpers/dashboard-workflow-stats";
import type { MasterFilterState } from "@/app/helpers/dashboard-master-filters";
import type { DashboardTableColumnId } from "@/app/helpers/dashboard-table-columns";
import type { CardFilterId } from "@/app/helpers/dashboard-types";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { AppraisalStatus } from "@/types/forms";

export type CountOption = {
  value: string;
  count: number;
};

export type DashboardFilterParams = {
  searchQuery: string;
  category0EntityIds: number[] | null;
  category1EntityIds: number[] | null;
  category2EntityIds: number[] | null;
  roleCategories: string[] | null;
  designations: string[] | null;
  formStates: AppraisalStatus[] | null;
  /** Active dashboard card filter (set when a card number is clicked). */
  cardFilter: CardFilterId | null;
};

export type DashboardOverviewCounts = {
  total: number;
  quotaEligibleCount: number;
  filters: {
    category0: CountOption[];
    category1: CountOption[];
    category2: CountOption[];
    roleCategories: CountOption[];
    designations: CountOption[];
    formStates: CountOption[];
    category0Distribution: CountOption[];
  };
  eligibility: Record<
    "Fully Eligible" | "Partially Eligible" | "Not Eligible" | "Ineligible",
    number
  >;
  workflow: {
    selfAssessment: WorkflowStageStats;
    manager1: WorkflowStageStats;
    manager2: WorkflowStageStats;
    hrAlignment: WorkflowStageStats;
    boardApproval: WorkflowStageStats;
  };
  ratingDistribution: CountOption[];
  ratingQuartileCounts: Array<{
    performanceLevelId: number;
    quartileId: number;
    count: number;
  }>;
  chartEmployeeCount: number;
};

export type FormSubmissionsPageResponse = {
  items: FormSubmissionListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** Employee IDs matching dashboard + master filters (all pages). */
  matchingEmployeeIds: string[];
  /** Distinct value counts per master-filterable column (faceted). */
  columnCounts: Partial<Record<DashboardTableColumnId, CountOption[]>>;
};

export type FormSubmissionsQueryParams = {
  page: number;
  pageSize: number;
  filters: DashboardFilterParams;
  masterFilters: MasterFilterState;
};
